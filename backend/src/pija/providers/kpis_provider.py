"""Provider dos KPIs (mediana de tempo).

Cada KPI SQL é um "produtor de linhas": devolve (dimensao, valor) por evento,
sem agregar. O provider envelopa esse SQL com janelas (window functions) que
calculam, numa passagem só, a MEDIANA (p50) por dimensão (breakdown) e a
mediana global. Mediana — não média — porque são tempos/processos com cauda
longa; a média era inflada por poucos casos extremos.
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import load_sql
from pija.schemas.common import GROUP_COL, GroupBy
from pija.schemas.kpis_schema import KpiBreakdownItem, KpiResult, KpisResponse
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


class KpisProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _scope_fragment(self, code: str) -> str:
        scope = KPI_GRUPO_SCOPE.get(code) or []
        if not scope:
            return ""
        col = "pd.grupo" if code == "KPI-01" else "grupo"
        quoted = ", ".join("'" + g.replace("'", "''") + "'" for g in scope)
        return f"AND {col} IN ({quoted})"

    async def compute(self, code: str, group_by: GroupBy, filtros: Filtros) -> KpiResult:
        sql_name, descricao = KPI_META[code]
        col = GROUP_COL[group_by]
        # KPI-01 qualifica as colunas de dimensão com o alias `pd.`.
        prefix = "pd." if code == "KPI-01" else ""
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
