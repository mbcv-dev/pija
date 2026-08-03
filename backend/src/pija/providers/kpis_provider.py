"""Provider dos KPIs (mediana de tempo).

Cada KPI SQL é um "produtor de linhas": devolve (dimensao, valor) por evento,
sem agregar. O provider envelopa esse SQL com janelas (window functions) que
calculam, numa passagem só, a MEDIANA (p50) por dimensão (breakdown) e a
mediana global. Mediana — não média — porque são tempos/processos com cauda
longa; a média era inflada por poucos casos extremos.

O mesmo produtor de linhas alimenta `get_distribuicoes`, que envelopa o SQL com
uma bucketização (histograma) para expor justamente a cauda que a mediana esconde.
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import load_sql
from pija.schemas.common import GROUP_COL, GroupBy
from pija.schemas.kpis_schema import (
    DistBucket,
    DistribuicoesResponse,
    KpiBreakdownItem,
    KpiDistribuicao,
    KpiResult,
    KpisResponse,
)
from pija.sql_filtros import Filtros, build_filtros
from pija.unidades import (
    GRUPO_AMBULATORIAL,
    GRUPO_ANALISES_CLINICAS,
    GRUPO_ANATOMIA_PATOLOGICA,
    GRUPO_DIAGNOSTICO_IMAGEM,
    GRUPO_INTERNACAO,
)

# code → (arquivo .sql, descrição)
KPI_META: dict[str, tuple[str, str]] = {
    "KPI-01": ("kpis/kpi_01.sql", "Prontuário → 1º evento assistencial"),
    "KPI-03": ("kpis/kpi_03.sql", "Agendamento → realização (consulta)"),
    "KPI-05": ("kpis/kpi_05.sql", "Solicitação → realização (exame)"),
    "KPI-06": ("kpis/kpi_06.sql", "Última consulta → internação subsequente"),
    "KPI-07": ("kpis/kpi_07.sql", "Tempo de permanência no leito"),
    "KPI-07B": ("kpis/kpi_07b.sql", "Alta médica → saída do leito"),
}

# code → unidade de tempo das médias (default "dias")
KPI_UNIDADE_TEMPO: dict[str, str] = {"KPI-07B": "horas"}

# Recorte fixo de grupos por KPI (decisão HC 2026-06-26). Valores vêm de
# constantes (whitelist) — nunca de entrada do usuário.
KPI_GRUPO_SCOPE: dict[str, list[str]] = {
    "KPI-01": [GRUPO_AMBULATORIAL],
    "KPI-03": [GRUPO_AMBULATORIAL],
    "KPI-05": [GRUPO_ANALISES_CLINICAS, GRUPO_DIAGNOSTICO_IMAGEM, GRUPO_ANATOMIA_PATOLOGICA],
    "KPI-06": [GRUPO_INTERNACAO],
    "KPI-07": [GRUPO_INTERNACAO],
    "KPI-07B": [GRUPO_INTERNACAO],
}
ALL_KPIS: list[str] = list(KPI_META)

# Alias que qualifica as colunas de dimensão, por KPI (vazio = sem alias).
# Fonte única — evita divergência entre _scope_fragment e compute().
KPI_DIM_PREFIX: dict[str, str] = {"KPI-01": "pd."}

# Envelope de mediana: {base} é o produtor de linhas (dimensao, valor) do KPI.
# Numa passagem, devolve a mediana por dimensão (tipo 'B') e a global (tipo 'G').
# A mediana é a média do(s) elemento(s) central(is) após ordenar por `valor`.
_MEDIAN_SQL = """
WITH base AS (
{base}
),
ranked AS (
  SELECT dimensao, valor,
         ROW_NUMBER() OVER (PARTITION BY dimensao ORDER BY valor) AS rn_d,
         COUNT(*)     OVER (PARTITION BY dimensao)                AS cnt_d,
         ROW_NUMBER() OVER (ORDER BY valor)                       AS rn_g,
         COUNT(*)     OVER ()                                     AS cnt_g
  FROM base
)
SELECT 'B' AS tipo, dimensao, AVG(valor) AS mediana, MAX(cnt_d) AS n
FROM ranked
WHERE rn_d IN ((cnt_d + 1) / 2, (cnt_d + 2) / 2)
  AND dimensao IS NOT NULL AND dimensao <> ''
