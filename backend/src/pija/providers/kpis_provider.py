from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import load_sql
from pija.schemas.kpis_schema import KpiResult, KpisResponse

_KPI_05_AVISO = "Aguardando confirmação HC sobre range temporal dos dados de exame"
_KPI_07_AVISO = "Inclui período entre alta médica e liberação do leito (relevante em obstetrícia)"


class KpisProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _run(self, sql: str, params: dict) -> tuple[float | None, int | None]:
        row = await self._session.execute(text(sql), params)
        r = row.one()
        media = float(r.media_dias) if r.media_dias is not None else None
        n = int(r.n) if r.n is not None else None
        return media, n

    async def get_kpis(
        self,
        *,
        grupo: str | None,
        especialidade: str | None,
        data_inicio: str | None,
        data_fim: str | None,
    ) -> KpisResponse:
        params = dict(
            grupo=grupo,
            especialidade=especialidade,
            data_inicio=data_inicio,
            data_fim=data_fim,
        )
        filtros = dict(
            grupo=grupo,
            especialidade=especialidade,
            data_inicio=data_inicio,
            data_fim=data_fim,
        )

        m01, n01 = await self._run(load_sql("kpis/kpi_01.sql"), params)
        m03, n03 = await self._run(load_sql("kpis/kpi_03.sql"), params)
        m06, n06 = await self._run(load_sql("kpis/kpi_06.sql"), params)
        m07, n07 = await self._run(load_sql("kpis/kpi_07.sql"), params)

        return KpisResponse(
            filtros_aplicados=filtros,
            kpis=[
                KpiResult(codigo="KPI-01", descricao="Prontuário → 1º evento", media_dias=m01, n=n01),
                KpiResult(codigo="KPI-03", descricao="Agendamento → realização (consulta)", media_dias=m03, n=n03),
                KpiResult(
                    codigo="KPI-05",
                    descricao="Solicitação → realização (exame)",
                    media_dias=None,
                    n=None,
                    aviso=_KPI_05_AVISO,
                ),
                KpiResult(codigo="KPI-06", descricao="Última consulta → internação subsequente", media_dias=m06, n=n06),
                KpiResult(codigo="KPI-07", descricao="Tempo de permanência no leito", media_dias=m07, n=n07, aviso=_KPI_07_AVISO),
            ],
        )
