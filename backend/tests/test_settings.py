from pija.settings import Settings


def test_settings_defaults_for_csv_mode(monkeypatch, tmp_path):
    monkeypatch.setenv("JWT_SECRET", "test-secret-not-for-production-min-32")
    monkeypatch.setenv("SQLITE_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("CSV_DIR", str(tmp_path / "csv"))

    settings = Settings()

    assert settings.resource_mode == "csv"
    assert settings.jwt_access_ttl_seconds == 900
    assert settings.jwt_refresh_ttl_seconds == 604800
    assert settings.sqlite_path == str(tmp_path / "test.db")


def test_settings_requires_jwt_secret(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        Settings()


def test_settings_rejects_short_jwt_secret(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "too-short")
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        Settings()