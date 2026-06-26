from pija.schemas.common import GroupBy, TipoEntidadeEnum
from pija.schemas.eventos_schema import EventoItem, EventosResponse
from pija.schemas.gargalos_schema import GargaloItem, GargalosResponse
from pija.schemas.kpis_schema import KpiBreakdownItem, KpiResult, KpisResponse


def test_evento_item_campos_do_contrato():
    item = EventoItem(
        evento_id="C-001",
        paciente_id="001",
        tipo_entidade="CONSULTA",
        entidade_id="C001",
        timestamp_principal="2026-01-10T09:00:00",
        unidade="CARDIOLOGIA",
        especialidade="CARDIOLOGIA",
        tipo_evento="",
        situacao="PACIENTE ATENDIDO",
    )
    assert item.evento_id == "C-001"
    assert item.entidade_id == "C001"
    assert item.unidade == "CARDIOLOGIA"


def test_kpi_result_global_e_breakdown():
    kpi = KpiResult(
        codigo="KPI-03",
        descricao="Agendamento → realização (consulta)",
        media_global=12.4,
        n_global=1200,
        breakdown=[KpiBreakdownItem(dimensao="CARDIOLOGIA", media=10.0, n=3)],
    )
    assert kpi.unidade_tempo == "dias"
    assert kpi.media_global == 12.4
    assert kpi.breakdown[0].dimensao == "CARDIOLOGIA"


def test_kpi_result_aceita_media_global_none():
    kpi = KpiResult(codigo="KPI-05", descricao="Exame", media_global=None, n_global=0, breakdown=[])
    assert kpi.media_global is None
    assert kpi.n_global == 0


def test_group_by_enum():
    assert GroupBy.unidade == "unidade"
    assert GroupBy.especialidade == "especialidade"


def test_tipo_entidade_enum_valores():
    assert TipoEntidadeEnum.CONSULTA == "CONSULTA"
    assert TipoEntidadeEnum.INTERNACAO == "INTERNACAO"
    assert TipoEntidadeEnum.PRONTUARIO == "PRONTUARIO"
    assert TipoEntidadeEnum.EXAME == "EXAME"


def test_eventos_response_estrutura():
    response = EventosResponse(items=[], total=1, limit=10, offset=0)
    assert response.total == 1
    assert response.items == []


def test_kpis_response_estrutura():
    response = KpisResponse(kpis=[])
    assert response.kpis == []


def test_gargalos_response_estrutura():
    response = GargalosResponse(items=[])
    assert response.items == []


def test_gargalo_item_validacao():
    item = GargaloItem(
        dimensao_tipo="unidade",
        dimensao="CARDIOLOGIA",
        transicao="KPI-03",
        media=5.5,
        n=100,
    )
    assert item.media == 5.5
    assert item.transicao == "KPI-03"
