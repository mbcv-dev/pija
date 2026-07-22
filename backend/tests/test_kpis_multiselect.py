from pija.providers.kpis_provider import KpisProvider
from pija.schemas.common import GroupBy
from pija.sql_filtros import Filtros


class TestKpisMultiselect:
    async def test_sem_filtro_retorna_tudo(self, fixture_db_session):
        r = await KpisProvider(fixture_db_session).compute("KPI-03", GroupBy.unidade, Filtros())
        assert r.n_global > 0

    async def test_filtro_por_uma_unidade(self, fixture_db_session):
        p = KpisProvider(fixture_db_session)
        todos = await p.compute("KPI-03", GroupBy.unidade, Filtros())
        alvo = todos.breakdown[0].dimensao
        um = await p.compute("KPI-03", GroupBy.unidade, Filtros(unidade=[alvo]))
        assert [b.dimensao for b in um.breakdown] == [alvo]

    async def test_duas_unidades_somam_as_duas(self, fixture_db_session):
        p = KpisProvider(fixture_db_session)
        todos = await p.compute("KPI-03", GroupBy.unidade, Filtros())
        assert len(todos.breakdown) >= 2, "fixture precisa de 2+ unidades no KPI-03"
        a, b = todos.breakdown[0].dimensao, todos.breakdown[1].dimensao
        duas = await p.compute("KPI-03", GroupBy.unidade, Filtros(unidade=[a, b]))
        assert set(d.dimensao for d in duas.breakdown) == {a, b}

    async def test_lista_vazia_equivale_a_sem_filtro(self, fixture_db_session):
        p = KpisProvider(fixture_db_session)
        vazio = await p.compute("KPI-03", GroupBy.unidade, Filtros(unidade=[]))
        todos = await p.compute("KPI-03", GroupBy.unidade, Filtros())
        assert vazio.n_global == todos.n_global

    async def test_kpi01_usa_prefixo_pd_sem_erro(self, fixture_db_session):
        # KPI-01 qualifica as colunas de dimensão com o alias `pd.` — regressão de prefixo.
        r = await KpisProvider(fixture_db_session).compute(
            "KPI-01", GroupBy.unidade, Filtros(grupo=["Ambulatorial"])
        )
        assert r.codigo == "KPI-01"

    async def test_grupo_do_usuario_intersecta_com_escopo_fixo_do_kpi(self, fixture_db_session):
        # KPI-03 tem escopo fixo [Ambulatorial]. Pedir só "Internação" => interseção vazia.
        r = await KpisProvider(fixture_db_session).compute(
            "KPI-03", GroupBy.unidade, Filtros(grupo=["Internação"])
        )
        assert r.n_global == 0
        assert r.media_global is None
