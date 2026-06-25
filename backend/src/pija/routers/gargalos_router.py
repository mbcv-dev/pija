from fastapi import APIRouter

from pija.controllers.gargalos_controller import get_gargalos
from pija.schemas.gargalos_schema import GargalosResponse

router = APIRouter(tags=["gargalos"])
router.add_api_route(
    "/gargalos",
    get_gargalos,
    methods=["GET"],
    response_model=GargalosResponse,
    summary="Ranking de gargalos no atendimento",
    description=(
        "Identifica as unidades e especialidades com maior tempo médio de espera entre eventos, "
        "ordenadas do gargalo mais crítico para o menos crítico.\n\n"
        "Use o filtro `tipo_entidade` para focar em um tipo específico de evento "
        "(ex.: apenas `CONSULTA` ou apenas `INTERNACAO`).\n\n"
        "O campo `n` indica o volume de pares de eventos considerados no cálculo — "
        "valores baixos de `n` devem ser interpretados com cautela."
    ),
    response_description="Ranking de gargalos ordenado por maior tempo médio de espera",
)
