from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.deps.filtros_dep import filtros_comuns
from pija.providers.eventos_provider import EventosProvider
from pija.schemas.common import TipoEntidadeEnum
from pija.schemas.eventos_schema import EventosResponse
from pija.sql_filtros import Filtros


async def list_eventos(
    paciente_id: str | None = Query(None, description="Filtra todos os eventos de um paciente específico (número do prontuário). Usado pela Jornada do Paciente."),
    tipo_entidade: TipoEntidadeEnum | None = Query(None, description="Filtra por tipo de evento clínico."),
    limit: int = Query(50, ge=1, le=500, description="Número máximo de registros por página. Mínimo: 1, Máximo: 500."),
    offset: int = Query(0, ge=0, description="Número de registros a pular (para paginação). Use em conjunto com `limit`."),
    filtros: Filtros = Depends(filtros_comuns),
    session: AsyncSession = Depends(get_db),
) -> EventosResponse:
    return await EventosProvider(session).list_eventos(
        paciente_id=paciente_id,
        tipo_entidade=tipo_entidade.value if tipo_entidade else None,
        filtros=filtros,
        limit=limit,
        offset=offset,
    )
