import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from pija.main import app


@pytest.fixture
async def client_banco_vazio(async_engine):
    """HTTP client contra um banco com as tabelas criadas e NENHUMA linha.

    Não é o `client` do conftest.py de propósito: aquele depende de
    `fixture_db_session` e chega populado. O ponto destes smoke tests é justamente
    provar que as rotas respondem 200 (e não estouram) quando não há dado nenhum —
    trocar por um banco populado apagaria essa cobertura.
    """
    app.state.session_factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def test_health(client_banco_vazio):
    r = await client_banco_vazio.get("/health")
    assert r.status_code == 200


async def test_eventos_retorna_200(client_banco_vazio):
    r = await client_banco_vazio.get("/api/v1/eventos")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "total" in data


async def test_kpis_retorna_200(client_banco_vazio):
    r = await client_banco_vazio.get("/api/v1/kpis/tempos-medios")
    assert r.status_code == 200
    data = r.json()
    assert len(data["kpis"]) == 8
    assert all("breakdown" in k for k in data["kpis"])


async def test_gargalos_retorna_200(client_banco_vazio):
    r = await client_banco_vazio.get("/api/v1/gargalos")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data


async def test_kpis_kpi_codes_invalido_400(client_banco_vazio):
    r = await client_banco_vazio.get("/api/v1/kpis/tempos-medios?kpi_codes=KPI-99")
    assert r.status_code == 400


async def test_eventos_filtro_invalido_422(client_banco_vazio):
    r = await client_banco_vazio.get("/api/v1/eventos?tipo_entidade=INVALIDO")
    assert r.status_code == 422
