import os

import pytest

# Garantir variáveis mínimas para Settings em testes
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production-min-32-chars")
os.environ.setdefault("SQLITE_PATH", ":memory:")
os.environ.setdefault("CSV_DIR", "./CSV-aghu")


@pytest.fixture
def fixtures_dir() -> str:
    """Caminho para tests/fixtures."""
    return os.path.join(os.path.dirname(__file__), "fixtures")