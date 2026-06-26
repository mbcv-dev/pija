from datetime import date

from fastapi import Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.providers.gargalos_provider import GargalosProvider
from pija.providers.kpis_provider import ALL_KPIS
from pija.schemas.common import GroupBy
from pija.schemas.gargalos_schema import GargalosResponse


async def get_gargalos(
    kpi_codes: list[str] | None = Query(None, description="Transições a considerar (repita o parâmetro). Default: KPI-03, KPI-05, KPI-06, KPI-07."),
    group_by: GroupBy = Query(GroupBy.unidade, description="Dimensão ranqueada: `unidade` (default) ou `especialidade`."),
    unidade: str | None = Query(None, description="Filtra o ranking para uma unidade específica. Ex: `AMBULATORIO X`"),
    especialidade: str | None = Query(None, description="Filtra o ranking para uma especialidade específica. Ex: `CARDIOLOGIA`"),
    grupo: str | None = Query(None, description="Restringe a um grupo assistencial. Ex: `Ambulatorial`, `Internação`."),
    data_inicio: date | None = Query(None, description="Considera apenas eventos a partir desta data. Formato: `YYYY-MM-DD`"),
    data_fim: date | None = Query(None, description="Considera apenas eventos até esta data. Formato: `YYYY-MM-DD`"),
    limit: int = Query(10, ge=1, le=100, description="Tamanho do ranking (top-N). Default: 10."),
    session: AsyncSession = Depends(get_db),
) -> GargalosResponse:
    if kpi_codes:
        invalidos = [c for c in kpi_codes if c not in ALL_KPIS]
        if invalidos:
            raise HTTPException(status_code=400, detail=f"kpi_codes inválidos: {invalidos}")
    provider = GargalosProvider(session)
    return await provider.get_gargalos(
        kpi_codes=kpi_codes,
        group_by=group_by,
        unidade=unidade,
        especialidade=especialidade,
        grupo=grupo,
        data_inicio=data_inicio.isoformat() if data_inicio else None,
        data_fim=data_fim.isoformat() if data_fim else None,
        limit=limit,
    )
