import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from pija.main import app
from pija.providers.kpis_provider import KpisProvider
from pija.schemas.common import GroupBy
from pija.sql_filtros import Filtros


@pytest.fixture
async def client(async_engine, fixture_db_session):
    """HTTP client (ASGI/TestClient) apontando para o mesmo engine populado
    usado por `fixture_db_session` — permite exercitar a rota real /kpis."""
    app.state.session_factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


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

    # --- Cobertura de combinações (especialidade, AND entre campos, datas, group_by) ---
    # Valores esperados derivados do fixture em conftest.py (KPI-03/CONSULTA, KPI-07/INTERNACAO).

    async def test_especialidade_multiselecao_duas_especialidades(self, fixture_db_session):
        p = KpisProvider(fixture_db_session)
        # KPI-03: CARDIOLOGIA = C-001(10), C-002(10), C-005(10) -> n=3
        # ORTOPEDIA = C-003(9), C-004(7) -> n=2. Total (ambas) = 5.
        so_cardiologia = await p.compute("KPI-03", GroupBy.unidade, Filtros(especialidade=["CARDIOLOGIA"]))
        duas = await p.compute(
            "KPI-03", GroupBy.unidade, Filtros(especialidade=["CARDIOLOGIA", "ORTOPEDIA"])
        )
        todos = await p.compute("KPI-03", GroupBy.unidade, Filtros())
        assert so_cardiologia.n_global == 3
        assert duas.n_global == 5
        assert duas.n_global == todos.n_global

    async def test_unidade_e_especialidade_combinados_sao_and_nao_or(self, fixture_db_session):
        p = KpisProvider(fixture_db_session)
        # KPI-07 (INTERNACAO): I-001/I-002 = 9º NORTE + CARDIOLOGIA; I-003 = 10º SUL + ORTOPEDIA.
        so_unidade = await p.compute("KPI-07", GroupBy.unidade, Filtros(unidade=["9º NORTE"]))
        so_especialidade = await p.compute("KPI-07", GroupBy.unidade, Filtros(especialidade=["ORTOPEDIA"]))
        combinado = await p.compute(
            "KPI-07", GroupBy.unidade, Filtros(unidade=["9º NORTE"], especialidade=["ORTOPEDIA"])
        )
        assert so_unidade.n_global == 2  # I-001, I-002
        assert so_especialidade.n_global == 1  # I-003
        # Se fosse OR, o combinado teria as 3 internações; sendo AND, a interseção é vazia
        # (9º NORTE só tem casos CARDIOLOGIA, nunca ORTOPEDIA).
        assert combinado.n_global == 0
        assert combinado.media_global is None

    async def test_multiselecao_combinada_com_intervalo_de_datas(self, fixture_db_session):
        p = KpisProvider(fixture_db_session)
        # KPI-03, unidade=CARDIOLOGIA (AMBULATÓRIO): C-001(principal 01-10), C-002(01-15), C-005(01-11).
        sem_data = await p.compute(
            "KPI-03", GroupBy.unidade, Filtros(unidade=["CARDIOLOGIA (AMBULATÓRIO)"])
        )
        com_data = await p.compute(
            "KPI-03",
            GroupBy.unidade,
            Filtros(
                unidade=["CARDIOLOGIA (AMBULATÓRIO)"],
                data_inicio="2024-01-11",
                data_fim="2024-01-15",
            ),
        )
        assert sem_data.n_global == 3  # C-001, C-002, C-005
        # data_inicio=01-11 exclui C-001 (principal 01-10); C-002 e C-005 permanecem.
        assert com_data.n_global == 2
        assert com_data.media_global == pytest.approx(10.0, abs=1e-9)

    async def test_group_by_especialidade_com_filtro_multivalor_de_unidade(self, fixture_db_session):
        p = KpisProvider(fixture_db_session)
        # unidade=ORTOPEDIA (AMBULATÓRIO) só tem especialidade ORTOPEDIA: C-003(9), C-004(7) -> mediana 8.
        r = await p.compute(
            "KPI-03", GroupBy.especialidade, Filtros(unidade=["ORTOPEDIA (AMBULATÓRIO)"])
        )
        assert [b.dimensao for b in r.breakdown] == ["ORTOPEDIA"]
        assert r.breakdown[0].media == pytest.approx(8.0, abs=1e-9)
        assert r.breakdown[0].n == 2
        assert r.n_global == 2
        assert r.media_global == pytest.approx(8.0, abs=1e-9)

    # --- Teste HTTP: prova que a rota real decodifica ?unidade=A&unidade=B em list[str] ---

    async def test_http_get_kpis_aceita_unidade_repetida_e_restringe(self, client):
        r_um = await client.get(
            "/api/v1/kpis/tempos-medios", params=[("unidade", "CARDIOLOGIA (AMBULATÓRIO)")]
        )
        r_dois = await client.get(
            "/api/v1/kpis/tempos-medios",
            params=[
                ("unidade", "CARDIOLOGIA (AMBULATÓRIO)"),
                ("unidade", "ORTOPEDIA (AMBULATÓRIO)"),
            ],
        )
        assert r_um.status_code == 200
        assert r_dois.status_code == 200

        kpi03_um = next(k for k in r_um.json()["kpis"] if k["codigo"] == "KPI-03")
        kpi03_dois = next(k for k in r_dois.json()["kpis"] if k["codigo"] == "KPI-03")

        assert {b["dimensao"] for b in kpi03_um["breakdown"]} == {"CARDIOLOGIA (AMBULATÓRIO)"}
        assert kpi03_um["n_global"] == 3

        assert {b["dimensao"] for b in kpi03_dois["breakdown"]} == {
            "CARDIOLOGIA (AMBULATÓRIO)",
            "ORTOPEDIA (AMBULATÓRIO)",
        }
        assert kpi03_dois["n_global"] == 5
