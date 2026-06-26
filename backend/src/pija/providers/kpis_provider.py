"""Provider dos KPIs de tempo médio.

Cada KPI SQL devolve, por dimensão (group_by), SUM(diff_dias) e COUNT(*).
O provider divide soma/n por grupo (média do grupo) e calcula o global como
Σsoma/Σn (exato). Cálculo temporal fica no SQL; montagem fica em Python.
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import load_sql
from pija.schemas.common import GROUP_COL, GroupBy
from pija.schemas.kpis_schema import KpiBreakdownItem, KpiResult, KpisResponse
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
}

# Recorte fixo de grupos por KPI (decisão HC 2026-06-26). Valores vêm de
# constantes (whitelist) — nunca de entrada do usuário.
KPI_GRUPO_SCOPE: dict[str, list[str]] = {
    "KPI-01": [GRUPO_AMBULATORIAL],
    "KPI-03": [GRUPO_AMBULATORIAL],
    "KPI-05": [GRUPO_ANALISES_CLINICAS, GRUPO_DIAGNOSTICO_IMAGEM, GRUPO_ANATOMIA_PATOLOGICA],
    "KPI-06": [GRUPO_INTERNACAO],
    "KPI-07": [GRUPO_INTERNACAO],
}
ALL_KPIS: list[str] = list(KPI_META)


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

    async def compute(self, code: str, group_by: GroupBy, params: dict) -> KpiResult:
        sql_name, descricao = KPI_META[code]
        col = GROUP_COL[group_by]
        sql = (
            load_sql(sql_name)
            .replace("{group_col}", col)
            .replace("{grupo_scope}", self._scope_fragment(code))
        )
        rows = (await self._session.execute(text(sql), params)).all()

        breakdown: list[KpiBreakdownItem] = []
        total_soma = 0.0
        total_n = 0
        for r in rows:
            m = r._mapping
            n = int(m["n"] or 0)
            if n == 0:
                continue
            soma = float(m["soma_dias"] or 0.0)
            total_soma += soma
            total_n += n
            if m["dimensao"] is not None:
                breakdown.append(KpiBreakdownItem(dimensao=m["dimensao"], media=soma / n, n=n))

        breakdown.sort(key=lambda b: (-b.media, b.dimensao))
        media_global = (total_soma / total_n) if total_n else None
        return KpiResult(
            codigo=code,
            descricao=descricao,
            media_global=media_global,
            n_global=total_n,
            breakdown=breakdown,
        )

    async def get_kpis(
        self,
        *,
        kpi_codes: list[str] | None,
        group_by: GroupBy,
        unidade: str | None,
        especialidade: str | None,
        grupo: str | None,
        data_inicio: str | None,
        data_fim: str | None,
    ) -> KpisResponse:
        codes = kpi_codes or ALL_KPIS
        params = dict(
            unidade=unidade,
            especialidade=especialidade,
            grupo=grupo,
            data_inicio=data_inicio,
            data_fim=data_fim,
        )
        results = [await self.compute(code, group_by, params) for code in codes]
        return KpisResponse(kpis=results)
