from pija.providers.eventos_provider import EventosProvider

_BASE = dict(unidade=None, especialidade=None, tipo_entidade=None, data_inicio=None, data_fim=None)


async def _list(session, **over):
    provider = EventosProvider(session)
    params = dict(_BASE, limit=100, offset=0)
    params.update(over)
    return await provider.list_eventos(**params)


class TestEventosProvider:
    async def test_total_sem_filtros(self, fixture_db_session):
        result = await _list(fixture_db_session)
        assert result.total == 17

    async def test_filtra_por_unidade(self, fixture_db_session):
        result = await _list(fixture_db_session, unidade="CARDIOLOGIA")
        # 3 consultas + 2 internacoes + 1 exame CARDIOLOGIA
        assert result.total == 6

    async def test_filtra_por_tipo_entidade(self, fixture_db_session):
        result = await _list(fixture_db_session, tipo_entidade="CONSULTA")
        assert result.total == 5

    async def test_campos_nao_nulos_no_item(self, fixture_db_session):
        result = await _list(fixture_db_session, tipo_entidade="PRONTUARIO")
        item = result.items[0]
        # PRONTUARIO não tem unidade no fato → COALESCE devolve string vazia (não null)
        assert item.unidade == ""
        assert item.especialidade == ""
        assert item.entidade_id  # presente

    async def test_paginacao_sem_sobreposicao(self, fixture_db_session):
        p1 = await _list(fixture_db_session, limit=8, offset=0)
        p2 = await _list(fixture_db_session, limit=8, offset=8)
        assert len(p1.items) == 8
        assert len(p2.items) == 8  # 17 itens → 8 + 8 + 1
        assert {e.evento_id for e in p1.items}.isdisjoint({e.evento_id for e in p2.items})

    async def test_filtra_por_periodo(self, fixture_db_session):
        result = await _list(
            fixture_db_session, tipo_entidade="CONSULTA",
            data_inicio="2024-01-10", data_fim="2024-01-15",
        )
        # C-001 (jan-10), C-005 (jan-11), C-002 (jan-15)
        assert result.total == 3
