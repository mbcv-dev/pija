from fastapi import Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.deps.filtros_dep import filtros_comuns
from pija.providers.gargalos_provider import GargalosProvider
from pija.providers.kpis_provider import ALL_KPIS
from pija.schemas.common import GroupBy
from pija.schemas.gargalos_schema import GargalosResponse
from pija.sql_filtros import Filtros


async def get_gargalos(
    kpi_codes: list[str] | None = Query(None, description="Transições a considerar (repita o parâmetro). Default: KPI-03, KPI-05, KPI-06, KPI-07."),
    group_by: GroupBy = Query(GroupBy.unidade, description="Dimensão ranqueada: `unidade` (default) ou `especialidade`."),
    limit: int = Query(10, ge=1, le=100, description="Tamanho do ranking (top-N). Default: 10."),
    filtros: Filtros = Depends(filtros_comuns),
    session: AsyncSession = Depends(get_db),
) -> GargalosResponse:
    if kpi_codes:
        invalidos = [c for c in kpi_codes if c not in ALL_KPIS]
        if invalidos:
            raise HTTPException(status_code=400, detail=f"kpi_codes inválidos: {invalidos}")
    return await GargalosProvider(session).get_gargalos(
        kpi_codes=kpi_codes, group_by=group_by, filtros=filtros, limit=limit
    )
