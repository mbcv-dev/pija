from fastapi import Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.deps.filtros_dep import filtros_comuns
from pija.providers.kpis_provider import ALL_KPIS, KpisProvider
from pija.schemas.common import GroupBy
from pija.schemas.kpis_schema import DistribuicoesResponse, KpisResponse
from pija.sql_filtros import Filtros


def _validar_kpi_codes(kpi_codes: list[str] | None) -> None:
    """400 em código desconhecido — mesma regra dos dois endpoints."""
    if kpi_codes:
        invalidos = [c for c in kpi_codes if c not in ALL_KPIS]
        if invalidos:
            raise HTTPException(status_code=400, detail=f"kpi_codes inválidos: {invalidos}")


async def get_kpis(
    kpi_codes: list[str] | None = Query(None, description="Subconjunto de KPIs a retornar (repita o parâmetro). Default: todos."),
    group_by: GroupBy = Query(GroupBy.unidade, description="Dimensão do breakdown: `unidade` (default) ou `especialidade`."),
    filtros: Filtros = Depends(filtros_comuns),
    session: AsyncSession = Depends(get_db),
) -> KpisResponse:
    _validar_kpi_codes(kpi_codes)
    return await KpisProvider(session).get_kpis(kpi_codes=kpi_codes, group_by=group_by, filtros=filtros)


async def get_distribuicoes(
    kpi_codes: list[str] | None = Query(None, description="Subconjunto de KPIs a retornar (repita o parâmetro). Default: todos."),
    filtros: Filtros = Depends(filtros_comuns),
    session: AsyncSession = Depends(get_db),
) -> DistribuicoesResponse:
    # Sem group_by: a distribuição não tem breakdown por dimensão, só o histograma global.
    _validar_kpi_codes(kpi_codes)
    return await KpisProvider(session).get_distribuicoes(kpi_codes=kpi_codes, filtros=filtros)
