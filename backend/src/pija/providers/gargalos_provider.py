"""Provider de gargalos: ranking combinado (dimensão × transição).

Reusa o breakdown de cada KPI (KpisProvider.compute), marca a transição,
concatena, ordena por média DESC (desempate por transicao, dimensao) e corta
top-N. Não tem SQL próprio — impossível divergir dos números dos KPIs.
"""
from sqlalchemy.ext.asyncio import AsyncSession

from pija.providers.kpis_provider import KpisProvider
from pija.schemas.common import GroupBy
from pija.schemas.gargalos_schema import GargaloItem, GargalosResponse
from pija.sql_filtros import Filtros

# Transições com dimensão clara (KPI-01 só entra se pedido explicitamente).
DEFAULT_GARGALO_CODES = ["KPI-03", "KPI-05", "KPI-06", "KPI-07"]


class GargalosProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._kpis = KpisProvider(session)

    async def get_gargalos(
        self,
        *,
        kpi_codes: list[str] | None,
        group_by: GroupBy,
        filtros: Filtros,
        limit: int,
    ) -> GargalosResponse:
        codes = kpi_codes or DEFAULT_GARGALO_CODES
        items: list[GargaloItem] = []
        for code in codes:
            result = await self._kpis.compute(code, group_by, filtros)
            for b in result.breakdown:
                items.append(
                    GargaloItem(
                        dimensao_tipo=group_by.value,
                        dimensao=b.dimensao,
                        transicao=code,
                        media=b.media,
                        n=b.n,
                    )
                )
        items.sort(key=lambda x: (-x.media, x.transicao, x.dimensao))
        return GargalosResponse(items=items[:limit])
