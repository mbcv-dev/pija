from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.providers.dimensoes_provider import DimensoesProvider
from pija.schemas.dimensoes_schema import DimensoesResponse


async def get_dimensoes(session: AsyncSession = Depends(get_db)) -> DimensoesResponse:
    return await DimensoesProvider(session).get_dimensoes()
