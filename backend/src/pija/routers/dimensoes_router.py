from fastapi import APIRouter

from pija.controllers.dimensoes_controller import get_dimensoes
from pija.schemas.dimensoes_schema import DimensoesResponse

router = APIRouter(tags=["dimensoes"])
router.add_api_route(
    "/dimensoes",
    get_dimensoes,
    methods=["GET"],
    response_model=DimensoesResponse,
    summary="Valores distintos para filtros (grupo, unidade, especialidade)",
    description=(
        "Lista os valores reais presentes na base para popular os filtros do frontend "
        "(Grupo, Unidade executora, Especialidade). Unidades inativas (sufixo `INATIVO`) "
        "são omitidas. Os valores vêm ordenados alfabeticamente."
    ),
    response_description="Listas de grupos, unidades e especialidades distintos",
)
