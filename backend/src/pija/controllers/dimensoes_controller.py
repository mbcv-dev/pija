from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.providers.dimensoes_provider import DimensoesProvider
from pija.schemas.dimensoes_schema import DimensoesResponse


async def get_dimensoes(
    unidade: list[str] | None = Query(
        None,
        description="Se informado (repetível), devolve apenas as especialidades daquelas unidades; grupos/unidades voltam vazios.",
    ),
    grupo: list[str] | None = Query(
        None,
        description="Se informado (repetível), escopa unidades e especialidades àqueles grupos assistenciais.",
    ),
    session: AsyncSession = Depends(get_db),
) -> DimensoesResponse:
    return await DimensoesProvider(session).get_dimensoes(unidade=unidade, grupo=grupo)
