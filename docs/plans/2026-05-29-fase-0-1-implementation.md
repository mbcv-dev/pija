# Fase 0 (Scaffold) + Fase 1 (ETL CSV → SQLite) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar repositório bootável e ETL idempotente capaz de carregar as 5 CSVs do AGHU (`CSV-aghu/*.csv`) em SQLite local conforme `fato_eventos_jornada`, com `etl_log` estruturado e modo `--sample N` para dev.

**Architecture:** Monorepo. Backend Python 3.11+ com FastAPI (apenas `/health` nesta fase — endpoints analíticos vêm na F2). Adapter `Resource` plugável (`CsvResource` MVP, `AghuResource` stub para F5). ETL streaming (`pandas.read_csv(chunksize=50_000)`) + parsers BR para datas e números + mappers por entidade. SQLAlchemy 2.0 Async + Alembic para schema e upsert. Todos os mapeamentos respeitam [DADOS-ESTADO.md](../DADOS-ESTADO.md) §4.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0 Async, aiosqlite, Alembic, pandas, pytest, pytest-asyncio, httpx.

---

## File Structure

```
backend/
├── pyproject.toml                       # Dependências e config (Task 1)
├── .gitignore                           # Ignora venv, __pycache__, *.db, CSV-aghu/ etc.
├── alembic.ini                          # Config Alembic (Task 5)
├── alembic/
│   ├── env.py                           # Init Alembic (Task 5)
│   ├── script.py.mako
│   └── versions/
│       └── 001_initial_schema.py        # Migration (Task 5)
├── src/pija/
│   ├── __init__.py
│   ├── main.py                          # FastAPI + /health (Task 2)
│   ├── settings.py                      # Pydantic Settings (Task 3)
│   ├── db.py                            # Async engine + session (Task 4)
│   ├── models/
│   │   ├── __init__.py
│   │   └── fato.py                      # ORM: FatoEvento, EtlLog (Task 4)
│   ├── resources/
│   │   ├── __init__.py
│   │   ├── base_resource.py             # Protocol (Task 7)
│   │   ├── csv_resource.py              # MVP impl (Task 8)
│   │   ├── aghu_resource.py             # Stub para F5 (Task 7)
│   │   └── factory.py                   # DI (Task 9)
│   ├── etl/
│   │   ├── __init__.py
│   │   ├── parsers.py                   # BR datetime/numeric (Task 6)
│   │   ├── mappers/
│   │   │   ├── __init__.py
│   │   │   ├── base.py                  # Mapper Protocol (Task 10)
│   │   │   ├── prontuario.py            # (Task 10)
│   │   │   ├── consulta.py              # (Task 11)
│   │   │   ├── exame.py                 # (Task 12)
│   │   │   ├── internacao.py            # INTERNACAO + ALTA (Task 13)
│   │   │   └── cirurgia.py              # CIRURGIA + PROCEDIMENTO (Task 14)
│   │   └── runner.py                    # ETL CLI (Tasks 15-17)
│   └── api/
│       └── __init__.py                  # (empty for F0/F1 — F2 popula)
└── tests/
    ├── conftest.py                      # Fixtures pytest (Task 4)
    ├── fixtures/
    │   ├── vw_pacientes_sample.csv      # 10 linhas (Task 10)
    │   ├── vw_consultas_sample.csv      # 10 linhas (Task 11)
    │   ├── vw_exames_sample.csv         # 10 linhas (Task 12)
    │   ├── vw_internacoes_sample.csv    # 10 linhas (Task 13)
    │   └── vw_cirurgias_sample.csv      # 10 linhas (Task 14)
    ├── test_health.py                   # (Task 2)
    ├── test_settings.py                 # (Task 3)
    ├── test_db.py                       # (Task 4)
    ├── test_parsers.py                  # (Task 6)
    ├── test_csv_resource.py             # (Task 8)
    ├── test_resource_factory.py         # (Task 9)
    ├── test_mapper_prontuario.py        # (Task 10)
    ├── test_mapper_consulta.py          # (Task 11)
    ├── test_mapper_exame.py             # (Task 12)
    ├── test_mapper_internacao.py        # (Task 13)
    ├── test_mapper_cirurgia.py          # (Task 14)
    └── test_etl_runner.py               # (Tasks 15-18)
```

`.env.example` na raiz, `CSV-aghu/` na raiz e listado em `.gitignore`.

---

## Tasks

### Task 1: Backend skeleton — pyproject.toml + venv + .gitignore

**Files:**
- Create: `backend/pyproject.toml`
- Create: `.gitignore` (raiz)
- Create: `backend/src/pija/__init__.py` (vazio)

- [ ] **Step 1: Write `backend/pyproject.toml`**

```toml
[project]
name = "pija"
version = "0.1.0"
description = "Plataforma Integrada da Jornada Assistencial — HC-UFPE/CIn-UFPE"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "pydantic>=2.8",
    "pydantic-settings>=2.4",
    "sqlalchemy[asyncio]>=2.0",
    "aiosqlite>=0.20",
    "alembic>=1.13",
    "pandas>=2.2",
    "python-multipart>=0.0.9",
    "PyJWT>=2.9",
    "bcrypt>=4.2",
    "PyYAML>=6.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
    "pytest-cov>=5.0",
    "httpx>=0.27",
    "ruff>=0.6",
]

[build-system]
requires = ["setuptools>=70"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["src"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
addopts = "-v --tb=short"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "N"]
ignore = ["E501"]
```

