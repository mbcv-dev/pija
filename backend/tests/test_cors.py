import importlib
import os

from fastapi.testclient import TestClient


def _client_with_origins(origins: str, regex: str = "") -> TestClient:
    os.environ["CORS_ORIGINS"] = origins
    if regex:
        os.environ["CORS_ORIGINS_REGEX"] = regex
    else:
        os.environ.pop("CORS_ORIGINS_REGEX", None)
    import pija.settings as settings_mod
    import pija.main as main_mod
    importlib.reload(settings_mod)
    importlib.reload(main_mod)
    return TestClient(main_mod.app)


def test_cors_allows_configured_origin():
    client = _client_with_origins("https://pija-alpha.vercel.app")
    resp = client.get("/health", headers={"Origin": "https://pija-alpha.vercel.app"})
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "https://pija-alpha.vercel.app"


def test_cors_blocks_unconfigured_origin():
    client = _client_with_origins("https://pija-alpha.vercel.app")
    resp = client.get("/health", headers={"Origin": "https://evil.example"})
    # Origem não permitida → sem header de allow-origin para ela
    assert resp.headers.get("access-control-allow-origin") != "https://evil.example"


def test_cors_regex_allows_vercel_preview():
    # Previews da Vercel têm hash por deploy → cobertos por regex, não por lista exata.
    client = _client_with_origins("", regex=r"https://pija-.*\.vercel\.app")
    preview = "https://pija-alpha-git-feat-x-time2.vercel.app"
    resp = client.get("/health", headers={"Origin": preview})
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == preview


def test_cors_regex_blocks_foreign_origin():
    client = _client_with_origins("", regex=r"https://pija-.*\.vercel\.app")
    resp = client.get("/health", headers={"Origin": "https://evil.vercel.app.attacker.com"})
    assert resp.headers.get("access-control-allow-origin") != "https://evil.vercel.app.attacker.com"


def teardown_module(_module):
    # Limpar env e recarregar para não vazar estado p/ outros testes
    os.environ.pop("CORS_ORIGINS", None)
    os.environ.pop("CORS_ORIGINS_REGEX", None)
    import importlib
    import pija.settings as settings_mod
    import pija.main as main_mod
    importlib.reload(settings_mod)
    importlib.reload(main_mod)
