from datetime import date

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.providers.ciclicidade_provider import CiclicidadeProvider
from pija.schemas.ciclicidade_schema import CiclicidadeResponse
from pija.sql_filtros import Filtros


async def get_ciclicidade(
    paciente_id: str | None = Query(None, description="Se preenchido, restringe a coorte a um único paciente (escopo individual)."),
    unidade: list[str] | None = Query(None, description="Coorte: pacientes que passaram por uma ou mais unidades (repita o parâmetro)."),
    especialidade: list[str] | None = Query(None, description="Coorte: pacientes que passaram por uma ou mais especialidades (repita o parâmetro)."),
    grupo: list[str] | None = Query(None, description="Coorte: pacientes de um ou mais grupos assistenciais (repita o parâmetro)."),
    data_inicio: date | None = Query(None, description="Coorte: eventos a partir desta data. Formato: `YYYY-MM-DD`."),
    data_fim: date | None = Query(None, description="Coorte: eventos até esta data. Formato: `YYYY-MM-DD`."),
    session: AsyncSession = Depends(get_db),
) -> CiclicidadeResponse:
    filtros = Filtros(
        unidade=unidade,
        especialidade=especialidade,
        grupo=grupo,
        data_inicio=data_inicio.isoformat() if data_inicio else None,
        data_fim=data_fim.isoformat() if data_fim else None,
    )
    return await CiclicidadeProvider(session).get_transicoes(
        filtros=filtros, paciente_id=paciente_id
    )