GROUP BY dimensao
UNION ALL
SELECT 'G' AS tipo, NULL AS dimensao, AVG(valor) AS mediana, MAX(cnt_g) AS n
FROM ranked
WHERE rn_g IN ((cnt_g + 1) / 2, (cnt_g + 2) / 2)
"""

# Baldes lineares entre 0 e p95; o que passa de p95 cai num único balde de cauda.
# O cap em p95 existe porque a cauda é o objeto de interesse: sem ele, um único
# outlier esmagaria todos os demais baldes num histograma ilegível.
_N_BUCKETS = 16

# Envelope de distribuição: mesmo {base} produtor de linhas usado pela mediana.
# `dimensao` é ignorada aqui — o histograma é sempre do recorte inteiro.
# p50 replica LITERALMENTE a expressão do _MEDIAN_SQL global (média do(s)
# elemento(s) central(is)) para o gráfico não contradizer o número do card.
# p95 = valor na posição ceil(0.95 * n): (cnt * 95 + 99) / 100 é divisão
# INTEIRA de propósito (teto), e é sempre >= 1 porque cnt >= 1.
_DIST_SQL = """
WITH base AS (
{base}
),
ranked AS (
  SELECT valor,
         ROW_NUMBER() OVER (ORDER BY valor) AS rn,
         COUNT(*)     OVER ()               AS cnt
  FROM base
  WHERE valor IS NOT NULL
),
stats AS (
  SELECT
    (SELECT AVG(valor) FROM ranked WHERE rn IN ((cnt + 1) / 2, (cnt + 2) / 2)) AS p50,
    (SELECT valor FROM ranked WHERE rn = (cnt * 95 + 99) / 100 LIMIT 1)        AS p95,
    (SELECT MAX(cnt) FROM ranked)                                              AS n_total
)
SELECT
  CASE
    WHEN s.p95 IS NULL OR s.p95 <= 0 THEN 0
    WHEN r.valor >= s.p95 THEN :n_buckets
    ELSE CAST(r.valor * :n_buckets / s.p95 AS INTEGER)
  END            AS idx,
  COUNT(*)       AS n,
  MAX(s.p50)     AS p50,
  MAX(s.p95)     AS p95,
  MAX(s.n_total) AS n_total
