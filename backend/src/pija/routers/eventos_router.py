from fastapi import APIRouter

from pija.controllers.eventos_controller import list_eventos
from pija.schemas.eventos_schema import EventosResponse

router = APIRouter(tags=["eventos"])
router.add_api_route(
    "/eventos",
    list_eventos,
    methods=["GET"],
    response_model=EventosResponse,
    summary="Listar eventos da jornada",
    description=(
        "Retorna uma lista paginada de eventos clínicos registrados na jornada assistencial.\n\n"
        "Cada evento representa uma ocorrência de um paciente no sistema: "
        "abertura de prontuário, consulta, exame, internação, alta ou cirurgia.\n\n"
        "Todos os filtros são opcionais e combináveis entre si. "
        "Use `limit` e `offset` para paginar resultados grandes."
    ),
    response_description="Lista paginada de eventos com total de registros encontrados",
)
