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

# code → (arquivo .sql, descrição)
KPI_META: dict[str, tuple[str, str]] = {
    "KPI-01": ("kpis/kpi_01.sql", "Prontuário → 1º evento"),
    "KPI-03": ("kpis/kpi_03.sql", "Agendamento → realização (consulta)"),
    "KPI-05": ("kpis/kpi_05.sql", "Solicitação → realização (exame)"),
    "KPI-06": ("kpis/kpi_06.sql", "Última consulta → internação subsequente"),
    "KPI-07": ("kpis/kpi_07.sql", "Tempo de permanência no leito"),
}
ALL_KPIS: list[str] = list(KPI_META)


class KpisProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def compute(self, code: str, group_by: GroupBy, params: dict) -> KpiResult:
        sql_name, descricao = KPI_META[code]
        col = GROUP_COL[group_by]
        sql = load_sql(sql_name).replace("{group_col}", col)
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
        data_inicio: str | None,
        data_fim: str | None,
    ) -> KpisResponse:
        codes = kpi_codes or ALL_KPIS
        params = dict(
            unidade=unidade,
            especialidade=especialidade,
            data_inicio=data_inicio,
            data_fim=data_fim,
        )
        results = [await self.compute(code, group_by, params) for code in codes]
        return KpisResponse(kpis=results)
