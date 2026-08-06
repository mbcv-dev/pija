from fastapi import APIRouter

from pija.controllers.kpis_controller import get_distribuicoes, get_kpis
from pija.schemas.kpis_schema import DistribuicoesResponse, KpisResponse

router = APIRouter(tags=["kpis"])
router.add_api_route(
    "/kpis/tempos-medios",
    get_kpis,
    methods=["GET"],
    response_model=KpisResponse,
    summary="Tempos médios da jornada (KPIs)",
    description=(
        "Calcula os KPIs de tempo que medem a eficiência da jornada assistencial.\n\n"
        "O valor reportado é a **mediana**, não a média — as distribuições têm cauda longa e a "
        "média era puxada por outliers extremos. O campo continua se chamando `media_global` por "
        "compatibilidade.\n\n"
        "| Código | O que mede | Unidade |\n"
        "|--------|------------|---------|\n"
        "| KPI-01 | Da abertura do prontuário ao 1º evento clínico | dias |\n"
        "| KPI-03 | Do agendamento à realização da consulta | dias |\n"
        "| KPI-05 | Da solicitação à liberação do resultado do exame | dias |\n"
        "| KPI-06 | Da última consulta à internação subsequente | dias |\n"
        "| KPI-07 | Permanência no leito (inclui período pós-alta médica) | dias |\n"
        "| KPI-07B | Da alta médica à saída do leito — submétrica do KPI-07 | horas |\n"
        "| KPI-10 | Do início ao fim da cirurgia, só cirurgias realizadas | horas |\n"
        "| KPI-10B | Da entrada na sala ao início da cirurgia — submétrica do KPI-10 | horas |\n\n"
        "Todos os filtros são opcionais. Sem filtros, o cálculo considera toda a base."
    ),
    response_description=(
        "Lista dos KPIs com a mediana na unidade de cada um, volume de registros e avisos "
        "quando aplicável"
    ),
)
router.add_api_route(
    "/kpis/distribuicoes",
    get_distribuicoes,
    methods=["GET"],
    response_model=DistribuicoesResponse,
    summary="Distribuição dos tempos por KPI (histograma)",
    description=(
        "Histograma dos tempos de cada KPI: baldes lineares de 0 até um teto, mais um balde de "
        "cauda aberta (>= teto) para os casos acima dele. O teto é normalmente o p95, mas cai no "
        "valor máximo quando o p95 é 0 (caso em que 95%+ dos casos estão zerados, ex.: KPI-07B) — "
        "senão a cauda, que é o objeto do histograma, desapareceria. Mostra a cauda que a mediana "
        "do /tempos-medios esconde. Mesmos filtros do /tempos-medios, sem group_by: a distribuição "
        "não tem breakdown por dimensão."
    ),
    response_description="Uma distribuição (baldes + p50/p95/teto) por KPI solicitado",
)
