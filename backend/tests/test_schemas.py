import pytest
from pija.schemas.eventos_schema import EventoItem, EventosResponse
from pija.schemas.kpis_schema import KpiResult, KpisResponse
from pija.schemas.gargalos_schema import GargaloItem, GargalosResponse
from pija.schemas.common import TipoEntidadeEnum


def test_evento_item_valida_campos_obrigatorios():
    """EventoItem deve validar campos obrigatórios."""
    item = EventoItem(
        evento_id="C-001",
        paciente_id="001",
        tipo_entidade="CONSULTA",
        timestamp_principal="2024-01-10",
        grupo="CARDIOLOGIA",
        especialidade="CARDIOLOGIA",
        situacao=None,
    )
    assert item.evento_id == "C-001"


def test_kpi_result_aceita_none():
    """KpiResult deve aceitar None para media_dias e n."""
    kpi = KpiResult(
        codigo="KPI-05",
        descricao="Exame",
        media_dias=None,
        n=None,
        aviso="bloqueado",
    )
    assert kpi.media_dias is None
    assert kpi.n is None


def test_tipo_entidade_enum_valores():
    """TipoEntidadeEnum deve ter todos os tipos esperados."""
    assert TipoEntidadeEnum.CONSULTA == "CONSULTA"
    assert TipoEntidadeEnum.INTERNACAO == "INTERNACAO"
    assert TipoEntidadeEnum.PRONTUARIO == "PRONTUARIO"
    assert TipoEntidadeEnum.PROCEDIMENTO == "PROCEDIMENTO"
    assert TipoEntidadeEnum.EXAME == "EXAME"
    assert TipoEntidadeEnum.ALTA == "ALTA"
    assert TipoEntidadeEnum.CIRURGIA == "CIRURGIA"


def test_eventos_response_estrutura():
    """EventosResponse deve conter total, limit, offset e items."""
    response = EventosResponse(total=1, limit=10, offset=0, items=[])
    assert response.total == 1
    assert response.limit == 10
    assert response.offset == 0
    assert response.items == []


def test_kpis_response_estrutura():
    """KpisResponse deve conter filtros_aplicados e lista de kpis."""
    response = KpisResponse(filtros_aplicados={"unidade": "CARDIOLOGIA"}, kpis=[])
    assert response.filtros_aplicados == {"unidade": "CARDIOLOGIA"}
    assert response.kpis == []


def test_gargalos_response_estrutura():
    """GargalosResponse deve conter filtros_aplicados e ranking."""
    response = GargalosResponse(filtros_aplicados={}, ranking=[])
    assert response.filtros_aplicados == {}
    assert response.ranking == []


def test_gargalo_item_validacao():
    """GargaloItem deve validar campos númericos."""
    item = GargaloItem(
        tipo_entidade="CONSULTA",
        grupo="CARDIOLOGIA",
        especialidade="CARDIOLOGIA",
        media_espera_dias=5.5,
        n=100,
    )
    assert item.media_espera_dias == 5.5
    assert item.n == 100
