import pytest
from httpx import ASGITransport, AsyncClient

from pija.main import app
from pija.db import make_sessionmaker


@pytest.fixture
async def client(async_engine, fixture_db_session):
    # fixture_db_session popula o banco; reusa o mesmo engine no app.
    app.state.session_factory = make_sessionmaker(async_engine)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestCiclicidadeEndpoint:
    async def test_agregado_200(self, client):
        r = await client.get("/api/v1/ciclicidade/transicoes")
        assert r.status_code == 200
        body = r.json()
        pares = {(t["origem"], t["destino"]): t["volume"] for t in body["transicoes"]}
        assert pares[("PRONTUARIO", "CONSULTA")] == 5
        assert any(n["tipo"] == "CONSULTA" for n in body["nos"])

    async def test_paciente_unico(self, client):
        r = await client.get("/api/v1/ciclicidade/transicoes", params={"paciente_id": "001"})
        assert r.status_code == 200
        pares = {(t["origem"], t["destino"]): t["volume"] for t in r.json()["transicoes"]}
        assert pares == {
            ("PRONTUARIO", "CONSULTA"): 1,
            ("CONSULTA", "INTERNACAO"): 1,
            ("INTERNACAO", "CONSULTA"): 1,
        }

    async def test_filtro_especialidade(self, client):
        r = await client.get(
            "/api/v1/ciclicidade/transicoes", params={"especialidade": "ORTOPEDIA"}
        )
        assert r.status_code == 200
        pares = {(t["origem"], t["destino"]): t["volume"] for t in r.json()["transicoes"]}
        assert pares[("PRONTUARIO", "CONSULTA")] == 2
