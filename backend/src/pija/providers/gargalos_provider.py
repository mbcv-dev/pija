from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import load_sql
from pija.schemas.gargalos_schema import GargaloItem, GargalosResponse


class GargalosProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._sql = load_sql("gargalos.sql")

    async def get_gargalos(
        self,
        *,
        grupo: str | None,
        especialidade: str | None,
        tipo_entidade: str | None,
        data_inicio: str | None,
        data_fim: str | None,
    ) -> GargalosResponse:
        params = dict(
            grupo=grupo,
            especialidade=especialidade,
            tipo_entidade=tipo_entidade,
            data_inicio=data_inicio,
            data_fim=data_fim,
        )
        rows = await self._session.execute(text(self._sql), params)
        ranking = [
            GargaloItem(
                tipo_entidade=r.tipo_entidade,
                grupo=r.grupo,
                especialidade=r.especialidade,
                media_espera_dias=float(r.media_espera_dias),
                n=int(r.n),
            )
            for r in rows
        ]
        filtros = dict(
            grupo=grupo,
            especialidade=especialidade,
            tipo_entidade=tipo_entidade,
            data_inicio=data_inicio,
            data_fim=data_fim,
        )
        return GargalosResponse(filtros_aplicados=filtros, ranking=ranking)
