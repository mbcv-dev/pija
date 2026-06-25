from datetime import date

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.providers.kpis_provider import KpisProvider
from pija.schemas.kpis_schema import KpisResponse


async def get_kpis(
    grupo: str | None = Query(None, description="Restringe o cálculo dos KPIs a uma grupo funcional. Ex: `ONCOLOGIA`"),
    especialidade: str | None = Query(None, description="Restringe o cálculo dos KPIs a uma especialidade. Ex: `ONCOLOGIA CLÍNICA`"),
    data_inicio: date | None = Query(None, description="Considera apenas eventos a partir desta data. Formato: `YYYY-MM-DD`", example="2023-01-01"),
    data_fim: date | None = Query(None, description="Considera apenas eventos até esta data. Formato: `YYYY-MM-DD`", example="2023-12-31"),
    session: AsyncSession = Depends(get_db),
) -> KpisResponse:
    provider = KpisProvider(session)
    return await provider.get_kpis(
        grupo=grupo,
        especialidade=especialidade,
        data_inicio=data_inicio.isoformat() if data_inicio else None,
        data_fim=data_fim.isoformat() if data_fim else None,
    )
