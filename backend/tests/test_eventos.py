import pytest
from pija.providers.eventos_provider import EventosProvider


class TestEventosProvider:
    async def test_total_sem_filtros(self, fixture_db_session):
        provider = EventosProvider(fixture_db_session)
        result = await provider.list_eventos(
            grupo=None, especialidade=None, tipo_entidade=None,
            data_inicio=None, data_fim=None, limit=100, offset=0,
        )
        assert result.total == 15

    async def test_filtra_por_unidade(self, fixture_db_session):
        provider = EventosProvider(fixture_db_session)
        result = await provider.list_eventos(
            grupo="CARDIOLOGIA", especialidade=None, tipo_entidade=None,
            data_inicio=None, data_fim=None, limit=100, offset=0,
        )
        assert result.total == 5  # 3 consultas + 2 internacoes CARDIOLOGIA

    async def test_filtra_por_tipo_entidade(self, fixture_db_session):
        provider = EventosProvider(fixture_db_session)
        result = await provider.list_eventos(
            grupo=None, especialidade=None, tipo_entidade="CONSULTA",
            data_inicio=None, data_fim=None, limit=100, offset=0,
        )
        assert result.total == 5

    async def test_paginacao_sem_sobreposicao(self, fixture_db_session):
        provider = EventosProvider(fixture_db_session)
        p1 = await provider.list_eventos(
            grupo=None, especialidade=None, tipo_entidade=None,
            data_inicio=None, data_fim=None, limit=8, offset=0,
        )
        p2 = await provider.list_eventos(
            grupo=None, especialidade=None, tipo_entidade=None,
            data_inicio=None, data_fim=None, limit=8, offset=8,
        )
        assert len(p1.items) == 8
        assert len(p2.items) == 7
        assert {e.evento_id for e in p1.items}.isdisjoint({e.evento_id for e in p2.items})

    async def test_filtra_por_periodo(self, fixture_db_session):
        provider = EventosProvider(fixture_db_session)
        result = await provider.list_eventos(
            grupo=None, especialidade=None, tipo_entidade="CONSULTA",
            data_inicio="2024-01-10", data_fim="2024-01-15",
            limit=100, offset=0,
        )
        # C-001 (jan-10), C-005 (jan-11), C-002 (jan-15) — C-004 jan-08 excluída, C-003 jan-21 excluída
        assert result.total == 3
