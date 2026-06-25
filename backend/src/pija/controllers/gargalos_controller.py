from datetime import date

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.providers.gargalos_provider import GargalosProvider
from pija.schemas.common import TipoEntidadeEnum
from pija.schemas.gargalos_schema import GargalosResponse


async def get_gargalos(
    grupo: str | None = Query(None, description="Filtra o ranking para uma grupo funcional específica. Ex: `ONCOLOGIA`"),
    especialidade: str | None = Query(None, description="Filtra o ranking para uma especialidade específica. Ex: `ONCOLOGIA CLÍNICA`"),
    tipo_entidade: TipoEntidadeEnum | None = Query(None, description="Filtra por tipo de evento para focar o gargalo. Ex: `CONSULTA` mostra filas de consulta."),
    data_inicio: date | None = Query(None, description="Considera apenas eventos a partir desta data. Formato: `YYYY-MM-DD`", example="2023-01-01"),
    data_fim: date | None = Query(None, description="Considera apenas eventos até esta data. Formato: `YYYY-MM-DD`", example="2023-12-31"),
    session: AsyncSession = Depends(get_db),
) -> GargalosResponse:
    provider = GargalosProvider(session)
    return await provider.get_gargalos(
        grupo=grupo,
        especialidade=especialidade,
        tipo_entidade=tipo_entidade.value if tipo_entidade else None,
        data_inicio=data_inicio.isoformat() if data_inicio else None,
        data_fim=data_fim.isoformat() if data_fim else None,
    )
