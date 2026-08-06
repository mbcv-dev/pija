"""A dependência de filtros precisa continuar aparecendo no OpenAPI.

Uma dependência mal construída some com os parâmetros da documentação sem
quebrar nenhum teste funcional — o cliente continua podendo mandar os filtros,
mas ninguém descobre que eles existem. Por isso o teste olha o schema gerado,
não só o comportamento.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from pija.main import app

COMUNS = {"unidade", "especialidade", "grupo", "data_inicio", "data_fim"}

ROTAS_COM_FILTRO = [
    "/api/v1/kpis/tempos-medios",
    "/api/v1/kpis/distribuicoes",
    "/api/v1/gargalos",
    "/api/v1/eventos",
    "/api/v1/ciclicidade/transicoes",
]


@pytest.fixture
async def openapi():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/openapi.json")
    assert resp.status_code == 200
    return resp.json()


@pytest.mark.parametrize("rota", ROTAS_COM_FILTRO)
async def test_filtros_comuns_continuam_no_openapi(openapi, rota):
    params = {p["name"] for p in openapi["paths"][rota]["get"].get("parameters", [])}
    assert COMUNS <= params, f"faltam em {rota}: {COMUNS - params}"


async def test_params_especificos_nao_foram_engolidos(openapi):
    def nomes(rota):
        return {p["name"] for p in openapi["paths"][rota]["get"].get("parameters", [])}

    assert "group_by" in nomes("/api/v1/kpis/tempos-medios")
    assert "group_by" not in nomes("/api/v1/kpis/distribuicoes")
    assert {"limit", "offset", "paciente_id"} <= nomes("/api/v1/eventos")
    assert "limit" in nomes("/api/v1/gargalos")
    assert "paciente_id" in nomes("/api/v1/ciclicidade/transicoes")
    assert "tipo_entidade" in nomes("/api/v1/eventos")
    assert "kpi_codes" in nomes("/api/v1/gargalos")
