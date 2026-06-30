from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import load_sql
from pija.schemas.eventos_schema import EventoItem, EventosResponse


class EventosProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._sql = load_sql("eventos_filtrados.sql")
        self._count_sql = load_sql("eventos_count.sql")

    async def list_eventos(
        self,
        *,
        paciente_id: str | None,
        unidade: str | None,
        especialidade: str | None,
        tipo_entidade: str | None,
        data_inicio: str | None,
        data_fim: str | None,
        limit: int,
        offset: int,
    ) -> EventosResponse:
        params = dict(
            paciente_id=paciente_id,
            unidade=unidade,
            especialidade=especialidade,
            tipo_entidade=tipo_entidade,
            data_inicio=data_inicio,
            data_fim=data_fim,
        )
        count_row = await self._session.execute(text(self._count_sql), params)
        total = count_row.scalar() or 0

        rows = await self._session.execute(
            text(self._sql), {**params, "limit": limit, "offset": offset}
        )
        items = [EventoItem(**dict(r._mapping)) for r in rows]
        return EventosResponse(items=items, total=total, limit=limit, offset=offset)
