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
  -- Sem valor não há tempo a medir. Descartar aqui (e não deixar o AVG ignorar
  -- depois) é o que mantém o envelope da distribuição lendo as MESMAS linhas —
  -- e evita que NULLs, que o SQLite ordena primeiro, inflem cnt e desloquem o
  -- elemento central da mediana.
  WHERE valor IS NOT NULL
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

# Quantidade de baldes lineares antes do balde de cauda aberta.
_N_BUCKETS = 16

# Envelope de distribuição: envolve o mesmo {base} produtor de linhas que a
# mediana usa. `dimensao` é ignorada — o histograma é sempre do recorte inteiro.
#
# TETO dos baldes lineares: normalmente o p95, e tudo acima dele cai num único
# balde de cauda. O corte existe por LEGIBILIDADE (sem ele um único outlier
# esmagaria os demais baldes), NUNCA para fingir que a cauda não existe. Por isso
# quando p95 = 0 — que não quer dizer "tudo é zero", e sim ">= 95% dos casos são
# zero", situação real do KPI-07B — o teto cai no MÁXIMO: senão a cauda, que é
# justamente o objeto do gráfico, sumiria num balde só.
#
# p50 replica LITERALMENTE a expressão do _MEDIAN_SQL global (média do(s)
# elemento(s) central(is)) para o gráfico não contradizer o número do card.
#
# p95 = valor na posição ceil(0.95 * n): (cnt * 95 + 99) / 100 é divisão INTEIRA
# de propósito (teto), e é sempre >= 1 porque cnt >= 1.
#
# MAX(0, ...) no índice: os .sql de hoje só produzem valor >= 0, mas se um KPI
# futuro deixar passar negativo, o CAST truncaria para índice negativo e o caso
# SUMIRIA da resposta sem erro nenhum. Com o clamp ele cai no primeiro balde —
# contado mesmo estando abaixo do `de` dele — e sum(n) == n_total se mantém.
# Sumir em silêncio é pior do que aparecer no balde errado.
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
percentis AS (
  SELECT
    (SELECT AVG(valor) FROM ranked WHERE rn IN ((cnt + 1) / 2, (cnt + 2) / 2)) AS p50,
    (SELECT valor FROM ranked WHERE rn = (cnt * 95 + 99) / 100 LIMIT 1)        AS p95,
    (SELECT MAX(valor) FROM ranked)                                            AS vmax,
    (SELECT MAX(cnt)   FROM ranked)                                            AS n_total
),
stats AS (
  SELECT p50, p95, n_total,
         CASE WHEN p95 > 0 THEN p95 ELSE vmax END AS teto
  FROM percentis
)
SELECT
  CASE
    WHEN s.teto IS NULL OR s.teto <= 0 THEN 0
    WHEN r.valor >= s.teto            THEN :n_buckets
    ELSE MAX(0, CAST(r.valor * :n_buckets / s.teto AS INTEGER))
  END            AS idx,
  COUNT(*)       AS n,
  MAX(s.p50)     AS p50,
  MAX(s.p95)     AS p95,
  MAX(s.teto)    AS teto,
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

    def _base_sql(
        self, code: str, group_by: GroupBy, filtros: Filtros
    ) -> tuple[str, dict[str, str | None]]:
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
        _, descricao = KPI_META[code]
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

    async def _distribuicao(
        self, code: str, base: str, params: dict[str, str | None]
    ) -> KpiDistribuicao:
        """Roda o envelope de distribuição sobre um produtor de linhas já montado."""
        rows = (
            await self._session.execute(
                text(_DIST_SQL.format(base=base)),
                {**params, "n_buckets": _N_BUCKETS},
            )
        ).all()

        por_idx: dict[int, int] = {}
        p50: float | None = None
        p95: float | None = None
        teto: float | None = None
        n_total = 0
        for r in rows:
            m = r._mapping
            por_idx[int(m["idx"])] = int(m["n"])
            p50 = float(m["p50"]) if m["p50"] is not None else None
            p95 = float(m["p95"]) if m["p95"] is not None else None
            teto = float(m["teto"]) if m["teto"] is not None else None
            n_total = int(m["n_total"] or 0)

        buckets: list[DistBucket] = []
        if n_total > 0 and teto is not None and teto > 0:
            largura = teto / _N_BUCKETS
            # Lineares (preenche baldes vazios com n=0 — o histograma é contínuo).
            # O último fecha em `teto` cravado: _N_BUCKETS * (teto/_N_BUCKETS) só
            # devolve `teto` exato por sorte do binário (hoje 16 é potência de 2);
            # fixar o valor evita que trocar a constante abra uma fresta no eixo.
            buckets = [
                DistBucket(
                    de=i * largura,
                    ate=teto if i == _N_BUCKETS - 1 else (i + 1) * largura,
                    n=por_idx.get(i, 0),
                )
                for i in range(_N_BUCKETS)
            ]
            # …e a cauda aberta por último.
            buckets.append(DistBucket(de=teto, ate=None, n=por_idx.get(_N_BUCKETS, 0)))
        elif n_total > 0:
            # Aqui o máximo também é 0: não há intervalo a fatiar e todos os casos
            # valem 0. Sai um balde aberto em 0 — e não [0, 0), que é intervalo
            # vazio e mentiria sobre o que o balde contém.
            # Ancorar em 0 assume valor >= 0, o que todo .sql de KPI garante
            # (filtram `fim >= inicio`) e é a mesma premissa do eixo do histograma.
            buckets = [DistBucket(de=0.0, ate=None, n=n_total)]

        return KpiDistribuicao(
            codigo=code,
            unidade_tempo=KPI_UNIDADE_TEMPO.get(code, "dias"),
            p50=p50 if n_total else None,
            p95=p95 if n_total else None,
            teto=teto if n_total else None,
            n_total=n_total,
            buckets=buckets,
        )

    async def get_distribuicoes(
        self, *, kpi_codes: list[str] | None, filtros: Filtros
    ) -> DistribuicoesResponse:
        """Distribuição dos tempos por KPI (histograma).

        Não existe group_by aqui: a coluna `dimensao` do produtor de linhas é
        ignorada pelo envelope, e `GroupBy.unidade` entra só para preencher o
        placeholder {group_col}.

        ISSO SÓ É SEGURO porque, em todos os .sql de KPI, {group_col} aparece
        apenas na projeção (`SELECT {group_col} AS dimensao`) — nunca num GROUP BY
        que mudasse a cardinalidade das linhas. Um KPI novo que agrupe por
        {group_col} quebraria a premissa: o histograma passaria a contar linhas
        agregadas em vez de casos, e n_total divergiria do n_global do card.
        """
        codes = kpi_codes or ALL_KPIS
        out: list[KpiDistribuicao] = []
        for code in codes:
            base, params = self._base_sql(code, GroupBy.unidade, filtros)
            out.append(await self._distribuicao(code, base, params))
        return DistribuicoesResponse(distribuicoes=out)
