from datetime import date

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.providers.eventos_provider import EventosProvider
from pija.schemas.common import TipoEntidadeEnum
from pija.schemas.eventos_schema import EventosResponse


async def list_eventos(
    unidade: str | None = Query(None, description="Filtra por unidade funcional. Ex: `AMBULATORIO X`"),
    especialidade: str | None = Query(None, description="Filtra por especialidade médica. Ex: `CARDIOLOGIA`"),
    tipo_entidade: TipoEntidadeEnum | None = Query(None, description="Filtra por tipo de evento clínico."),
    data_inicio: date | None = Query(None, description="Data de início do recorte temporal (inclusiva). Formato: `YYYY-MM-DD`"),
    data_fim: date | None = Query(None, description="Data de fim do recorte temporal (inclusiva). Formato: `YYYY-MM-DD`"),
    limit: int = Query(50, ge=1, le=500, description="Número máximo de registros por página. Mínimo: 1, Máximo: 500."),
    offset: int = Query(0, ge=0, description="Número de registros a pular (para paginação). Use em conjunto com `limit`."),
    session: AsyncSession = Depends(get_db),
) -> EventosResponse:
    provider = EventosProvider(session)
    return await provider.list_eventos(
        unidade=unidade,
        especialidade=especialidade,
        tipo_entidade=tipo_entidade.value if tipo_entidade else None,
        data_inicio=data_inicio.isoformat() if data_inicio else None,
        data_fim=data_fim.isoformat() if data_fim else None,
        limit=limit,
        offset=offset,
    )
