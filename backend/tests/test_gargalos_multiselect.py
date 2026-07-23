import pytest

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
        assert set(i.dimensao for i in duas.items) <= {a, b}

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
