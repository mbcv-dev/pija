from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import load_sql
from pija.schemas.dimensoes_schema import DimensoesResponse


class DimensoesProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._sql = load_sql("dimensoes.sql")
        self._esp_sql = load_sql("especialidades_unidade.sql")

    async def get_dimensoes(self, unidade: str | None = None) -> DimensoesResponse:
        # Cascata: com `unidade`, devolve só as especialidades daquela unidade
        # (grupos/unidades não mudam — o front mantém os já carregados).
        if unidade:
            rows = await self._session.execute(text(self._esp_sql), {"unidade": unidade})
            return DimensoesResponse(grupos=[], unidades=[], especialidades=[r[0] for r in rows])

        rows = await self._session.execute(text(self._sql))
        buckets: dict[str, list[str]] = {"grupo": [], "unidade": [], "especialidade": []}
        for tipo, valor in rows:
            buckets[tipo].append(valor)
        return DimensoesResponse(
            grupos=buckets["grupo"],
            unidades=buckets["unidade"],
            especialidades=buckets["especialidade"],
        )
