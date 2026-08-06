from pija.providers.gargalos_provider import GargalosProvider
from pija.schemas.common import GroupBy
from pija.sql_filtros import Filtros


class TestGargalosMultiselect:
    async def test_sem_filtro_retorna_itens(self, fixture_db_session):
        r = await GargalosProvider(fixture_db_session).get_gargalos(
            kpi_codes=None, group_by=GroupBy.unidade, filtros=Filtros(), limit=10
        )
        assert len(r.items) > 0

    async def test_filtra_por_varias_unidades(self, fixture_db_session):
        p = GargalosProvider(fixture_db_session)
        todos = await p.get_gargalos(
            kpi_codes=None, group_by=GroupBy.unidade, filtros=Filtros(), limit=100
        )
        dims = list(dict.fromkeys(i.dimensao for i in todos.items))
        assert len(dims) >= 2, "fixture precisa de 2+ dimensões em gargalos"
        a, b = dims[0], dims[1]
        duas = await p.get_gargalos(
            kpi_codes=None, group_by=GroupBy.unidade, filtros=Filtros(unidade=[a, b]), limit=100
        )
        assert set(i.dimensao for i in duas.items) == {a, b}

    async def test_filtro_unidade_unica_equivale_ao_comportamento_escalar_antigo(self, fixture_db_session):
        p = GargalosProvider(fixture_db_session)
        # "9º NORTE" era o valor usado no antigo comportamento escalar (unidade="9º NORTE").
        r = await p.get_gargalos(
            kpi_codes=None, group_by=GroupBy.unidade, filtros=Filtros(unidade=["9º NORTE"]), limit=10
        )
        got = [(i.transicao, i.dimensao, round(i.media, 2)) for i in r.items]
        assert got == [
            ("KPI-06", "9º NORTE", 13.5),
            ("KPI-07", "9º NORTE", 4.0),
        ]

    async def test_filtro_vazio_e_lista_vazia_sao_equivalentes(self, fixture_db_session):
        p = GargalosProvider(fixture_db_session)
        sem_filtro = await p.get_gargalos(
            kpi_codes=None, group_by=GroupBy.unidade, filtros=Filtros(), limit=100
        )
        lista_vazia = await p.get_gargalos(
            kpi_codes=None, group_by=GroupBy.unidade, filtros=Filtros(unidade=[]), limit=100
        )
        got_a = [(i.transicao, i.dimensao, round(i.media, 2)) for i in sem_filtro.items]
        got_b = [(i.transicao, i.dimensao, round(i.media, 2)) for i in lista_vazia.items]
        assert got_a == got_b

    # --- Teste HTTP: prova que a rota real decodifica ?unidade=A&unidade=B em list[str] ---

    async def test_http_get_gargalos_aceita_unidade_repetida_e_restringe(self, client):
        # "9º NORTE" (KPI-06 13.5, KPI-07 4.0) e "CARDIOLOGIA (AMBULATÓRIO)" (KPI-03 10.0)
        # são dimensões reais do ranking sem filtro (ver test_ranking_completo_determinista).
        r_um = await client.get(
            "/api/v1/gargalos", params=[("unidade", "9º NORTE")]
        )
        r_dois = await client.get(
            "/api/v1/gargalos",
            params=[
                ("unidade", "9º NORTE"),
                ("unidade", "CARDIOLOGIA (AMBULATÓRIO)"),
            ],
        )
        assert r_um.status_code == 200
        assert r_dois.status_code == 200

        itens_um = r_um.json()["items"]
        itens_dois = r_dois.json()["items"]

        assert {i["dimensao"] for i in itens_um} == {"9º NORTE"}
        assert len(itens_um) == 2

        assert {i["dimensao"] for i in itens_dois} == {"9º NORTE", "CARDIOLOGIA (AMBULATÓRIO)"}
        assert len(itens_dois) > len(itens_um)
