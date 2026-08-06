from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.deps.filtros_dep import filtros_comuns
from pija.providers.ciclicidade_provider import CiclicidadeProvider
from pija.schemas.ciclicidade_schema import CiclicidadeResponse
from pija.sql_filtros import Filtros


async def get_ciclicidade(
    paciente_id: str | None = Query(None, description="Se preenchido, restringe a coorte a um único paciente (escopo individual)."),
    filtros: Filtros = Depends(filtros_comuns),
    session: AsyncSession = Depends(get_db),
) -> CiclicidadeResponse:
    # Aqui os filtros comuns delimitam a COORTE (quem entra no fluxo de transições),
    # não uma linha isolada — mesmo parâmetro, leitura diferente do resto da API.
    return await CiclicidadeProvider(session).get_transicoes(
        filtros=filtros, paciente_id=paciente_id
    )