FROM ranked r CROSS JOIN stats s
GROUP BY idx
ORDER BY idx
"""


class KpisProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _scope_fragment(self, code: str) -> str:
        scope = KPI_GRUPO_SCOPE.get(code) or []
        if not scope:
            return ""
        col = f"{KPI_DIM_PREFIX.get(code, '')}grupo"
        quoted = ", ".join("'" + g.replace("'", "''") + "'" for g in scope)
        return f"AND {col} IN ({quoted})"

    def _base_sql(self, code: str, group_by: GroupBy, filtros: Filtros) -> tuple[str, dict]:
        """Monta o produtor de linhas (dimensao, valor) do KPI com filtros/escopo aplicados.

        Compartilhado por mediana e distribuição — os dois envelopes PRECISAM ler
        exatamente as mesmas linhas, senão o gráfico contradiz o número do card.
        """
        sql_name, _ = KPI_META[code]
        col = GROUP_COL[group_by]
        prefix = KPI_DIM_PREFIX.get(code, "")
        frag, fparams = build_filtros(filtros, prefix=prefix)
        base = (
            load_sql(sql_name)
            .replace("{group_col}", col)
            .replace("{grupo_scope}", self._scope_fragment(code))
            .replace("{filtros}", frag)
        )
        params = {
            **fparams,
            "data_inicio": filtros.data_inicio,
            "data_fim": filtros.data_fim,
        }
        return base, params

    async def compute(self, code: str, group_by: GroupBy, filtros: Filtros) -> KpiResult:
        descricao = KPI_META[code][1]
        base, params = self._base_sql(code, group_by, filtros)
        rows = (await self._session.execute(text(_MEDIAN_SQL.format(base=base)), params)).all()

        breakdown: list[KpiBreakdownItem] = []
        media_global: float | None = None
        n_global = 0
        for r in rows:
            m = r._mapping
            n = int(m["n"] or 0)
            if m["tipo"] == "G":
                n_global = n
                media_global = float(m["mediana"]) if (m["mediana"] is not None and n) else None
            elif n > 0 and m["dimensao"]:
                breakdown.append(KpiBreakdownItem(dimensao=m["dimensao"], media=float(m["mediana"]), n=n))

        breakdown.sort(key=lambda b: (-b.media, b.dimensao))
        return KpiResult(
            codigo=code,
            descricao=descricao,
            unidade_tempo=KPI_UNIDADE_TEMPO.get(code, "dias"),
            media_global=media_global,
            n_global=n_global,
            breakdown=breakdown,
        )

    async def get_kpis(
        self,
        *,
        kpi_codes: list[str] | None,
        group_by: GroupBy,
        filtros: Filtros,
    ) -> KpisResponse:
        codes = kpi_codes or ALL_KPIS
        results = [await self.compute(code, group_by, filtros) for code in codes]
        return KpisResponse(kpis=results)

    async def get_distribuicoes(
        self, *, kpi_codes: list[str] | None, filtros: Filtros
    ) -> DistribuicoesResponse:
        """Distribuição dos tempos por KPI (histograma).

        Não há group_by: a coluna `dimensao` do produtor de linhas é ignorada e
        `unidade` é usada só para satisfazer o placeholder {group_col}.
        """
        codes = kpi_codes or ALL_KPIS
        out: list[KpiDistribuicao] = []
        for code in codes:
            base, params = self._base_sql(code, GroupBy.unidade, filtros)
            rows = (
                await self._session.execute(
                    text(_DIST_SQL.format(base=base)),
                    {**params, "n_buckets": _N_BUCKETS},
                )
            ).all()

            por_idx: dict[int, int] = {}
            p50: float | None = None
            p95: float | None = None
            n_total = 0
            for r in rows:
                m = r._mapping
                por_idx[int(m["idx"])] = int(m["n"])
                p50 = float(m["p50"]) if m["p50"] is not None else None
                p95 = float(m["p95"]) if m["p95"] is not None else None
                n_total = int(m["n_total"] or 0)

            buckets: list[DistBucket] = []
            if n_total > 0 and p95 is not None and p95 > 0:
                largura = p95 / _N_BUCKETS
                # Lineares (preenche baldes vazios com n=0 — o histograma é contínuo)…
                buckets = [
                    DistBucket(de=i * largura, ate=(i + 1) * largura, n=por_idx.get(i, 0))
                    for i in range(_N_BUCKETS)
                ]
                # …e a cauda aberta por último.
                buckets.append(DistBucket(de=p95, ate=None, n=por_idx.get(_N_BUCKETS, 0)))
            elif n_total > 0:
                # Degenerado (p95 <= 0: praticamente todos os valores são 0) — um balde só.
                buckets = [DistBucket(de=0.0, ate=0.0, n=n_total)]

            out.append(
                KpiDistribuicao(
                    codigo=code,
                    unidade_tempo=KPI_UNIDADE_TEMPO.get(code, "dias"),
                    p50=p50 if n_total else None,
                    p95=p95 if n_total else None,
                    n_total=n_total,
                    buckets=buckets,
                )
            )
        return DistribuicoesResponse(distribuicoes=out)
