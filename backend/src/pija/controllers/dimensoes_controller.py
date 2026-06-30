from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.providers.dimensoes_provider import DimensoesProvider
from pija.schemas.dimensoes_schema import DimensoesResponse


async def get_dimensoes(
    unidade: str | None = Query(
        None,
        description="Se informado, devolve apenas as especialidades daquela unidade (filtro em cascata); grupos/unidades voltam vazios.",
    ),
    session: AsyncSession = Depends(get_db),
) -> DimensoesResponse:
    return await DimensoesProvider(session).get_dimensoes(unidade=unidade)
