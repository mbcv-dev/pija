from pija.resources import AghuResource, CsvResource
from pija.resources.factory import get_resource


def test_factory_returns_csv_when_mode_csv(monkeypatch, tmp_path):
    monkeypatch.setenv("RESOURCE_MODE", "csv")
    monkeypatch.setenv("CSV_DIR", str(tmp_path))
    monkeypatch.setenv("JWT_SECRET", "test-secret-not-for-production-min-32-chars")

    res = get_resource()
    assert isinstance(res, CsvResource)


def test_factory_returns_aghu_when_mode_aghu(monkeypatch):
    monkeypatch.setenv("RESOURCE_MODE", "aghu")
    monkeypatch.setenv("AGHU_DSN", "oracle://stub")
    monkeypatch.setenv("JWT_SECRET", "test-secret-not-for-production-min-32-chars")

    res = get_resource()
    assert isinstance(res, AghuResource)


def test_factory_uses_injected_settings(tmp_path):
    """Locks the injection contract used by FastAPI Depends in Fase 2 endpoints."""
    from pija.settings import Settings

    custom = Settings(
        resource_mode="csv",
        csv_dir=str(tmp_path),
        jwt_secret="injection-test-secret-min-32-characters",
    )
    res = get_resource(custom)
    assert isinstance(res, CsvResource)
    assert res.csv_dir.as_posix().endswith(tmp_path.name)