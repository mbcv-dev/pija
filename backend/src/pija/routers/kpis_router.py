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
        "Calcula os 5 KPIs de tempo médio que medem a eficiência da jornada assistencial.\n\n"
        "| Código | O que mede |\n"
        "|--------|------------|\n"
        "| KPI-01 | Dias entre abertura do prontuário e o 1º evento clínico |\n"
        "| KPI-03 | Dias entre agendamento e realização da consulta |\n"
        "| KPI-05 | Dias entre solicitação e realização do exame *(pendente confirmação HC)* |\n"
        "| KPI-06 | Dias entre a última consulta e a internação subsequente |\n"
        "| KPI-07 | Dias de permanência no leito (inclui período pós-alta médica) |\n\n"
        "Todos os filtros são opcionais. Sem filtros, o cálculo considera toda a base."
    ),
    response_description="Lista dos 5 KPIs com média em dias, volume de registros e avisos quando aplicável",
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
