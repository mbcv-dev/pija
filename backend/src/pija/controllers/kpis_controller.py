from datetime import date

from fastapi import Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.providers.kpis_provider import ALL_KPIS, KpisProvider
from pija.schemas.common import GroupBy
from pija.schemas.kpis_schema import KpisResponse


async def get_kpis(
    kpi_codes: list[str] | None = Query(None, description="Subconjunto de KPIs a retornar (repita o parâmetro). Default: todos."),
    group_by: GroupBy = Query(GroupBy.unidade, description="Dimensão do breakdown: `unidade` (default) ou `especialidade`."),
    unidade: str | None = Query(None, description="Restringe o cálculo a uma unidade funcional. Ex: `AMBULATORIO X`"),
    especialidade: str | None = Query(None, description="Restringe o cálculo a uma especialidade. Ex: `CARDIOLOGIA`"),
    grupo: str | None = Query(None, description="Restringe a um grupo assistencial. Ex: `Ambulatorial`, `Internação`."),
    data_inicio: date | None = Query(None, description="Considera apenas eventos a partir desta data. Formato: `YYYY-MM-DD`"),
    data_fim: date | None = Query(None, description="Considera apenas eventos até esta data. Formato: `YYYY-MM-DD`"),
    session: AsyncSession = Depends(get_db),
) -> KpisResponse:
    if kpi_codes:
        invalidos = [c for c in kpi_codes if c not in ALL_KPIS]
        if invalidos:
            raise HTTPException(status_code=400, detail=f"kpi_codes inválidos: {invalidos}")
    provider = KpisProvider(session)
    return await provider.get_kpis(
        kpi_codes=kpi_codes,
        group_by=group_by,
        unidade=unidade,
        especialidade=especialidade,
        grupo=grupo,
        data_inicio=data_inicio.isoformat() if data_inicio else None,
        data_fim=data_fim.isoformat() if data_fim else None,
    )
