from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import load_sql
from pija.schemas.eventos_schema import EventoItem, EventosResponse
from pija.sql_filtros import Filtros, build_filtros


class EventosProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._sql = load_sql("eventos_filtrados.sql")
        self._count_sql = load_sql("eventos_count.sql")

    async def list_eventos(
        self,
        *,
        paciente_id: str | None,
        tipo_entidade: str | None,
        filtros: Filtros,
        limit: int,
        offset: int,
    ) -> EventosResponse:
        frag, fparams = build_filtros(filtros)
        params = {
            **fparams,
            "paciente_id": paciente_id,
            "tipo_entidade": tipo_entidade,
            "data_inicio": filtros.data_inicio,
            "data_fim": filtros.data_fim,
        }
        count_sql = self._count_sql.replace("{filtros}", frag)
        total = (await self._session.execute(text(count_sql), params)).scalar() or 0

        sql = self._sql.replace("{filtros}", frag)
        rows = await self._session.execute(
            text(sql), {**params, "limit": limit, "offset": offset}
        )
        items = [EventoItem(**dict(r._mapping)) for r in rows]
        return EventosResponse(items=items, total=total, limit=limit, offset=offset)