- [ ] **Step 2: Write `.gitignore` (raiz)**

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
backend/venv/
backend/.venv/
backend/build/
backend/dist/
backend/*.egg-info/
.pytest_cache/
.coverage
htmlcov/

# Banco local e dados
*.db
*.sqlite
*.sqlite3
backend/data/

# Dados brutos (não versionar CSVs do HC)
CSV-aghu/

# Secrets
.env
.env.local
backend/.env

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Node (Fase 4)
node_modules/
frontend/dist/
```

- [ ] **Step 3: Create empty package file**

```bash
mkdir -p backend/src/pija
touch backend/src/pija/__init__.py
```

- [ ] **Step 4: Create venv and install**

```bash
cd backend && python -m venv venv
source venv/Scripts/activate  # Git Bash on Windows
pip install -e ".[dev]"
```

Expected: `pip install` completes without error; `pip list | grep fastapi` shows the package.

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/src/pija/__init__.py .gitignore
git commit -m "Bootstrap backend skeleton with pyproject and gitignore"
```

---

### Task 2: FastAPI `main.py` with `/health` endpoint

**Files:**
- Create: `backend/src/pija/main.py`
- Create: `backend/tests/__init__.py` (empty)
- Create: `backend/tests/test_health.py`

- [ ] **Step 1: Write failing test `backend/tests/test_health.py`**

```python
from fastapi.testclient import TestClient

from pija.main import app


def test_health_returns_ok():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "pija-backend"}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_health.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'pija.main'`.

- [ ] **Step 3: Write `backend/src/pija/main.py`**

```python
from fastapi import FastAPI

app = FastAPI(title="PIJA", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "pija-backend"}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && pytest tests/test_health.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/pija/main.py backend/tests/__init__.py backend/tests/test_health.py
git commit -m "Add FastAPI app with /health endpoint and passing test"
```

---

### Task 3: Pydantic Settings + `.env.example`

**Files:**
- Create: `backend/src/pija/settings.py`
- Create: `.env.example` (raiz)
- Create: `backend/tests/test_settings.py`

- [ ] **Step 1: Write failing test `backend/tests/test_settings.py`**

```python
from pija.settings import Settings


def test_settings_defaults_for_csv_mode(monkeypatch, tmp_path):
    monkeypatch.setenv("JWT_SECRET", "test-secret-not-for-production")
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_settings.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'pija.settings'`.

- [ ] **Step 3: Write `backend/src/pija/settings.py`**

```python
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurações da aplicação carregadas do ambiente / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Modo de fonte de dados
    resource_mode: Literal["csv", "aghu"] = "csv"

    # Banco local
    sqlite_path: str = "./data/pija.db"

    # Auth
    jwt_secret: str = Field(..., min_length=16)
    jwt_access_ttl_seconds: int = 900       # 15 min
    jwt_refresh_ttl_seconds: int = 604800   # 7 dias
    users_yml_path: str = "./users.yml"

    # Fonte CSV (MVP)
    csv_dir: str = "../CSV-aghu"

    # Fonte AGHU (Fase 5)
    aghu_dsn: str = ""
    ldap_uri: str = ""
```

- [ ] **Step 4: Write `.env.example` na raiz**

```bash
# Variáveis de ambiente do PIJA — copie para .env e ajuste

# Modo de fonte: csv (MVP) | aghu (Fase 5 - cutover)
RESOURCE_MODE=csv

# Banco local SQLite
SQLITE_PATH=./backend/data/pija.db

# Auth (interim — MVP)
JWT_SECRET=change-me-to-a-long-random-string-32-chars-minimum
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=604800
USERS_YML_PATH=./backend/users.yml

# Fonte CSV (MVP)
CSV_DIR=./CSV-aghu

# Fonte AGHU (preencher na Fase 5)
AGHU_DSN=
LDAP_URI=
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && pytest tests/test_settings.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/pija/settings.py backend/tests/test_settings.py .env.example
git commit -m "Add Pydantic Settings with RESOURCE_MODE and JWT config"
```

---

### Task 4: SQLAlchemy 2.0 async engine + session + ORM models

**Files:**
- Create: `backend/src/pija/db.py`
- Create: `backend/src/pija/models/__init__.py`
- Create: `backend/src/pija/models/fato.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_db.py`

- [ ] **Step 1: Write failing test `backend/tests/test_db.py`**

```python
import pytest
from sqlalchemy import select

from pija.db import Base, make_engine, make_sessionmaker
from pija.models.fato import EtlLog, FatoEvento


@pytest.mark.asyncio
async def test_can_create_schema_and_insert(tmp_path):
    db_path = tmp_path / "test.db"
    engine = make_engine(f"sqlite+aiosqlite:///{db_path}")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = make_sessionmaker(engine)
    async with SessionLocal() as session:
        evento = FatoEvento(
            evento_id="P-12345",
            paciente_id="12345",
            tipo_entidade="PRONTUARIO",
            entidade_id="12345",
            timestamp_principal="2025-01-01T00:00:00",
            dt_carga="2026-05-29T10:00:00",
        )
        session.add(evento)
        await session.commit()

        result = await session.execute(select(FatoEvento))
        eventos = result.scalars().all()
        assert len(eventos) == 1
        assert eventos[0].evento_id == "P-12345"

    await engine.dispose()


@pytest.mark.asyncio
async def test_etl_log_records(tmp_path):
    db_path = tmp_path / "log.db"
    engine = make_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = make_sessionmaker(engine)
    async with SessionLocal() as session:
        log = EtlLog(
            view_name="vw_pacientes",
            started_at="2026-05-29T10:00:00",
            finished_at="2026-05-29T10:05:00",
            rows_read=357346,
            rows_loaded=357340,
            rows_rejected=6,
            errors=None,
        )
        session.add(log)
        await session.commit()

    await engine.dispose()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_db.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'pija.db'`.

- [ ] **Step 3: Write `backend/src/pija/db.py`**

```python
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def make_engine(url: str) -> AsyncEngine:
    """Cria engine SQLAlchemy Async — usar URL do tipo sqlite+aiosqlite:///path."""
    return create_async_engine(url, echo=False, future=True)


def make_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

- [ ] **Step 4: Write `backend/src/pija/models/__init__.py`**

```python
from pija.models.fato import EtlLog, FatoEvento

__all__ = ["EtlLog", "FatoEvento"]
```

- [ ] **Step 5: Write `backend/src/pija/models/fato.py`**

```python
from sqlalchemy import Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from pija.db import Base


class FatoEvento(Base):
    """Tabela fato: 1 linha por evento de jornada assistencial.

    Conforme 04-modelo-dados.md §3 e DADOS-ESTADO.md §4.
    Todos os timestamps são armazenados como string ISO 8601
    (formato SQLite TEXT) para portabilidade.
    """

    __tablename__ = "fato_eventos_jornada"

    evento_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    paciente_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    tipo_entidade: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    entidade_id: Mapped[str] = mapped_column(String(64), nullable=False)
    timestamp_principal: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    timestamp_solicitacao: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timestamp_agendamento: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timestamp_realizacao: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timestamp_liberacao: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timestamp_alta_medica: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timestamp_alta_administrativa: Mapped[str | None] = mapped_column(String(32), nullable=True)
    unidade: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    especialidade: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    tipo_evento: Mapped[str | None] = mapped_column(String(128), nullable=True)
    situacao: Mapped[str | None] = mapped_column(String(64), nullable=True)
    dt_carga: Mapped[str] = mapped_column(String(32), nullable=False)
    deleted_at: Mapped[str | None] = mapped_column(String(32), nullable=True)


# Índices compostos comuns para queries analíticas
Index(
    "ix_fato_filtros",
    FatoEvento.tipo_entidade,
    FatoEvento.unidade,
    FatoEvento.especialidade,
    FatoEvento.timestamp_principal,
)


class EtlLog(Base):
    """Log estruturado de cada execução do ETL por view."""

    __tablename__ = "etl_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    view_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    started_at: Mapped[str] = mapped_column(String(32), nullable=False)
    finished_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    rows_read: Mapped[int] = mapped_column(Integer, default=0)
    rows_loaded: Mapped[int] = mapped_column(Integer, default=0)
    rows_rejected: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[str | None] = mapped_column(Text, nullable=True)
```

- [ ] **Step 6: Write `backend/tests/conftest.py`**

```python
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
```

- [ ] **Step 7: Run tests**

```bash
cd backend && pytest tests/test_db.py -v
```

Expected: PASS (2 testes).

- [ ] **Step 8: Commit**

```bash
git add backend/src/pija/db.py backend/src/pija/models/ backend/tests/conftest.py backend/tests/test_db.py
git commit -m "Add SQLAlchemy async engine and FatoEvento + EtlLog ORM models"
```

---

### Task 5: Alembic init + first migration

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`
- Create: `backend/alembic/versions/001_initial_schema.py`

- [ ] **Step 1: Initialize Alembic**

```bash
cd backend && alembic init -t async alembic
```

Expected: cria pasta `alembic/` com `env.py`, `script.py.mako` e `versions/`.

- [ ] **Step 2: Edit `backend/alembic.ini` — set sqlalchemy.url to placeholder**

Substitua a linha `sqlalchemy.url = driver://...` por:

```ini
sqlalchemy.url =
```

(deixa vazio — o `env.py` lerá de `Settings`)

- [ ] **Step 3: Edit `backend/alembic/env.py`** — substitua o conteúdo gerado por:

```python
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from pija.db import Base
from pija.models import EtlLog, FatoEvento  # noqa: F401 — ensure tables registered
from pija.settings import Settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

settings = Settings()
config.set_main_option("sqlalchemy.url", f"sqlite+aiosqlite:///{settings.sqlite_path}")


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,  # necessário para SQLite ALTER TABLE
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 4: Generate migration**

```bash
# From REPO ROOT
mkdir -p backend/data
export JWT_SECRET="your-long-jwt-secret-at-least-32-characters"
alembic -c backend/alembic.ini revision --autogenerate -m "initial schema fato_eventos_jornada and etl_log"
```

Expected: cria `backend/alembic/versions/<hash>_initial_schema_fato_eventos_jornada_and_etl_log.py`.

- [ ] **Step 5: Rename generated file to `001_initial_schema.py`**

```bash
cd backend/alembic/versions && mv *_initial_schema_*.py 001_initial_schema.py
```

- [ ] **Step 6: Apply migration**

```bash
# Run from REPO ROOT (sqlite_path resolves to ./backend/data/pija.db)
mkdir -p backend/data
export JWT_SECRET="your-long-jwt-secret-at-least-32-characters"
alembic -c backend/alembic.ini upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade  -> ...`. Cria `backend/data/pija.db`.

- [ ] **Step 7: Verify schema**

```bash
cd backend && python -c "
import sqlite3
conn = sqlite3.connect('data/pija.db')
cur = conn.cursor()
cur.execute(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\")
print([r[0] for r in cur.fetchall()])
"
```

Expected: `['alembic_version', 'etl_log', 'fato_eventos_jornada']`.

- [ ] **Step 8: Commit**

```bash
git add backend/alembic.ini backend/alembic/
git commit -m "Initialize Alembic with first migration for fato_eventos_jornada and etl_log"
```

---

### Task 6: Parsers BR — datetime e ID com separador de milhar

**Files:**
- Create: `backend/src/pija/etl/__init__.py` (vazio)
- Create: `backend/src/pija/etl/parsers.py`
- Create: `backend/tests/test_parsers.py`

- [ ] **Step 1: Write failing test `backend/tests/test_parsers.py`**

```python
from pija.etl.parsers import parse_br_date, parse_br_datetime, parse_br_id


def test_parse_br_datetime_with_hour():
    assert parse_br_datetime("24/2/2025, 18:00") == "2025-02-24T18:00:00"
    assert parse_br_datetime("1/1/2015, 00:51") == "2015-01-01T00:51:00"
    assert parse_br_datetime("26/2/2025, 13:25") == "2025-02-26T13:25:00"


def test_parse_br_datetime_empty_returns_none():
    assert parse_br_datetime("") is None
    assert parse_br_datetime(None) is None
    assert parse_br_datetime("   ") is None


def test_parse_br_datetime_invalid_returns_none():
    assert parse_br_datetime("foo") is None
    assert parse_br_datetime("32/13/2025, 99:99") is None


def test_parse_br_date_without_hour():
    assert parse_br_date("25/8/2015") == "2015-08-25"
    assert parse_br_date("1/1/2020") == "2020-01-01"


def test_parse_br_date_empty_returns_none():
    assert parse_br_date("") is None
    assert parse_br_date(None) is None


def test_parse_br_id_removes_thousand_separator():
    assert parse_br_id("1.458.992") == "1458992"
    assert parse_br_id("17.774") == "17774"
    assert parse_br_id("21.532.437") == "21532437"


def test_parse_br_id_handles_no_separator():
    assert parse_br_id("12345") == "12345"


def test_parse_br_id_empty_returns_none():
    assert parse_br_id("") is None
    assert parse_br_id(None) is None
    assert parse_br_id("   ") is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_parsers.py -v
```

Expected: FAIL com `ModuleNotFoundError`.

- [ ] **Step 3: Write `backend/src/pija/etl/parsers.py`**

```python
"""Parsers para o formato brasileiro presente nos CSVs do AGHU.

Conforme DADOS-ESTADO.md §2:
- Datas com hora: DD/M/YYYY, HH:MM
- Datas sem hora: DD/M/YYYY
- IDs numéricos com `.` como separador de milhar: 1.458.992
"""

from datetime import datetime


def parse_br_datetime(value: str | None) -> str | None:
    """Converte 'DD/M/YYYY, HH:MM' → 'YYYY-MM-DDTHH:MM:SS' (ISO 8601).

    Retorna None se vazio, espaços ou parsing falhar (soft-fail).
    """
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    try:
        dt = datetime.strptime(stripped, "%d/%m/%Y, %H:%M")
        return dt.strftime("%Y-%m-%dT%H:%M:%S")
    except ValueError:
        return None


def parse_br_date(value: str | None) -> str | None:
    """Converte 'DD/M/YYYY' → 'YYYY-MM-DD' (ISO 8601 date).

    Retorna None se vazio ou parsing falhar.
    """
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    try:
        dt = datetime.strptime(stripped, "%d/%m/%Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_br_id(value: str | None) -> str | None:
    """Remove separador de milhar ('.') de IDs numéricos.

    '1.458.992' → '1458992'.  Retorna None se vazio.
    """
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    return stripped.replace(".", "")
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && pytest tests/test_parsers.py -v
```

Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/pija/etl/__init__.py backend/src/pija/etl/parsers.py backend/tests/test_parsers.py
git commit -m "Add BR-format parsers for datetimes, dates and thousand-separated IDs"
```

---

### Task 7: `BaseResource` Protocol + `AghuResource` stub

**Files:**
- Create: `backend/src/pija/resources/__init__.py`
- Create: `backend/src/pija/resources/base_resource.py`
- Create: `backend/src/pija/resources/aghu_resource.py`

- [ ] **Step 1: Write `backend/src/pija/resources/__init__.py`**

```python
from pija.resources.aghu_resource import AghuResource
from pija.resources.base_resource import BaseResource
from pija.resources.csv_resource import CsvResource

__all__ = ["AghuResource", "BaseResource", "CsvResource"]
```

(O `CsvResource` será criado na Task 8 — esse import precisa existir antes; resolveremos atualizando o `__init__` na próxima task.)

- [ ] **Step 2: Write `backend/src/pija/resources/base_resource.py`**

```python
"""Contrato de origem de dados — usado por providers e ETL.

A escolha entre `CsvResource` (MVP) e `AghuResource` (Fase 5) é feita pelo
factory baseado em `RESOURCE_MODE`. Consumidores trabalham apenas com o
protocolo abaixo.
"""

from collections.abc import Iterator
from typing import Protocol


class BaseResource(Protocol):
    """Protocolo da camada Resource.

    `iter_rows(view, sample=None)` deve ser um iterador (preguiçoso/streaming)
    de dicts onde cada dict representa 1 linha bruta da view de origem,
    com chaves no formato exato do header do CSV / view AGHU.
    """

    def iter_rows(self, view: str, *, sample: int | None = None) -> Iterator[dict[str, str]]:
        """Itera linhas brutas de uma view, em chunks internamente."""
        ...

    def count(self, view: str) -> int:
        """Total estimado de linhas da view (excluindo header)."""
        ...
```

- [ ] **Step 3: Write `backend/src/pija/resources/aghu_resource.py`**

```python
"""Stub do AghuResource para a Fase 5 (cutover via VPN HC).

A implementação real usará `python-oracledb` com pool de conexão. Por
ora, mantemos a mesma interface levantando NotImplementedError para
garantir que o DI funcione e os consumidores tratem o caso.
"""

from collections.abc import Iterator


class AghuResource:
    """Stub — implementação real na Fase 5."""

    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def iter_rows(self, view: str, *, sample: int | None = None) -> Iterator[dict[str, str]]:
        raise NotImplementedError(
            "AghuResource será implementado na Fase 5 (cutover via VPN HC-UFPE). "
            "Use RESOURCE_MODE=csv enquanto isso."
        )

    def count(self, view: str) -> int:
        raise NotImplementedError("Disponível na Fase 5.")
```

(Não tem teste isolado — coberto pelo teste de factory na Task 9.)

---

### Task 8: `CsvResource` com streaming chunked

**Files:**
- Create: `backend/src/pija/resources/csv_resource.py`
- Create: `backend/tests/test_csv_resource.py`

- [ ] **Step 1: Write failing test `backend/tests/test_csv_resource.py`**

```python
from pathlib import Path

import pytest

from pija.resources.csv_resource import CsvResource


@pytest.fixture
def csv_dir(tmp_path: Path) -> Path:
    """Cria um CSV de teste minimal."""
    p = tmp_path / "vw_test.csv"
    p.write_text(
        "col_a,col_b,col_c\n"
        "1,foo,2025-01-01\n"
        "2,bar,2025-01-02\n"
        "3,baz,2025-01-03\n"
        "4,qux,2025-01-04\n"
        "5,quux,2025-01-05\n",
        encoding="utf-8",
    )
    return tmp_path


def test_csv_resource_iterates_all_rows(csv_dir: Path):
    res = CsvResource(csv_dir=str(csv_dir), chunksize=2)
    rows = list(res.iter_rows("vw_test"))
    assert len(rows) == 5
    assert rows[0] == {"col_a": "1", "col_b": "foo", "col_c": "2025-01-01"}
    assert rows[4] == {"col_a": "5", "col_b": "quux", "col_c": "2025-01-05"}


def test_csv_resource_respects_sample(csv_dir: Path):
    res = CsvResource(csv_dir=str(csv_dir), chunksize=2)
    rows = list(res.iter_rows("vw_test", sample=3))
    assert len(rows) == 3
    assert rows[0]["col_a"] == "1"
    assert rows[2]["col_a"] == "3"


def test_csv_resource_count(csv_dir: Path):
    res = CsvResource(csv_dir=str(csv_dir))
    assert res.count("vw_test") == 5


def test_csv_resource_raises_when_missing(tmp_path: Path):
    res = CsvResource(csv_dir=str(tmp_path))
    with pytest.raises(FileNotFoundError):
        list(res.iter_rows("vw_nonexistent"))
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_csv_resource.py -v
```

Expected: FAIL com `ModuleNotFoundError`.

- [ ] **Step 3: Write `backend/src/pija/resources/csv_resource.py`**

```python
"""Implementação CsvResource para leitura streaming dos CSVs do HC.

Lê em chunks via pandas para evitar carregar arquivos grandes
(até ~290 MB) inteiramente em memória.

Cada CSV deve estar em `csv_dir/<view>.csv` (com sufixo
`_anonimizado` ou outro nome conforme entregue pelo HC). O constructor
aceita um mapa opcional de view → nome do arquivo.
"""

from collections.abc import Iterator
from pathlib import Path

import pandas as pd

# Mapeamento padrão view → nome do arquivo entregue pelo HC.
DEFAULT_FILE_MAP: dict[str, str] = {
    "vw_pacientes": "vw_pacientes_anonimizado.csv",
    "vw_consultas": "vw_consultas_anonimizado.csv",
    "vw_exames": "vw_exames_anonimizado.csv",
    "vw_internacoes": "vw_internacoes_anonimizado.csv",
    "vw_cirurgias": "vw_cirurgias_anonimizado.csv",
}


class CsvResource:
    """Lê CSVs do HC em streaming."""

    def __init__(
        self,
        csv_dir: str,
        chunksize: int = 50_000,
        file_map: dict[str, str] | None = None,
    ) -> None:
        self.csv_dir = Path(csv_dir)
        self.chunksize = chunksize
        self.file_map = file_map or {}

    def _resolve_path(self, view: str) -> Path:
        """Resolve o caminho do CSV correspondente à view."""
        candidates = [
            self.file_map.get(view),
            DEFAULT_FILE_MAP.get(view),
            f"{view}.csv",
        ]
        for cand in candidates:
            if not cand:
                continue
            p = self.csv_dir / cand
            if p.exists():
                return p
        raise FileNotFoundError(
            f"CSV não encontrado para view='{view}'. "
            f"Tentativas: {[c for c in candidates if c]} em {self.csv_dir}"
        )

    def iter_rows(
        self, view: str, *, sample: int | None = None
    ) -> Iterator[dict[str, str]]:
        path = self._resolve_path(view)
        produced = 0
        # dtype=str => preserva todos os campos como string; conversão fica para os mappers
        reader = pd.read_csv(
            path,
            chunksize=self.chunksize,
            dtype=str,
            keep_default_na=False,  # célula vazia vira "" não NaN
            encoding="utf-8",
        )
        for chunk in reader:
            for row in chunk.to_dict(orient="records"):
                yield row
                produced += 1
                if sample is not None and produced >= sample:
                    return

    def count(self, view: str) -> int:
        """Conta linhas (exclui header). Lê em chunks para não estourar memória."""
        path = self._resolve_path(view)
        total = 0
        reader = pd.read_csv(
            path,
            chunksize=self.chunksize,
            dtype=str,
            keep_default_na=False,
            encoding="utf-8",
            usecols=[0],  # só primeira coluna basta para contar
        )
        for chunk in reader:
            total += len(chunk)
        return total
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && pytest tests/test_csv_resource.py -v
```

Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/pija/resources/csv_resource.py backend/src/pija/resources/base_resource.py backend/src/pija/resources/aghu_resource.py backend/src/pija/resources/__init__.py backend/tests/test_csv_resource.py
git commit -m "Add BaseResource Protocol, AghuResource stub and CsvResource streaming impl"
```

---

### Task 9: `resource_factory` + DI helper

**Files:**
- Create: `backend/src/pija/resources/factory.py`
- Create: `backend/tests/test_resource_factory.py`

- [ ] **Step 1: Write failing test `backend/tests/test_resource_factory.py`**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_resource_factory.py -v
```

Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write `backend/src/pija/resources/factory.py`**

```python
"""DI factory para o adapter Resource — escolhe CSV ou AGHU por env."""

from pija.resources.aghu_resource import AghuResource
from pija.resources.base_resource import BaseResource
from pija.resources.csv_resource import CsvResource
from pija.settings import Settings


def get_resource(settings: Settings | None = None) -> BaseResource:
    """Retorna a instância de Resource conforme settings.resource_mode.

    Pode ser injetado em endpoints FastAPI via `Depends(get_resource)`.
    """
    settings = settings or Settings()
    if settings.resource_mode == "csv":
        return CsvResource(csv_dir=settings.csv_dir)
    if settings.resource_mode == "aghu":
        return AghuResource(dsn=settings.aghu_dsn)
    raise ValueError(f"RESOURCE_MODE desconhecido: {settings.resource_mode}")
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && pytest tests/test_resource_factory.py -v
```

Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/pija/resources/factory.py backend/tests/test_resource_factory.py
git commit -m "Add resource_factory selecting CSV/AGHU via RESOURCE_MODE env"
```

---

### Task 10: Mapper PRONTUARIO + fixture

**Files:**
- Create: `backend/src/pija/etl/mappers/__init__.py`
- Create: `backend/src/pija/etl/mappers/base.py`
- Create: `backend/src/pija/etl/mappers/prontuario.py`
- Create: `backend/tests/fixtures/vw_pacientes_sample.csv`
- Create: `backend/tests/test_mapper_prontuario.py`

- [ ] **Step 1: Write fixture `backend/tests/fixtures/vw_pacientes_sample.csv`**

```bash
mkdir -p backend/tests/fixtures
cat > backend/tests/fixtures/vw_pacientes_sample.csv <<'EOF'
prontuario,pac_codigo,data_cadastro,nome_iniciais,nome_social_iniciais,nome_mae_iniciais,nome_pai_iniciais,idade,sexo,estado_civil,cor,etnia,grau_instrucao,profissao,naturalidade,nacionalidade,situacao_prontuario,logradouro,bairro,cidade,uf
17.774,17.774,25/8/2015,J.D.D.A.,,C.M.D.A.,B.C.A.,63,Masculino,Solteiro,M,,4,,,BRASILEIRO,Ativo,Logradouro Omitido,,,
330.895,330.895,25/8/2015,J.R.D.O.,,T.R.D.O.,N.C.,108,Masculino,Casado,M,,5,,ABREU E LIMA,BRASILEIRO,Ativo,Logradouro Omitido,CENTRO,ABREU E LIMA,PE
10.000.025,1.000.002,10/3/2018,M.A.S.,,L.S.S.,J.C.S.,42,Feminino,Casado,B,,3,,,BRASILEIRO,Recadastro,,,,
EOF
```

- [ ] **Step 2: Write failing test `backend/tests/test_mapper_prontuario.py`**

```python
import csv
from pathlib import Path

import pytest

from pija.etl.mappers.prontuario import map_pacientes_row


def _read_rows(path: Path) -> list[dict[str, str]]:
    with open(path, encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        return list(reader)


@pytest.fixture
def sample_rows(fixtures_dir: str) -> list[dict[str, str]]:
    return _read_rows(Path(fixtures_dir) / "vw_pacientes_sample.csv")


def test_maps_prontuario_basic_fields(sample_rows: list[dict[str, str]]):
    out = map_pacientes_row(sample_rows[0])
    assert out is not None
    assert out["evento_id"] == "P-17774"
    assert out["paciente_id"] == "17774"
    assert out["tipo_entidade"] == "PRONTUARIO"
    assert out["entidade_id"] == "17774"
    assert out["timestamp_principal"] == "2015-08-25"
    assert out["situacao"] == "Ativo"


def test_does_not_carry_pii(sample_rows: list[dict[str, str]]):
    out = map_pacientes_row(sample_rows[0])
    assert out is not None
    forbidden = {
        "nome_iniciais", "nome_mae_iniciais", "nome_pai_iniciais",
        "idade", "sexo", "estado_civil", "cor", "etnia",
        "grau_instrucao", "profissao", "naturalidade",
        "logradouro", "bairro", "cidade", "uf",
    }
    assert forbidden.isdisjoint(out.keys())


def test_rejects_row_with_missing_prontuario():
    out = map_pacientes_row({
        "prontuario": "",
        "data_cadastro": "25/8/2015",
        "situacao_prontuario": "Ativo",
    })
    assert out is None


def test_rejects_row_with_invalid_date():
    out = map_pacientes_row({
        "prontuario": "12345",
        "data_cadastro": "invalid",
        "situacao_prontuario": "Ativo",
    })
    assert out is None
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/test_mapper_prontuario.py -v
```

Expected: FAIL com `ModuleNotFoundError`.

- [ ] **Step 4: Write `backend/src/pija/etl/mappers/__init__.py`**

```python
"""Mappers CSV → fato_eventos_jornada por entidade.

Conforme DADOS-ESTADO.md §4. Cada mapper recebe uma row dict (chaves =
nomes de coluna originais do CSV) e retorna um dict com as colunas do
fato_eventos_jornada — ou None se a linha for inválida (soft-fail).
"""
```

- [ ] **Step 5: Write `backend/src/pija/etl/mappers/base.py`**

```python
"""Tipos e utilidades comuns aos mappers."""

from collections.abc import Iterable
from typing import TypedDict


class FatoRow(TypedDict, total=False):
    """Linha pronta para INSERT em fato_eventos_jornada."""

    evento_id: str
    paciente_id: str
    tipo_entidade: str
    entidade_id: str
    timestamp_principal: str
    timestamp_solicitacao: str | None
    timestamp_agendamento: str | None
    timestamp_realizacao: str | None
    timestamp_liberacao: str | None
    timestamp_alta_medica: str | None
    timestamp_alta_administrativa: str | None
    unidade: str | None
    especialidade: str | None
    tipo_evento: str | None
    situacao: str | None


def empty_to_none(value: str | None) -> str | None:
    """Converte string vazia ou só-espaços em None."""
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def first_nonempty(row: dict[str, str], *keys: str) -> str | None:
    """Retorna o primeiro valor não-vazio em row para a lista de keys.

    Útil para colunas que mudam de nome entre views (ex.: prontuario,
    Prontuario, Prontuário, paciente_prontuario).
    """
    for k in keys:
        v = row.get(k)
        if v is not None and v.strip():
            return v.strip()
    return None


def iter_mapped(
    rows: Iterable[dict[str, str]], mapper
) -> Iterable[FatoRow]:
    """Aplica um mapper e descarta None (linhas rejeitadas)."""
    for row in rows:
        result = mapper(row)
        if result is None:
            continue
        if isinstance(result, list):
            yield from result
        else:
            yield result
```

- [ ] **Step 6: Write `backend/src/pija/etl/mappers/prontuario.py`**

```python
"""Mapper para vw_pacientes_anonimizado.csv → tipo_entidade=PRONTUARIO.

Conforme DADOS-ESTADO.md §4.1. **NÃO carrega PII** (nome, idade, sexo,
endereço — guardrail "No Personal Data" do SPEC.md).
"""

from pija.etl.mappers.base import FatoRow, empty_to_none, first_nonempty
from pija.etl.parsers import parse_br_date, parse_br_id


def map_pacientes_row(row: dict[str, str]) -> FatoRow | None:
    """Mapeia uma linha de vw_pacientes para um FatoRow PRONTUARIO.

    Retorna None se a linha for inválida (prontuario vazio ou data
    inválida) — soft-fail registrado em etl_log.rows_rejected.
    """
    prontuario_raw = first_nonempty(row, "prontuario", "Prontuario", "Prontuário")
    paciente_id = parse_br_id(prontuario_raw)
    if not paciente_id:
        return None

    timestamp_principal = parse_br_date(row.get("data_cadastro"))
    if not timestamp_principal:
        return None

    return {
        "evento_id": f"P-{paciente_id}",
        "paciente_id": paciente_id,
        "tipo_entidade": "PRONTUARIO",
        "entidade_id": paciente_id,
        "timestamp_principal": timestamp_principal,
        "situacao": empty_to_none(row.get("situacao_prontuario")),
    }
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd backend && pytest tests/test_mapper_prontuario.py -v
```

Expected: PASS (4 testes).

- [ ] **Step 8: Commit**

```bash
git add backend/src/pija/etl/mappers/ backend/tests/fixtures/vw_pacientes_sample.csv backend/tests/test_mapper_prontuario.py
git commit -m "Add PRONTUARIO mapper that excludes PII and rejects invalid rows"
```

---

### Task 11: Mapper CONSULTA + fixture

**Files:**
- Create: `backend/src/pija/etl/mappers/consulta.py`
- Create: `backend/tests/fixtures/vw_consultas_sample.csv`
- Create: `backend/tests/test_mapper_consulta.py`

- [ ] **Step 1: Write fixture `backend/tests/fixtures/vw_consultas_sample.csv`**

(Headers de `vw_consultas` conforme DADOS-ESTADO.md §4.2. Uso vírgulas dentro de campos quote-protegidos quando preciso.)

```bash
cat > backend/tests/fixtures/vw_consultas_sample.csv <<'EOF'
data_procedimento,num_consulta,procedimento,procedimento_quantidade,profissional_atendeu,Categoria Profissional,Profissional Grade,profissional_procedimento,Prontuario,grade,Sigla Especialidade,especialidade,id,Data/Hora da Consulta,Turno,Data/Hora de Criação,Data/Hora de Alteração,Data/Hora de Início,Data/Hora de Fim,Código do Plano de Saúde,Código do Convênio,Servidor de Marcação,Equipe,Unidade Funcional,Centro de Custos,Situação da Consulta,Código CID,CID,Retorno,Motivo da Consulta,Justificativa,Justificativa da Falta,Condição do Atendimento,ID do Paciente,Código da Central,tipo
"13/1/2025, 09:51",3.972.104,CONSULTA MEDICA,1,B.C.N.,MEDICINA,M.C.D.A.N.,M.C.D.A.N.,19.918.085,116,UH,UROLOGIA HORMONIOTERAPIA,3.972.104,"13/1/2025, 07:00",Manhã,"18/9/2023, 08:22","13/1/2025, 09:51","13/1/2025, 09:45","13/1/2025, 09:51",1,2,A.B.D.S.N.,UROLOGIA GERAL,UROLOGIA (AMBULATÓRIO),UROLOGIA AMBULATORIO,MARCADA,,,PACIENTE ATENDIDO,,,,RETORNO,2.049.383,,PROCEDIMENTO
"14/1/2025, 10:20",3.972.105,CONSULTA MEDICA,1,B.C.N.,MEDICINA,M.C.D.A.N.,M.C.D.A.N.,21.455.522,116,UH,UROLOGIA HORMONIOTERAPIA,3.972.105,"14/1/2025, 08:00",Manhã,"18/9/2023, 08:22","14/1/2025, 10:21","14/1/2025, 10:15","14/1/2025, 10:21",1,2,A.B.D.S.N.,UROLOGIA GERAL,UROLOGIA (AMBULATÓRIO),UROLOGIA AMBULATORIO,MARCADA,,,PACIENTE FALTOU,,,,CONSULTA REGULADA,2.291.834,,CONSULTA
"15/1/2025, 11:00",3.972.106,CONSULTA MEDICA,1,B.C.N.,MEDICINA,M.C.D.A.N.,M.C.D.A.N.,,116,UH,UROLOGIA HORMONIOTERAPIA,3.972.106,"15/1/2025, 09:00",Manhã,"18/9/2023, 08:22","15/1/2025, 11:00","15/1/2025, 10:55","15/1/2025, 11:00",1,2,A.B.D.S.N.,UROLOGIA GERAL,UROLOGIA (AMBULATÓRIO),UROLOGIA AMBULATORIO,MARCADA,,,PACIENTE ATENDIDO,,,,INTERCONSULTA,2.291.835,,CONSULTA
EOF
```

- [ ] **Step 2: Write failing test `backend/tests/test_mapper_consulta.py`**

```python
import csv
from pathlib import Path

import pytest

from pija.etl.mappers.consulta import map_consulta_row


def _read_rows(path: Path) -> list[dict[str, str]]:
    with open(path, encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        return list(reader)


@pytest.fixture
def sample_rows(fixtures_dir: str) -> list[dict[str, str]]:
    return _read_rows(Path(fixtures_dir) / "vw_consultas_sample.csv")


def test_maps_consulta_atendida(sample_rows):
    """Linha com tipo=PROCEDIMENTO vira tipo_entidade=PROCEDIMENTO (Daniel/HC 29-05)."""
    out = map_consulta_row(sample_rows[0])
    assert out is not None
    # Fixture row 0: tipo=PROCEDIMENTO → tipo_entidade=PROCEDIMENTO, prefix PA
    assert out["evento_id"] == "PA-3972104"
    assert out["paciente_id"] == "19918085"
    assert out["tipo_entidade"] == "PROCEDIMENTO"
    assert out["entidade_id"] == "3972104"
    assert out["timestamp_principal"] == "2025-01-13T07:00:00"
    assert out["timestamp_agendamento"] == "2025-01-13T07:00:00"
    assert out["timestamp_realizacao"] == "2025-01-13T09:45:00"  # paciente atendido
    assert out["unidade"] == "UROLOGIA (AMBULATÓRIO)"
    assert out["especialidade"] == "UROLOGIA HORMONIOTERAPIA"
    assert out["tipo_evento"] == "RETORNO"
    assert out["situacao"] == "PACIENTE ATENDIDO"


def test_consulta_falta_does_not_set_realizacao(sample_rows):
    """Linha com tipo=CONSULTA + Retorno=PACIENTE FALTOU."""
    out = map_consulta_row(sample_rows[1])
    assert out is not None
    # Fixture row 1: tipo=CONSULTA → tipo_entidade=CONSULTA, prefix C
    assert out["evento_id"] == "C-3972105"
    assert out["tipo_entidade"] == "CONSULTA"
    assert out["situacao"] == "PACIENTE FALTOU"
    assert out["timestamp_realizacao"] is None
    assert out["tipo_evento"] == "CONSULTA REGULADA"


def test_rejects_consulta_without_prontuario(sample_rows):
    out = map_consulta_row(sample_rows[2])
    assert out is None
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/test_mapper_consulta.py -v
```

Expected: FAIL com `ModuleNotFoundError`.

- [ ] **Step 4: Write `backend/src/pija/etl/mappers/consulta.py`**

```python
"""Mapper vw_consultas → CONSULTA ou PROCEDIMENTO (DADOS-ESTADO.md §4.2).

Split por coluna `tipo`:
- `tipo = "CONSULTA"`     → tipo_entidade = "CONSULTA",      evento_id prefix "C-"
- `tipo = "PROCEDIMENTO"` → tipo_entidade = "PROCEDIMENTO",  evento_id prefix "PA-"

Daniel/HC (29-05): "procedimentos estão pulverizados dentro das tabelas de
Consultas. Não há uma view isolada para isso. O time deve extrair essa
informação diretamente do histórico de consultas contido no CSV."
"""

from pija.etl.mappers.base import FatoRow, empty_to_none, first_nonempty
from pija.etl.parsers import parse_br_datetime, parse_br_id

REALIZACAO_STATUSES = {"PACIENTE ATENDIDO"}

# tipo do CSV → (tipo_entidade, prefixo evento_id)
TIPO_MAP: dict[str, tuple[str, str]] = {
    "CONSULTA": ("CONSULTA", "C"),
    "PROCEDIMENTO": ("PROCEDIMENTO", "PA"),  # PA = Procedimento Ambulatorial
}


def map_consulta_row(row: dict[str, str]) -> FatoRow | None:
    paciente_id = parse_br_id(
        first_nonempty(row, "Prontuario", "prontuario", "Prontuário")
    )
    if not paciente_id:
        return None

    entidade_raw = first_nonempty(row, "num_consulta", "id")
    entidade_id = parse_br_id(entidade_raw)
    if not entidade_id:
        return None

    agendamento = parse_br_datetime(row.get("Data/Hora da Consulta"))
    inicio = parse_br_datetime(row.get("Data/Hora de Início"))

    if not agendamento:
        return None

    retorno = empty_to_none(row.get("Retorno"))
    realizacao = inicio if retorno in REALIZACAO_STATUSES else None

    tipo_csv = (row.get("tipo") or "CONSULTA").strip().upper()
    tipo_entidade, prefix = TIPO_MAP.get(tipo_csv, ("CONSULTA", "C"))

    return {
        "evento_id": f"{prefix}-{entidade_id}",
        "paciente_id": paciente_id,
        "tipo_entidade": tipo_entidade,
        "entidade_id": entidade_id,
        "timestamp_principal": agendamento,
        "timestamp_agendamento": agendamento,
        "timestamp_realizacao": realizacao,
        "unidade": empty_to_none(row.get("Unidade Funcional")),
        "especialidade": empty_to_none(row.get("especialidade")),
        "tipo_evento": empty_to_none(row.get("Condição do Atendimento")),
        "situacao": retorno,
    }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && pytest tests/test_mapper_consulta.py -v
```

Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/src/pija/etl/mappers/consulta.py backend/tests/fixtures/vw_consultas_sample.csv backend/tests/test_mapper_consulta.py
git commit -m "Add CONSULTA mapper with PACIENTE ATENDIDO realizacao gate"
```

---

### Task 12: Mapper EXAME + fixture

**Files:**
- Create: `backend/src/pija/etl/mappers/exame.py`
- Create: `backend/tests/fixtures/vw_exames_sample.csv`
- Create: `backend/tests/test_mapper_exame.py`

- [ ] **Step 1: Write fixture `backend/tests/fixtures/vw_exames_sample.csv`**

```bash
cat > backend/tests/fixtures/vw_exames_sample.csv <<'EOF'
paciente_id,paciente_prontuario,atendimento_id,exame_id,nome_exame,nome_usual_exame,tipo_exame,data_hora_solicitacao,data_hora_agendamento,data_hora_coleta,data_hora_realizacao,data_hora_liberacao,unidade_executora_id,unidade_executora_sigla,unidade_executora_nome,especialidade_solicitante_sigla,especialidade_solicitante_nome,centro_custos_solicitante,profissional_solicitante,grade_solicitacao_id,condicao_exame,situacao_codigo,situacao
2.303.844,21.532.437,2.450.336,LDL,COLESTEROL LDL,COLESTEROL LDL,Laboratorial (SANGUE),"19/5/2026, 10:50",,"19/5/2026, 10:50","19/5/2026, 10:49",,133,BIOQ,UAC: BIOQUÍMICA,NUTRI,NUTRIÇÃO,NUTRICAO,J.A.F.,1.352.970,Regulado (OS53PL28),PE,PENDENTE
2.303.844,21.532.437,2.450.336,GLI,GLICOSE,GLICOSE,Laboratorial (SANGUE),"19/5/2026, 10:50",,"19/5/2026, 10:50","19/5/2026, 10:46","19/5/2026, 11:30",133,BIOQ,UAC: BIOQUÍMICA,NUTRI,NUTRIÇÃO,NUTRICAO,J.A.F.,1.352.970,Regulado (OS53PL28),LB,LIBERADO
1.917.069,19.170.695,2.450.337,RX_TORAX,RAIO X TORAX,RX TORAX,Imagem,"20/5/2026, 14:00","21/5/2026, 09:00","21/5/2026, 10:00","21/5/2026, 10:30","21/5/2026, 11:00",200,RX,UAC: RADIOLOGIA,PNEUMO,PNEUMOLOGIA,PNEUMO,L.M.,9.999.999,,LB,LIBERADO
EOF
```

- [ ] **Step 2: Write failing test `backend/tests/test_mapper_exame.py`**

```python
import csv
from pathlib import Path

import pytest

from pija.etl.mappers.exame import map_exame_row


def _read_rows(path: Path) -> list[dict[str, str]]:
    with open(path, encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        return list(reader)


@pytest.fixture
def sample_rows(fixtures_dir: str) -> list[dict[str, str]]:
    return _read_rows(Path(fixtures_dir) / "vw_exames_sample.csv")


def test_maps_exame_pendente(sample_rows):
    out = map_exame_row(sample_rows[0])
    assert out is not None
    assert out["tipo_entidade"] == "EXAME"
    assert out["paciente_id"] == "21532437"
    assert out["entidade_id"] == "LDL"  # exame_id é o código do tipo
    assert out["evento_id"].startswith("E-LDL-2450336-")
    assert out["timestamp_principal"] == "2026-05-19T10:50:00"
    assert out["timestamp_solicitacao"] == "2026-05-19T10:50:00"
    assert out["timestamp_agendamento"] is None
    assert out["timestamp_realizacao"] == "2026-05-19T10:49:00"
    assert out["timestamp_liberacao"] is None
    assert out["situacao"] == "PENDENTE"
    assert out["tipo_evento"] == "Laboratorial (SANGUE)"


def test_maps_exame_liberado(sample_rows):
    out = map_exame_row(sample_rows[1])
    assert out is not None
    assert out["timestamp_liberacao"] == "2026-05-19T11:30:00"
    assert out["situacao"] == "LIBERADO"


def test_maps_exame_imagem_with_agendamento(sample_rows):
    out = map_exame_row(sample_rows[2])
    assert out is not None
    assert out["timestamp_agendamento"] == "2026-05-21T09:00:00"
    assert out["tipo_evento"] == "Imagem"
    assert out["unidade"] == "UAC: RADIOLOGIA"
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/test_mapper_exame.py -v
```

Expected: FAIL com `ModuleNotFoundError`.

- [ ] **Step 4: Write `backend/src/pija/etl/mappers/exame.py`**

```python
"""Mapper vw_exames → tipo_entidade=EXAME (DADOS-ESTADO.md §4.3).

`exame_id` é o CÓDIGO do tipo de exame (LDL, GLI, RX_TORAX) — não é
único por linha. Chave composta para evento_id: exame_id + atendimento_id
+ índice global da linha no chunk (passado em `row_index`).
"""

from pija.etl.mappers.base import FatoRow, empty_to_none
from pija.etl.parsers import parse_br_datetime, parse_br_id


def map_exame_row(row: dict[str, str], *, row_index: int = 0) -> FatoRow | None:
    paciente_id = parse_br_id(row.get("paciente_prontuario"))
    if not paciente_id:
        return None

    exame_code = empty_to_none(row.get("exame_id"))
    atendimento_id = parse_br_id(row.get("atendimento_id"))
    if not exame_code or not atendimento_id:
        return None

    solicitacao = parse_br_datetime(row.get("data_hora_solicitacao"))
    if not solicitacao:
        return None

    return {
        "evento_id": f"E-{exame_code}-{atendimento_id}-{row_index}",
        "paciente_id": paciente_id,
        "tipo_entidade": "EXAME",
        "entidade_id": exame_code,
        "timestamp_principal": solicitacao,
        "timestamp_solicitacao": solicitacao,
        "timestamp_agendamento": parse_br_datetime(row.get("data_hora_agendamento")),
        "timestamp_realizacao": parse_br_datetime(row.get("data_hora_realizacao")),
        "timestamp_liberacao": parse_br_datetime(row.get("data_hora_liberacao")),
        "unidade": empty_to_none(row.get("unidade_executora_nome")),
        "especialidade": empty_to_none(row.get("especialidade_solicitante_nome")),
        "tipo_evento": empty_to_none(row.get("tipo_exame")),
        "situacao": empty_to_none(row.get("situacao")),
    }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && pytest tests/test_mapper_exame.py -v
```

Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/src/pija/etl/mappers/exame.py backend/tests/fixtures/vw_exames_sample.csv backend/tests/test_mapper_exame.py
git commit -m "Add EXAME mapper using paciente_prontuario as join key"
```

---

### Task 13: Mapper INTERNACAO (gera também ALTA) + fixture

**Files:**
- Create: `backend/src/pija/etl/mappers/internacao.py`
- Create: `backend/tests/fixtures/vw_internacoes_sample.csv`
- Create: `backend/tests/test_mapper_internacao.py`

- [ ] **Step 1: Write fixture `backend/tests/fixtures/vw_internacoes_sample.csv`**

```bash
cat > backend/tests/fixtures/vw_internacoes_sample.csv <<'EOF'
atendimento,id_internacao,prontuario,codigo_paciente,dthr_inicio,dthr_fim,tempo_permanencia_dias,Indica se alta manual,ind_saida_pac,Indica situação do sumário de alta,descricao_origem_evento,descricao_tipo_alta_medica,lto_lto_id,qrt_numero,unf_seq,unf_descricao,unf_sigla,unf_andar,local_atendimento,modalidade_assistencial,cid_codigo,cid_descricao,flag_obito_internacao,dt_obito,esp_seq,esp_sigla,esp_nome_especialidade,esp_nome_reduzido,med_codigo,med_nome_iniciais
2.310,2.408,19.249.655,1.924.965,"1/1/2015, 00:51","2/1/2015, 12:23",1,Alta Sem Sumário,S,INFORMATIZADO,EMERGENCIA OBSTETRICA,ALTA MÉDICA,0907C,49,23,9º NORTE,AC,9,INSTITUICAO_ABRIGO,,O00.9,GRAVIDEZ ECTÓPICA,N,,791,SGO,GINECOLOGIA E OBSTETRÍCIA,GINEC OBSTET,22,M.F.M.
2.312,2.410,19.086.248,1.908.624,"1/1/2015, 06:14",,18,Alta Sem Sumário,N,INFORMATIZADO,EMERGENCIA OBSTETRICA,,1011B,60,25,10º NORTE,CCEN,0,INSTITUICAO_ABRIGO,,N93.9,SANGRAMENTO,N,,791,SGO,GINECOLOGIA E OBSTETRÍCIA,GINEC OBSTET,22,M.F.M.
EOF
```

- [ ] **Step 2: Write failing test `backend/tests/test_mapper_internacao.py`**

```python
import csv
from pathlib import Path

import pytest

from pija.etl.mappers.internacao import map_internacao_row


def _read_rows(path: Path) -> list[dict[str, str]]:
    with open(path, encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        return list(reader)


@pytest.fixture
def sample_rows(fixtures_dir: str) -> list[dict[str, str]]:
    return _read_rows(Path(fixtures_dir) / "vw_internacoes_sample.csv")


def test_maps_internacao_with_alta(sample_rows):
    """Quando dthr_fim está preenchido, retorna 2 linhas: INTERNACAO + ALTA."""
    out = map_internacao_row(sample_rows[0])
    assert out is not None
    assert len(out) == 2

    internacao = next(e for e in out if e["tipo_entidade"] == "INTERNACAO")
    alta = next(e for e in out if e["tipo_entidade"] == "ALTA")

    assert internacao["evento_id"] == "I-2408"
    assert internacao["paciente_id"] == "19249655"
    assert internacao["timestamp_principal"] == "2015-01-01T00:51:00"
    assert internacao["timestamp_alta_administrativa"] == "2015-01-02T12:23:00"
    assert internacao["unidade"] == "9º NORTE"
    assert internacao["especialidade"] == "GINECOLOGIA E OBSTETRÍCIA"
    assert internacao["tipo_evento"] == "EMERGENCIA OBSTETRICA"
    assert internacao["situacao"] == "ALTA MÉDICA"

    assert alta["evento_id"] == "A-2408"
    assert alta["timestamp_principal"] == "2015-01-02T12:23:00"
    assert alta["tipo_evento"] == "ALTA MÉDICA"


def test_maps_internacao_em_curso_sem_alta(sample_rows):
    """Quando dthr_fim vazio, retorna apenas INTERNACAO (sem ALTA)."""
    out = map_internacao_row(sample_rows[1])
    assert out is not None
    assert len(out) == 1
    assert out[0]["tipo_entidade"] == "INTERNACAO"
    assert out[0]["timestamp_alta_administrativa"] is None
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/test_mapper_internacao.py -v
```

Expected: FAIL com `ModuleNotFoundError`.

- [ ] **Step 4: Write `backend/src/pija/etl/mappers/internacao.py`**

```python
"""Mapper vw_internacoes → tipo_entidade=INTERNACAO (e ALTA derivada).

Conforme DADOS-ESTADO.md §4.4 e §4.5. Cada linha gera 1 evento
INTERNACAO; se `dthr_fim` estiver preenchido, gera adicionalmente
1 evento ALTA.
"""

from pija.etl.mappers.base import FatoRow, empty_to_none
from pija.etl.parsers import parse_br_datetime, parse_br_id


def map_internacao_row(row: dict[str, str]) -> list[FatoRow] | None:
    paciente_id = parse_br_id(row.get("prontuario"))
    entidade_id = parse_br_id(row.get("id_internacao"))
    if not paciente_id or not entidade_id:
        return None

    inicio = parse_br_datetime(row.get("dthr_inicio"))
    if not inicio:
        return None

    fim = parse_br_datetime(row.get("dthr_fim"))
    unidade = empty_to_none(row.get("unf_descricao"))
    especialidade = empty_to_none(row.get("esp_nome_especialidade"))
    tipo_alta = empty_to_none(row.get("descricao_tipo_alta_medica"))
    origem = empty_to_none(row.get("descricao_origem_evento"))

    internacao: FatoRow = {
        "evento_id": f"I-{entidade_id}",
        "paciente_id": paciente_id,
        "tipo_entidade": "INTERNACAO",
        "entidade_id": entidade_id,
        "timestamp_principal": inicio,
        "timestamp_alta_administrativa": fim,
        "timestamp_alta_medica": fim,  # proxy — não há campo separado
        "unidade": unidade,
        "especialidade": especialidade,
        "tipo_evento": origem,
        "situacao": tipo_alta,
    }

    events: list[FatoRow] = [internacao]

    if fim:
        alta: FatoRow = {
            "evento_id": f"A-{entidade_id}",
            "paciente_id": paciente_id,
            "tipo_entidade": "ALTA",
            "entidade_id": entidade_id,
            "timestamp_principal": fim,
            "timestamp_alta_administrativa": fim,
            "unidade": unidade,
            "especialidade": especialidade,
            "tipo_evento": tipo_alta,
            "situacao": tipo_alta,
        }
        events.append(alta)

    return events
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && pytest tests/test_mapper_internacao.py -v
```

Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/src/pija/etl/mappers/internacao.py backend/tests/fixtures/vw_internacoes_sample.csv backend/tests/test_mapper_internacao.py
git commit -m "Add INTERNACAO mapper that also emits ALTA event when discharge present"
```

---

### Task 14: Mapper CIRURGIA/PROCEDIMENTO + fixture

**Files:**
- Create: `backend/src/pija/etl/mappers/cirurgia.py`
- Create: `backend/tests/fixtures/vw_cirurgias_sample.csv`
- Create: `backend/tests/test_mapper_cirurgia.py`

- [ ] **Step 1: Write fixture `backend/tests/fixtures/vw_cirurgias_sample.csv`**

(57 colunas é muito; uso só as colunas necessárias para o mapeamento + algumas extras realistas. Para reduzir, gero o header e preencho campos não usados como vazios.)

```bash
python << 'EOF'
import csv
from pathlib import Path

headers = [
    "Atendimento","CID","cirurgia_id","tempo_desde_ultima_cirurgia",
    "seq_cirurgia_unidade_funcional","seq_cirurgia_sala","data_inicio_cirurgia",
    "data_fim_cirurgia","sala","data_inicio_anestesia","data_fim_anestesia",
    "tempo_entre_entrada_sala_e_anestesia","tempo_entre_anestesia_e_cirugia",
    "tempo_entre_fim_cirurgia_e_fim_anestesia","tempo_entre_fim_anestesia_e_saida_sala",
    "duracao_cirurgia","taxa_ocupacao_sala_cirurgia","tempo_desde_abertura_bc",
    "situacao","Justificativa da Situacao","Justificativa do Cancelamento",
    "cancelada","origem","anestesia","Tipo Anestesia","Codigo do Paciente",
    "Prontuário","Data Conclusão","Criado em","Situação Descrição",
    "Entrada na Sala","Saída da Sala","Entrada Sala Recuperação",
    "Saída Sala Recuperação","ID Especialidade",
    "Tempo de Permanência na Sala de Recuperação",
    "Tempo de Permanência no Bloco Cirurgico","Especialidade","Unidade Funcional",
    "Centro de Custos","Procedimento Realizado","Procedimento Interno Realizado",
    "Utilizou O2?","Cirurgia Segura?","Antibiótico Profilático?","contaminacao",
    "Potencial_Contaminacao","Descrição Cirúrgica Adicionada","Confirma Nota Cirúrgica",
    "profissional_digitou_iniciais","Profissional Relizou [Cirurgião]_iniciais",
    "profissional_realizou_funcao","Profissional Responsável [Equipe]_iniciais",
    "profissional_responsavel_funcao","Nome Profissional Elaboração_iniciais",
    "Tipo do Procedimento","Natureza do Agendamento",
]

rows = [
    # Cirurgia RZDA (realizada)
    {
        "Atendimento": "1.458.992", "cirurgia_id": "62.246",
        "data_inicio_cirurgia": "26/2/2025, 13:25", "data_fim_cirurgia": "26/2/2025, 13:30",
        "situacao": "RZDA", "Codigo do Paciente": "1.546.329", "Prontuário": "15.463.292",
        "Entrada na Sala": "26/2/2025, 13:00", "Especialidade": "CIRURGIA VASCULAR",
        "Unidade Funcional": "BLOCO CIRURGICO", "Tipo do Procedimento": "CIRURGIA",
        "Natureza do Agendamento": "URGÊNCIA",
    },
    # PDT (procedimento) ELETIVA
    {
        "Atendimento": "1.459.000", "cirurgia_id": "62.247",
        "data_inicio_cirurgia": "27/2/2025, 09:00", "data_fim_cirurgia": "27/2/2025, 09:30",
        "situacao": "RZDA", "Codigo do Paciente": "1.546.330", "Prontuário": "15.463.293",
        "Entrada na Sala": "27/2/2025, 08:45", "Especialidade": "DERMATOLOGIA",
        "Unidade Funcional": "AMBULATORIO PROCEDIMENTO", "Tipo do Procedimento": "PDT",
        "Natureza do Agendamento": "ELETIVA",
    },
    # Cancelada — sem prontuario, deve ser rejeitada
    {
        "Atendimento": "1.460.000", "cirurgia_id": "62.248",
        "data_inicio_cirurgia": "28/2/2025, 10:00", "situacao": "CANC",
        "Codigo do Paciente": "1.546.331", "Prontuário": "",
        "Tipo do Procedimento": "CIRURGIA",
    },
]

out = Path("backend/tests/fixtures/vw_cirurgias_sample.csv")
with open(out, "w", encoding="utf-8", newline="") as fp:
    writer = csv.DictWriter(fp, fieldnames=headers)
    writer.writeheader()
    for r in rows:
        # garantir todas as colunas com valor (vazio se não setado)
        full = {h: r.get(h, "") for h in headers}
        writer.writerow(full)

print(f"wrote {out}")
EOF
```

- [ ] **Step 2: Write failing test `backend/tests/test_mapper_cirurgia.py`**

```python
import csv
from pathlib import Path

import pytest

from pija.etl.mappers.cirurgia import map_cirurgia_row


def _read_rows(path: Path) -> list[dict[str, str]]:
    with open(path, encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        return list(reader)


@pytest.fixture
def sample_rows(fixtures_dir: str) -> list[dict[str, str]]:
    return _read_rows(Path(fixtures_dir) / "vw_cirurgias_sample.csv")


def test_maps_cirurgia_realizada(sample_rows):
    out = map_cirurgia_row(sample_rows[0])
    assert out is not None
    assert out["tipo_entidade"] == "CIRURGIA"
    assert out["evento_id"] == "X-62246"
    assert out["paciente_id"] == "15463292"
    assert out["entidade_id"] == "62246"
    assert out["timestamp_principal"] == "2025-02-26T13:25:00"
    assert out["timestamp_agendamento"] == "2025-02-26T13:00:00"
    assert out["timestamp_realizacao"] == "2025-02-26T13:30:00"
    assert out["unidade"] == "BLOCO CIRURGICO"
    assert out["especialidade"] == "CIRURGIA VASCULAR"
    # tipo_evento combina Tipo do Procedimento + Natureza
    assert out["tipo_evento"] == "CIRURGIA/URGÊNCIA"
    assert out["situacao"] == "RZDA"


def test_pdt_stays_as_cirurgia_with_subtipo_in_tipo_evento(sample_rows):
    """Daniel/HC (29-05): PDT em cirurgias NÃO é equivalente a procedimento
    ambulatorial. Toda linha vira CIRURGIA; subtipo vai em tipo_evento."""
    out = map_cirurgia_row(sample_rows[1])
    assert out is not None
    assert out["tipo_entidade"] == "CIRURGIA"
    assert out["tipo_evento"] == "PDT/ELETIVA"


def test_rejects_row_without_prontuario(sample_rows):
    out = map_cirurgia_row(sample_rows[2])
    assert out is None
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/test_mapper_cirurgia.py -v
```

Expected: FAIL com `ModuleNotFoundError`.

- [ ] **Step 4: Write `backend/src/pija/etl/mappers/cirurgia.py`**

```python
"""Mapper vw_cirurgias → tipo_entidade=CIRURGIA (DADOS-ESTADO.md §4.6).

**Toda** linha de vw_cirurgias vira CIRURGIA. O subtipo (CIRURGIA vs PDT)
e a natureza (ELETIVA, URGÊNCIA, EMERGÊNCIA) são combinados em
`tipo_evento` no formato "{tipo}/{natureza}".

Daniel/HC (29-05): procedimentos ambulatoriais estão em vw_consultas
(coluna tipo=PROCEDIMENTO), NÃO aqui. PDT em cirurgias é "Procedimento
Diagnóstico-Terapêutico" do ambiente cirúrgico — outro conceito.
"""

from pija.etl.mappers.base import FatoRow, empty_to_none, first_nonempty
from pija.etl.parsers import parse_br_datetime, parse_br_id


def map_cirurgia_row(row: dict[str, str]) -> FatoRow | None:
    paciente_id = parse_br_id(
        first_nonempty(row, "Prontuário", "Prontuario", "prontuario")
    )
    entidade_id = parse_br_id(row.get("cirurgia_id"))
    if not paciente_id or not entidade_id:
        return None

    inicio = parse_br_datetime(row.get("data_inicio_cirurgia"))
    if not inicio:
        return None

    tipo_proc = empty_to_none(row.get("Tipo do Procedimento")) or "CIRURGIA"
    natureza = empty_to_none(row.get("Natureza do Agendamento"))
    tipo_evento = f"{tipo_proc}/{natureza}" if natureza else tipo_proc

    return {
        "evento_id": f"X-{entidade_id}",
        "paciente_id": paciente_id,
        "tipo_entidade": "CIRURGIA",
        "entidade_id": entidade_id,
        "timestamp_principal": inicio,
        "timestamp_agendamento": parse_br_datetime(row.get("Entrada na Sala")),
        "timestamp_realizacao": parse_br_datetime(row.get("data_fim_cirurgia")),
        "unidade": empty_to_none(row.get("Unidade Funcional")),
        "especialidade": empty_to_none(row.get("Especialidade")),
        "tipo_evento": tipo_evento,
        "situacao": empty_to_none(row.get("situacao")),
    }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && pytest tests/test_mapper_cirurgia.py -v
```

Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/src/pija/etl/mappers/cirurgia.py backend/tests/fixtures/vw_cirurgias_sample.csv backend/tests/test_mapper_cirurgia.py
git commit -m "Add CIRURGIA mapper that splits into CIRURGIA or PROCEDIMENTO by tipo"
```

---

### Task 15: ETL runner — skeleton + CLI + per-view dispatch

**Files:**
- Create: `backend/src/pija/etl/runner.py`

- [ ] **Step 1: Write `backend/src/pija/etl/runner.py`**

```python
"""ETL runner — orquestra leitura dos CSVs e inserção no SQLite local.

Uso:
    python -m pija.etl.runner [--sample N] [--view VIEW]

Sem --view, processa as 5 views em sequência.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
from collections.abc import Iterator
from datetime import datetime, timezone
from typing import Callable

from sqlalchemy import delete
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import make_engine, make_sessionmaker
from pija.etl.mappers.base import FatoRow, iter_mapped
from pija.etl.mappers.cirurgia import map_cirurgia_row
from pija.etl.mappers.consulta import map_consulta_row
from pija.etl.mappers.exame import map_exame_row
from pija.etl.mappers.internacao import map_internacao_row
from pija.etl.mappers.prontuario import map_pacientes_row
from pija.models.fato import EtlLog, FatoEvento
from pija.resources.factory import get_resource
from pija.settings import Settings

logger = logging.getLogger("pija.etl")

# Para EXAME precisamos passar row_index — wrapper de fechamento
def _make_exame_mapper() -> Callable[[dict[str, str]], FatoRow | None]:
    counter = {"i": 0}

    def _wrap(row: dict[str, str]) -> FatoRow | None:
        counter["i"] += 1
        return map_exame_row(row, row_index=counter["i"])

    return _wrap


# Cada entrada: (view_name, mapper)
VIEWS: list[tuple[str, Callable[[dict[str, str]], FatoRow | None | list[FatoRow]]]] = [
    ("vw_pacientes", map_pacientes_row),
    ("vw_consultas", map_consulta_row),
    ("vw_exames", _make_exame_mapper()),
    ("vw_internacoes", map_internacao_row),
    ("vw_cirurgias", map_cirurgia_row),
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


async def _upsert_batch(session: AsyncSession, batch: list[FatoRow], dt_carga: str) -> int:
    """Upsert por evento_id (ON CONFLICT DO UPDATE)."""
    if not batch:
        return 0
    for r in batch:
        r["dt_carga"] = dt_carga
    stmt = sqlite_insert(FatoEvento).values(batch)
    update_cols = {c: stmt.excluded[c] for c in FatoEvento.__table__.columns.keys() if c != "evento_id"}
    stmt = stmt.on_conflict_do_update(index_elements=["evento_id"], set_=update_cols)
    await session.execute(stmt)
    return len(batch)


async def run_view(
    session: AsyncSession,
    view: str,
    mapper: Callable,
    *,
    sample: int | None = None,
    batch_size: int = 1000,
) -> tuple[int, int, int, str | None]:
    """Roda ETL de uma view e retorna (rows_read, rows_loaded, rows_rejected, errors)."""
    resource = get_resource()
    dt_carga = _now_iso()

    rows_read = 0
    rows_loaded = 0
    rows_rejected = 0
    errors: list[str] = []

    batch: list[FatoRow] = []
    rows_iter: Iterator[dict[str, str]] = resource.iter_rows(view, sample=sample)
    try:
        for row in rows_iter:
            rows_read += 1
            try:
                result = mapper(row)
            except Exception as exc:  # noqa: BLE001 — soft-fail per row
                rows_rejected += 1
                if len(errors) < 10:
                    errors.append(f"row {rows_read}: {exc!r}")
                continue
            if result is None:
                rows_rejected += 1
                continue
            if isinstance(result, list):
                batch.extend(result)
            else:
                batch.append(result)
            if len(batch) >= batch_size:
                rows_loaded += await _upsert_batch(session, batch, dt_carga)
                await session.commit()
                batch = []
        if batch:
            rows_loaded += await _upsert_batch(session, batch, dt_carga)
            await session.commit()
    except Exception as exc:  # noqa: BLE001 — view-level error
        errors.append(f"view {view} aborted: {exc!r}")

    return rows_read, rows_loaded, rows_rejected, (json.dumps(errors) if errors else None)


async def run_etl(*, sample: int | None = None, only_view: str | None = None) -> None:
    settings = Settings()
    engine = make_engine(f"sqlite+aiosqlite:///{settings.sqlite_path}")
    SessionLocal = make_sessionmaker(engine)

    for view_name, mapper in VIEWS:
        if only_view and view_name != only_view:
            continue
        logger.info("Iniciando ETL: %s", view_name)
        started_at = _now_iso()
        async with SessionLocal() as session:
            rows_read, rows_loaded, rows_rejected, errors = await run_view(
                session, view_name, mapper, sample=sample
            )
            finished_at = _now_iso()
            log = EtlLog(
                view_name=view_name,
                started_at=started_at,
                finished_at=finished_at,
                rows_read=rows_read,
                rows_loaded=rows_loaded,
                rows_rejected=rows_rejected,
                errors=errors,
            )
            session.add(log)
            await session.commit()
        logger.info(
            "view=%s read=%d loaded=%d rejected=%d errors=%s",
            view_name, rows_read, rows_loaded, rows_rejected, "yes" if errors else "no",
        )

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="ETL CSV → SQLite (PIJA)")
    parser.add_argument("--sample", type=int, default=None, help="Limita leitura a N linhas por view (dev)")
    parser.add_argument("--view", type=str, default=None, help="Roda apenas a view especificada")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    asyncio.run(run_etl(sample=args.sample, only_view=args.view))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Smoke test — invoca CLI sem CSVs (espera no-op com erro de não-encontrado)**

```bash
cd backend && python -m pija.etl.runner --view vw_pacientes --sample 5 2>&1 | head -20
```

Expected: log com erro `FileNotFoundError` para `vw_pacientes_anonimizado.csv` (porque ainda não copiamos para `CSV_DIR` esperado), mas o runner deve registrar isso em `etl_log` sem crashar.

- [ ] **Step 3: Commit (sem teste isolado ainda — testado na Task 16)**

```bash
git add backend/src/pija/etl/runner.py
git commit -m "Add ETL runner with CLI, per-view dispatch and idempotent upsert"
```

---

### Task 16: Teste integração ETL end-to-end + idempotência

**Files:**
- Create: `backend/tests/test_etl_runner.py`

- [ ] **Step 1: Write failing test `backend/tests/test_etl_runner.py`**

```python
import shutil
from pathlib import Path

import pytest
from sqlalchemy import func, select

from pija.db import Base, make_engine, make_sessionmaker
from pija.etl.runner import run_etl
from pija.models.fato import EtlLog, FatoEvento


@pytest.fixture
def test_csv_dir(tmp_path: Path, fixtures_dir: str) -> Path:
    """Copia os 5 sample CSVs para um diretório temporário com nomes esperados."""
    src = Path(fixtures_dir)
    dst = tmp_path / "csv"
    dst.mkdir()
    mapping = {
        "vw_pacientes_sample.csv": "vw_pacientes_anonimizado.csv",
        "vw_consultas_sample.csv": "vw_consultas_anonimizado.csv",
        "vw_exames_sample.csv": "vw_exames_anonimizado.csv",
        "vw_internacoes_sample.csv": "vw_internacoes_anonimizado.csv",
        "vw_cirurgias_sample.csv": "vw_cirurgias_anonimizado.csv",
    }
    for sample_name, target_name in mapping.items():
        shutil.copy(src / sample_name, dst / target_name)
    return dst


@pytest.fixture
async def db_engine(tmp_path: Path):
    db_path = tmp_path / "pija_test.db"
    engine = make_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine, db_path
    await engine.dispose()


@pytest.mark.asyncio
async def test_etl_loads_all_views(monkeypatch, test_csv_dir: Path, db_engine):
    engine, db_path = db_engine
    monkeypatch.setenv("CSV_DIR", str(test_csv_dir))
    monkeypatch.setenv("SQLITE_PATH", str(db_path))
    monkeypatch.setenv("RESOURCE_MODE", "csv")
    monkeypatch.setenv("JWT_SECRET", "test-secret-not-for-production-min-32-chars")

    await run_etl(sample=None)

    SessionLocal = make_sessionmaker(engine)
    async with SessionLocal() as session:
        # 5 logs de ETL (um por view)
        logs = (await session.execute(select(EtlLog))).scalars().all()
        assert len(logs) == 5
        assert {l.view_name for l in logs} == {
            "vw_pacientes", "vw_consultas", "vw_exames",
            "vw_internacoes", "vw_cirurgias",
        }

        # Eventos por tipo_entidade
        by_tipo = dict(
            (await session.execute(
                select(FatoEvento.tipo_entidade, func.count())
                .group_by(FatoEvento.tipo_entidade)
            )).all()
        )
        # Fixture: 3 pacientes; 2 linhas válidas em consultas (1 tipo=PROCEDIMENTO,
        # 1 tipo=CONSULTA, 3a rejeitada); 3 exames; 2 internações (1a + ALTA);
        # 2 cirurgias válidas (ambas CIRURGIA — split PDT/CIRURGIA agora é só tipo_evento)
        assert by_tipo.get("PRONTUARIO") == 3
        assert by_tipo.get("CONSULTA") == 1       # fixture row 1 com tipo=CONSULTA
        assert by_tipo.get("PROCEDIMENTO") == 1   # fixture row 0 com tipo=PROCEDIMENTO
        assert by_tipo.get("EXAME") == 3
        assert by_tipo.get("INTERNACAO") == 2
        assert by_tipo.get("ALTA") == 1           # só a 1a internação tem alta
        assert by_tipo.get("CIRURGIA") == 2       # ambas linhas válidas (PDT vira CIRURGIA também)


@pytest.mark.asyncio
async def test_etl_is_idempotent(monkeypatch, test_csv_dir: Path, db_engine):
    """Rodar duas vezes não deve duplicar registros."""
    engine, db_path = db_engine
    monkeypatch.setenv("CSV_DIR", str(test_csv_dir))
    monkeypatch.setenv("SQLITE_PATH", str(db_path))
    monkeypatch.setenv("RESOURCE_MODE", "csv")
    monkeypatch.setenv("JWT_SECRET", "test-secret-not-for-production-min-32-chars")

    await run_etl()
    SessionLocal = make_sessionmaker(engine)
    async with SessionLocal() as session:
        first_count = (await session.execute(select(func.count(FatoEvento.evento_id)))).scalar()

    await run_etl()  # segunda execução
    async with SessionLocal() as session:
        second_count = (await session.execute(select(func.count(FatoEvento.evento_id)))).scalar()

    assert first_count == second_count, "ETL não é idempotente"

    # E o etl_log agora tem 10 registros (5 + 5)
    async with SessionLocal() as session:
        n_logs = (await session.execute(select(func.count(EtlLog.id)))).scalar()
        assert n_logs == 10


@pytest.mark.asyncio
async def test_etl_records_rejected_rows(monkeypatch, test_csv_dir: Path, db_engine):
    """Linhas inválidas (ex: sem prontuario) devem aparecer em etl_log.rows_rejected."""
    engine, db_path = db_engine
    monkeypatch.setenv("CSV_DIR", str(test_csv_dir))
    monkeypatch.setenv("SQLITE_PATH", str(db_path))
    monkeypatch.setenv("RESOURCE_MODE", "csv")
    monkeypatch.setenv("JWT_SECRET", "test-secret-not-for-production-min-32-chars")

    await run_etl()

    SessionLocal = make_sessionmaker(engine)
    async with SessionLocal() as session:
        log_consultas = (
            await session.execute(select(EtlLog).where(EtlLog.view_name == "vw_consultas"))
        ).scalars().first()
        # Fixture consultas: 3 linhas, 1 rejeitada (sem Prontuario)
        assert log_consultas.rows_read == 3
        assert log_consultas.rows_loaded == 2
        assert log_consultas.rows_rejected == 1

        log_cirurgias = (
            await session.execute(select(EtlLog).where(EtlLog.view_name == "vw_cirurgias"))
        ).scalars().first()
        # Fixture cirurgias: 3 linhas, 1 rejeitada (sem Prontuário)
        assert log_cirurgias.rows_read == 3
        assert log_cirurgias.rows_loaded == 2
        assert log_cirurgias.rows_rejected == 1
```

- [ ] **Step 2: Run test to verify behavior**

```bash
cd backend && pytest tests/test_etl_runner.py -v
```

Expected: PASS (3 testes).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_etl_runner.py
git commit -m "Add end-to-end ETL integration tests covering volumes, idempotency and rejections"
```

---

### Task 17: Smoke test contra os CSVs reais (sample 1000)

**Files:** nenhum arquivo novo — apenas validação manual

- [ ] **Step 1: Garantir CSV_DIR está apontando para `CSV-aghu/`**

```bash
cd backend && cat ../.env 2>/dev/null || cp ../.env.example ../.env
# Editar ../.env: CSV_DIR=../CSV-aghu (relativo a backend/) ou ./CSV-aghu absoluto
```

- [ ] **Step 2: Aplicar schema no banco real**

```bash
cd backend && alembic upgrade head
```

Expected: confirma `data/pija.db` com schema atual.

- [ ] **Step 3: Rodar ETL com `--sample 1000` por view**

```bash
cd backend && python -m pija.etl.runner --sample 1000 --verbose
```

Expected: logs mostrando carga de cada view; sem stacktrace; conclui em <30s.

- [ ] **Step 4: Verificar conteúdo do SQLite**

```bash
cd backend && python -c "
import sqlite3
conn = sqlite3.connect('data/pija.db')
cur = conn.cursor()

print('== Eventos por tipo_entidade ==')
for row in cur.execute('SELECT tipo_entidade, COUNT(*) FROM fato_eventos_jornada GROUP BY tipo_entidade ORDER BY 1'):
    print(f'  {row[0]:>15}: {row[1]:>7}')

print()
print('== Últimos 5 etl_log ==')
for row in cur.execute('SELECT view_name, rows_read, rows_loaded, rows_rejected FROM etl_log ORDER BY id DESC LIMIT 5'):
    print(f'  {row[0]:<20} read={row[1]:>5}  loaded={row[2]:>5}  rejected={row[3]:>4}')

print()
print('== Pacientes distintos ==')
cur.execute('SELECT COUNT(DISTINCT paciente_id) FROM fato_eventos_jornada')
print(f'  total: {cur.fetchone()[0]}')
"
```

Expected:
- 6 tipo_entidade presentes (PRONTUARIO, CONSULTA, EXAME, INTERNACAO, ALTA, CIRURGIA, PROCEDIMENTO)
- 5 linhas em etl_log com rows_read=1000 cada
- Pacientes distintos > 0

- [ ] **Step 5: Rodar de novo e confirmar idempotência (contagens não mudam)**

```bash
cd backend && python -m pija.etl.runner --sample 1000 --verbose
cd backend && python -c "
import sqlite3
conn = sqlite3.connect('data/pija.db')
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM fato_eventos_jornada')
print(f'Total eventos após rerun: {cur.fetchone()[0]}')
"
```

Expected: número total **não** dobrou.

- [ ] **Step 6: Commit nota de validação**

```bash
git commit --allow-empty -m "Validate ETL against real CSVs with --sample 1000 (idempotent, all 5 views)"
```

---

### Task 18: Rodar ETL completo (sem --sample) e validar

**Files:** nenhum — execução final

- [ ] **Step 1: Limpar banco (opcional — para tempo limpo)**

```bash
cd backend && rm -f data/pija.db && alembic upgrade head
```

- [ ] **Step 2: Executar ETL completo**

```bash
cd backend && time python -m pija.etl.runner --verbose 2>&1 | tee /tmp/etl_full.log
```

Expected: conclui sem erros. Tempo esperado: 5-15 min para os 685 MB. Memória estável (não estoura — confirma streaming).

- [ ] **Step 3: Validar volumes finais**

```bash
cd backend && python -c "
import sqlite3
conn = sqlite3.connect('data/pija.db')
cur = conn.cursor()

print('== Volumes finais por entidade ==')
for row in cur.execute('SELECT tipo_entidade, COUNT(*) FROM fato_eventos_jornada GROUP BY tipo_entidade ORDER BY COUNT(*) DESC'):
    print(f'  {row[0]:>15}: {row[1]:>10,}')

print()
print('== Etl_log da última execução ==')
for row in cur.execute('SELECT view_name, rows_read, rows_loaded, rows_rejected, ROUND((julianday(finished_at)-julianday(started_at))*86400, 1) as secs FROM etl_log ORDER BY id DESC LIMIT 5'):
    print(f'  {row[0]:<20} read={row[1]:>7}  loaded={row[2]:>7}  rejected={row[3]:>5}  {row[4]}s')

print()
print('== Faixa temporal coberta ==')
cur.execute('SELECT MIN(timestamp_principal), MAX(timestamp_principal) FROM fato_eventos_jornada')
print(f'  min={cur.fetchone()}')
cur.execute('SELECT MIN(timestamp_principal), MAX(timestamp_principal) FROM fato_eventos_jornada WHERE timestamp_principal != \"\"')
print(f'  range: {cur.fetchone()}')

print()
print('== Pacientes distintos ==')
cur.execute('SELECT COUNT(DISTINCT paciente_id) FROM fato_eventos_jornada')
print(f'  total: {cur.fetchone()[0]:,}')
"
```

Expected:
- PRONTUARIO ≈ 357k, CONSULTA ≈ algumas centenas de milhares, EXAME ≈ 980k, INTERNACAO ≈ 160k, ALTA ≈ <160k, CIRURGIA + PROCEDIMENTO ≈ 41k somados
- `rejected` < 1% por view
- Faixa temporal: 2015 a 2026
- Pacientes distintos: dezenas de milhares

- [ ] **Step 4: Final commit-empty para marcar entrega**

```bash
git commit --allow-empty -m "Complete F1 — full ETL run validated against 685MB real CSV dataset"
```

---

## Self-Review

1. **Spec coverage:**
   - SPEC.md Fase 0 (T0-1..T0-5): ✅ T0-1 já feito, T0-2 (backend) Tasks 1-2, T0-3 (frontend) **deliberadamente fora** (user pediu para focar em dados), T0-4 Task 3, T0-5 Tasks 1+pytest config.
   - SPEC.md Fase 1 (T1-1..T1-7): ✅ T1-1 Task 5, T1-2 Tasks 7-8, T1-3 Task 7, T1-4 Task 9, T1-5 Task 15, T1-6 (.sql extração) **dispensados nesta fase** — mappers Python substituem os .sql para CSV, pois SQL nativo só faz sentido contra views relacionais (volta na F5 com AghuResource), T1-7 Task 16.
   - Frontend (Fase 4): explicitamente fora do plano atual conforme directive do usuário.

2. **Placeholder scan:** verificado — nenhum TBD/TODO. Todos os blocos de código completos.

3. **Type consistency:** `FatoRow` definido em base.py, usado em todos os mappers. `BaseResource` Protocol consistente em factory e runner. `parse_br_*` retornam `str | None`.

4. **Ambiguidade:** `entidade_id` de EXAME usa o `exame_id` (código tipo "LDL") porque não há ID único por linha — documentado no mapper e no DADOS-ESTADO.md.

**Gate de saída do plano:**
- [ ] 18 tasks executadas
- [ ] `pytest -v` mostra todos os testes verdes
- [ ] `python -m pija.etl.runner` carrega 685MB de CSV em SQLite sem estourar memória
- [ ] `etl_log` populado a cada execução com rows_read / rows_loaded / rows_rejected
- [ ] Rerun não duplica registros
- [ ] PII de `vw_pacientes` nunca aparece no SQLite