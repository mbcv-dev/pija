import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from pija.main import app


@pytest.fixture
async def client(async_engine):
    """HTTP client pointing at app with fixture DB."""
    app.state.session_factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200


async def test_eventos_retorna_200(client):
    r = await client.get("/api/v1/eventos")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "total" in data


async def test_kpis_retorna_200(client):
    r = await client.get("/api/v1/kpis/tempos-medios")
    assert r.status_code == 200
    data = r.json()
    assert len(data["kpis"]) == 5


async def test_gargalos_retorna_200(client):
    r = await client.get("/api/v1/gargalos")
    assert r.status_code == 200
    data = r.json()
    assert "ranking" in data


async def test_eventos_filtro_invalido_422(client):
    r = await client.get("/api/v1/eventos?tipo_entidade=INVALIDO")
    assert r.status_code == 422
