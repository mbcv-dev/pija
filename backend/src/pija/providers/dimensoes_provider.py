from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import load_sql
from pija.schemas.dimensoes_schema import DimensoesResponse


class DimensoesProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._sql = load_sql("dimensoes.sql")

    async def get_dimensoes(self) -> DimensoesResponse:
        rows = await self._session.execute(text(self._sql))
        buckets: dict[str, list[str]] = {"grupo": [], "unidade": [], "especialidade": []}
        for tipo, valor in rows:
            buckets[tipo].append(valor)
        return DimensoesResponse(
            grupos=buckets["grupo"],
            unidades=buckets["unidade"],
            especialidades=buckets["especialidade"],
        )
