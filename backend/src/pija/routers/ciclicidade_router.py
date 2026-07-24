from fastapi import APIRouter

from pija.controllers.ciclicidade_controller import get_ciclicidade
from pija.schemas.ciclicidade_schema import CiclicidadeResponse

router = APIRouter(tags=["ciclicidade"])
router.add_api_route(
    "/ciclicidade/transicoes",
    get_ciclicidade,
    methods=["GET"],
    response_model=CiclicidadeResponse,
    summary="Fluxo de transições entre etapas da jornada",
    description=(
        "Conta as transições evento→próximo-evento por paciente e agrega em nós (etapas) "
        "e arestas (transições origem→destino), com volume e tempo médio.\n\n"
        "**Coorte:** os filtros — inclusive `data_inicio`/`data_fim` — selecionam *quais* "
        "pacientes entram (paciente com ≥1 evento na janela); contam-se **todas** as "
        "transições da história completa desses pacientes, não só as dentro da janela de datas. "
        "Informe `paciente_id` para o escopo individual."
    ),
    response_description="Nós e transições do fluxo agregado (ou de um paciente).",
)
