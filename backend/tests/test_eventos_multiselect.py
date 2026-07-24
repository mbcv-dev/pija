from pija.providers.eventos_provider import EventosProvider
from pija.sql_filtros import Filtros


class TestEventosMultiselect:
    async def test_sem_filtro_retorna_eventos(self, fixture_db_session):
        r = await EventosProvider(fixture_db_session).list_eventos(
            paciente_id=None, tipo_entidade=None, filtros=Filtros(), limit=50, offset=0
        )
        assert r.total > 0

    async def test_filtra_por_duas_unidades(self, fixture_db_session):
        p = EventosProvider(fixture_db_session)
        todos = await p.list_eventos(
            paciente_id=None, tipo_entidade=None, filtros=Filtros(), limit=500, offset=0
        )
        unidades = [u for u in dict.fromkeys(i.unidade for i in todos.items) if u]
        assert len(unidades) >= 2, "fixture precisa de 2+ unidades em eventos"
        a, b = unidades[0], unidades[1]
        duas = await p.list_eventos(
            paciente_id=None, tipo_entidade=None,
            filtros=Filtros(unidade=[a, b]), limit=500, offset=0,
        )
        assert set(i.unidade for i in duas.items) == {a, b}
        assert duas.total == len(duas.items)

    async def test_lista_vazia_equivale_a_sem_filtro(self, fixture_db_session):
        p = EventosProvider(fixture_db_session)
        vazio = await p.list_eventos(
            paciente_id=None, tipo_entidade=None, filtros=Filtros(unidade=[]), limit=50, offset=0
        )
        todos = await p.list_eventos(
            paciente_id=None, tipo_entidade=None, filtros=Filtros(), limit=50, offset=0
        )
        assert vazio.total == todos.total

    async def test_filtra_por_grupo(self, fixture_db_session):
        p = EventosProvider(fixture_db_session)
        # Fixture: 6 eventos CONSULTA com grupo="Ambulatorial" (conftest.py).
        r = await p.list_eventos(
            paciente_id=None, tipo_entidade=None,
            filtros=Filtros(grupo=["Ambulatorial"]), limit=500, offset=0,
        )
        assert r.total == 6
        assert all(i.tipo_evento or True for i in r.items)  # sanity: items existem
        # Todos os eventos retornados devem ser as CONSULTAS (as únicas com esse grupo).
        assert all(evt_id.startswith("C-") for evt_id in [i.evento_id for i in r.items])

    async def test_combina_paciente_id_com_multiselect(self, fixture_db_session):
        p = EventosProvider(fixture_db_session)
        # Paciente 001 tem eventos em CARDIOLOGIA (AMBULATÓRIO) e 9º NORTE (conftest.py).
        r = await p.list_eventos(
            paciente_id="001", tipo_entidade=None,
            filtros=Filtros(unidade=["CARDIOLOGIA (AMBULATÓRIO)"]), limit=500, offset=0,
        )
        assert r.total == 2  # C-001, C-006
        assert all(i.paciente_id == "001" for i in r.items)
        assert all(i.unidade == "CARDIOLOGIA (AMBULATÓRIO)" for i in r.items)

    async def test_total_reflete_filtro_mesmo_com_limit_menor(self, fixture_db_session):
        p = EventosProvider(fixture_db_session)
        r = await p.list_eventos(
            paciente_id=None, tipo_entidade=None,
            filtros=Filtros(grupo=["Ambulatorial"]), limit=2, offset=0,
        )
        assert len(r.items) == 2
        assert r.total == 6
