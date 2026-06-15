# Fase 2 — 3 Endpoints Analíticos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar os 3 endpoints analíticos do MVP (`/api/v1/eventos`, `/api/v1/kpis/tempos-medios`, `/api/v1/gargalos`) com 5 KPIs determinísticos validados contra fixture com tolerância 0%.

**Architecture:** Toda agregação em SQL nativo (`.sql` files); uma camada `SqlRunner` executa o SQL via SQLAlchemy async sobre `fato_eventos_jornada`; providers Python aplicam regras finais (divisão soma/n, montagem global+breakdown, merge/sort/top-N do gargalos). Fluxo: `.sql → SqlRunner(Resources) → Providers → Controllers → Routers`.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy 2.0 Async + aiosqlite, pytest + pytest-asyncio + httpx.

**Spec de referência:** [docs/superpowers/specs/2026-06-12-fase-2-endpoints-design.md](../specs/2026-06-12-fase-2-endpoints-design.md)

**Refinamento sobre o spec:** cada KPI SQL retorna `SUM(diff_dias)` + `COUNT(*)` agrupado por dimensão (1 query). O provider divide `soma/n` por grupo e calcula o global como `Σsoma/Σn` (exato, sem dupla arredondamento). Isso mantém o cálculo temporal no SQL e a montagem em Python, e evita rodar a query cara do KPI-06 duas vezes.

---

## Convenções de ambiente (todos os comandos rodam do REPO ROOT)

```bash
source backend/venv/Scripts/activate
export JWT_SECRET="any-string-with-at-least-32-characters-yes"
cd backend && pytest -q   # ou pytest <caminho>::<teste> -v
```
> `conftest.py` já define `JWT_SECRET` e `SQLITE_PATH=:memory:` como defaults para testes.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `backend/src/pija/db.py` | + `sqlite_url(path)` helper |
| `backend/src/pija/main.py` | + lifespan (engine/sessionmaker em `app.state`) + registra routers |
| `backend/src/pija/deps.py` | `get_session` dependency |
| `backend/src/pija/resources/sql_runner.py` | `load_sql(name)` + `SqlRunner.fetch_all` |
| `backend/src/pija/schemas/common.py` | `GroupBy` enum |
| `backend/src/pija/schemas/eventos.py` | `EventoOut`, `EventosPage` |
| `backend/src/pija/schemas/kpis.py` | `KpiBreakdownItem`, `KpiResult`, `KpisResponse` |
| `backend/src/pija/schemas/gargalos.py` | `GargaloItem`, `GargalosResponse` |
| `backend/src/pija/sql/eventos_filtrados.sql` / `eventos_count.sql` | query de `/eventos` |
| `backend/src/pija/sql/kpis/kpi_0{1,3,5,6,7}_*.sql` | os 5 KPIs |
| `backend/src/pija/providers/{eventos,kpis,gargalos}_provider.py` | regras finais |
| `backend/src/pija/controllers/{eventos,kpis,gargalos}_controller.py` | orquestração |
| `backend/src/pija/routers/{eventos,kpis,gargalos}.py` | endpoints FastAPI |
| `backend/tests/fixtures/dataset.py` | `FIXTURE_ROWS` + `EXPECTED` |
| `backend/tests/fixtures/EXPECTED.md` | valores calculados à mão |
| `backend/tests/conftest.py` | + fixtures `analytic_sessionmaker`, `client` |
| `backend/tests/test_*.py` | testes por camada/endpoint |

---

## Task 1: App wiring — engine, sessionmaker, get_session

**Files:**
- Modify: `backend/src/pija/db.py`
- Modify: `backend/src/pija/main.py`
- Create: `backend/src/pija/deps.py`
- Test: `backend/tests/test_app_wiring.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_app_wiring.py`:
```python
from fastapi.testclient import TestClient

from pija.db import sqlite_url
from pija.main import app


def test_sqlite_url_builds_async_url():
    assert sqlite_url("./backend/data/pija.db") == "sqlite+aiosqlite:///./backend/data/pija.db"


def test_health_still_ok_after_wiring():
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "service": "pija-backend"}


def test_routers_registered():
    paths = {route.path for route in app.routes}
    assert "/api/v1/eventos" in paths
    assert "/api/v1/kpis/tempos-medios" in paths
    assert "/api/v1/gargalos" in paths
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_app_wiring.py -v`
Expected: FAIL — `ImportError: cannot import name 'sqlite_url'` / routers não registrados.

- [ ] **Step 3: Add `sqlite_url` to `db.py`**

Append to `backend/src/pija/db.py`:
```python
def sqlite_url(path: str) -> str:
    """Monta a URL async do SQLite a partir de um caminho de arquivo."""
    return f"sqlite+aiosqlite:///{path}"
```

- [ ] **Step 4: Create `deps.py`**

Create `backend/src/pija/deps.py`:
```python
from collections.abc import AsyncIterator

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """Dependency: cede uma AsyncSession ligada ao sessionmaker do app."""
    sessionmaker = request.app.state.sessionmaker
    async with sessionmaker() as session:
        yield session
```

- [ ] **Step 5: Wire lifespan + routers in `main.py`**

Replace the full contents of `backend/src/pija/main.py`:
```python
from contextlib import asynccontextmanager

from fastapi import FastAPI

from pija.db import make_engine, make_sessionmaker, sqlite_url
from pija.routers import eventos, gargalos, kpis
from pija.settings import Settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    engine = make_engine(sqlite_url(settings.sqlite_path))
    app.state.engine = engine
    app.state.sessionmaker = make_sessionmaker(engine)
    yield
    await engine.dispose()


app = FastAPI(title="PIJA", version="0.1.0", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "pija-backend"}


app.include_router(eventos.router)
app.include_router(kpis.router)
app.include_router(gargalos.router)
```
> Os módulos `routers/*` ainda não existem — este teste só passa após Tasks 5/12/13 criarem os routers. **Para destravar o import agora**, crie stubs vazios primeiro (Step 6).

- [ ] **Step 6: Create empty router stubs so import resolves**

Create `backend/src/pija/routers/__init__.py` (empty file).
Create `backend/src/pija/routers/eventos.py`:
```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["eventos"])
```
Create `backend/src/pija/routers/kpis.py`:
```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["kpis"])
```
Create `backend/src/pija/routers/gargalos.py`:
```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["gargalos"])
```
> `test_routers_registered` ainda falhará (paths não existem) até os endpoints serem adicionados. Marque-o com `@pytest.mark.xfail(reason="endpoints added in tasks 5/12/13", strict=False)` por enquanto e remova o marker na Task 13.

- [ ] **Step 7: Apply the xfail marker**

Edit `test_routers_registered` in `backend/tests/test_app_wiring.py`:
```python
import pytest


@pytest.mark.xfail(reason="endpoints added in tasks 5/12/13", strict=False)
def test_routers_registered():
    paths = {route.path for route in app.routes}
    assert "/api/v1/eventos" in paths
    assert "/api/v1/kpis/tempos-medios" in paths
    assert "/api/v1/gargalos" in paths
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_app_wiring.py -v`
Expected: PASS (2 passed, 1 xfailed).

- [ ] **Step 9: Commit**
```bash
git add backend/src/pija/db.py backend/src/pija/deps.py backend/src/pija/main.py backend/src/pija/routers/ backend/tests/test_app_wiring.py
git commit -m "F2: wire app lifespan, session dependency and router stubs"
```

---

## Task 2: SqlRunner (camada Resource analítica)

**Files:**
- Create: `backend/src/pija/resources/sql_runner.py`
- Create: `backend/src/pija/sql/__init__.py` (empty — marca o diretório)
- Test: `backend/tests/test_sql_runner.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_sql_runner.py`:
```python
import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from pija.resources.sql_runner import SqlRunner, load_sql


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.execute(text("CREATE TABLE t (a INTEGER, b TEXT)"))
        await conn.execute(text("INSERT INTO t (a, b) VALUES (1, 'x'), (2, 'y')"))
    sm = async_sessionmaker(engine, expire_on_commit=False)
    async with sm() as s:
        yield s
    await engine.dispose()


async def test_fetch_all_returns_list_of_dicts(session):
    runner = SqlRunner(session)
    rows = await runner.fetch_all("SELECT a, b FROM t WHERE a >= :min ORDER BY a", {"min": 1})
    assert rows == [{"a": 1, "b": "x"}, {"a": 2, "b": "y"}]


def test_load_sql_reads_and_caches(tmp_path, monkeypatch):
    import pija.resources.sql_runner as mod

    sql_dir = tmp_path / "sql"
    sql_dir.mkdir()
    (sql_dir / "demo.sql").write_text("SELECT 1", encoding="utf-8")
    monkeypatch.setattr(mod, "_SQL_DIR", sql_dir)
    mod._CACHE.clear()
    assert load_sql("demo.sql") == "SELECT 1"
    assert load_sql("demo.sql") == "SELECT 1"  # served from cache
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_sql_runner.py -v`
Expected: FAIL — module `pija.resources.sql_runner` not found.

- [ ] **Step 3: Implement `SqlRunner`**

Create `backend/src/pija/sql/__init__.py` (empty file).
Create `backend/src/pija/resources/sql_runner.py`:
```python
"""Camada Resource analítica: carrega arquivos .sql e os executa via async engine.

Mantém SQLAlchemy executando SOMENTE SQL nativo sobre a tabela interna
fato_eventos_jornada (guardrail SPEC §3-4).
"""

from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_SQL_DIR = Path(__file__).resolve().parent.parent / "sql"
_CACHE: dict[str, str] = {}


def load_sql(name: str) -> str:
    """Lê o arquivo sql/<name> (cacheado em memória)."""
    if name not in _CACHE:
        _CACHE[name] = (_SQL_DIR / name).read_text(encoding="utf-8")
    return _CACHE[name]


class SqlRunner:
    """Executa SQL nativo contra uma AsyncSession e devolve dicts."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def fetch_all(self, sql_text: str, params: dict | None = None) -> list[dict]:
        result = await self.session.execute(text(sql_text), params or {})
        return [dict(row) for row in result.mappings()]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_sql_runner.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**
```bash
git add backend/src/pija/resources/sql_runner.py backend/src/pija/sql/__init__.py backend/tests/test_sql_runner.py
git commit -m "F2: add SqlRunner analytic read layer with cached .sql loader"
```

---

## Task 3: Fixture determinística + EXPECTED.md + test fixtures

**Files:**
- Create: `backend/tests/fixtures/__init__.py` (empty)
- Create: `backend/tests/fixtures/dataset.py`
- Create: `backend/tests/fixtures/EXPECTED.md`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/test_fixture_dataset.py`

A fixture tem **16 eventos / 5 pacientes / 2 unidades (UA, UB)**. Todos os timestamps usam `T09:00:00` para que os diffs em dias sejam inteiros. PRONTUARIO não tem unidade.

- [ ] **Step 1: Create the dataset module**

Create `backend/tests/fixtures/__init__.py` (empty file).
Create `backend/tests/fixtures/dataset.py`:
```python
"""Dataset determinístico para validar os KPIs com tolerância 0%.

Cada linha já traz todas as colunas relevantes. Diffs em dias são inteiros
(todos os timestamps às 09:00). Ver EXPECTED.md para os valores calculados.
"""

DT_CARGA = "2026-06-12T00:00:00"


def _row(**kw):
    base = {
        "entidade_id": kw["evento_id"].split("-", 1)[1],
        "timestamp_solicitacao": None,
        "timestamp_agendamento": None,
        "timestamp_realizacao": None,
        "timestamp_liberacao": None,
        "timestamp_alta_medica": None,
        "timestamp_alta_administrativa": None,
        "unidade": None,
        "especialidade": None,
        "tipo_evento": None,
        "situacao": None,
        "dt_carga": DT_CARGA,
        "deleted_at": None,
    }
    base.update(kw)
    return base


# --- PRONTUARIO (KPI-01 início) ---
_PRONT = [
    _row(evento_id="P-1001", paciente_id="1001", tipo_entidade="PRONTUARIO",
         timestamp_principal="2026-01-01T09:00:00"),
    _row(evento_id="P-1002", paciente_id="1002", tipo_entidade="PRONTUARIO",
         timestamp_principal="2026-01-01T09:00:00"),
    _row(evento_id="P-1003", paciente_id="1003", tipo_entidade="PRONTUARIO",
         timestamp_principal="2026-01-10T09:00:00"),
]

# --- CONSULTA (KPI-03; primeiro evento de 1001) ---
_CONS = [
    _row(evento_id="C-2001", paciente_id="1001", tipo_entidade="CONSULTA",
         timestamp_principal="2026-01-11T09:00:00", timestamp_agendamento="2026-01-11T09:00:00",
         timestamp_realizacao="2026-01-14T09:00:00", unidade="UA", especialidade="ESP1"),
    _row(evento_id="C-2002", paciente_id="1002", tipo_entidade="CONSULTA",
         timestamp_principal="2026-03-01T09:00:00", timestamp_agendamento="2026-03-01T09:00:00",
         timestamp_realizacao="2026-03-06T09:00:00", unidade="UB", especialidade="ESP1"),
    _row(evento_id="C-2004", paciente_id="1001", tipo_entidade="CONSULTA",
         timestamp_principal="2026-04-01T09:00:00", timestamp_agendamento="2026-04-01T09:00:00",
         timestamp_realizacao=None, unidade="UA", especialidade="ESP1"),  # não atendida
    _row(evento_id="C-2005", paciente_id="1005", tipo_entidade="CONSULTA",
         timestamp_principal="2026-02-10T09:00:00", timestamp_agendamento="2026-02-10T09:00:00",
         timestamp_realizacao="2026-02-12T09:00:00", unidade="UB", especialidade="ESP1"),
    _row(evento_id="C-2007", paciente_id="1002", tipo_entidade="CONSULTA",
         timestamp_principal="2026-03-20T09:00:00", timestamp_agendamento="2026-03-20T09:00:00",
         timestamp_realizacao="2026-03-26T09:00:00", unidade="UA", especialidade="ESP1"),
]

# --- EXAME (KPI-05; E-4002 é primeiro evento de 1002) ---
_EXA = [
    _row(evento_id="E-4001", paciente_id="1001", tipo_entidade="EXAME",
         timestamp_principal="2026-05-01T09:00:00", timestamp_solicitacao="2026-05-01T09:00:00",
         timestamp_realizacao=None, unidade="UA", especialidade="ESP1"),  # sem realização
    _row(evento_id="E-4002", paciente_id="1002", tipo_entidade="EXAME",
         timestamp_principal="2026-01-05T09:00:00", timestamp_solicitacao="2026-01-05T09:00:00",
         timestamp_realizacao="2026-01-07T09:00:00", unidade="UB", especialidade="ESP1"),
    _row(evento_id="E-4003", paciente_id="1003", tipo_entidade="EXAME",
         timestamp_principal="2026-02-01T09:00:00", timestamp_solicitacao="2026-02-01T09:00:00",
         timestamp_realizacao="2026-02-05T09:00:00", unidade="UA", especialidade="ESP1"),
    _row(evento_id="E-4004", paciente_id="1001", tipo_entidade="EXAME",
         timestamp_principal="2026-05-10T09:00:00", timestamp_solicitacao="2026-05-10T09:00:00",
         timestamp_realizacao="2026-05-16T09:00:00", unidade="UA", especialidade="ESP1"),
]

# --- INTERNACAO (KPI-07 permanência; KPI-06 destino) ---
_INT = [
    _row(evento_id="I-3001", paciente_id="1001", tipo_entidade="INTERNACAO",
         timestamp_principal="2026-01-24T09:00:00",
         timestamp_alta_administrativa="2026-01-29T09:00:00",
         timestamp_alta_medica="2026-01-29T09:00:00", unidade="UA", especialidade="ESP1"),
    _row(evento_id="I-3003", paciente_id="1003", tipo_entidade="INTERNACAO",
         timestamp_principal="2026-01-20T09:00:00",
         timestamp_alta_administrativa="2026-01-25T09:00:00",
         timestamp_alta_medica="2026-01-25T09:00:00", unidade="UA", especialidade="ESP1"),
    _row(evento_id="I-3005", paciente_id="1005", tipo_entidade="INTERNACAO",
         timestamp_principal="2026-02-20T09:00:00",
         timestamp_alta_administrativa="2026-02-25T09:00:00",
         timestamp_alta_medica="2026-02-25T09:00:00", unidade="UB", especialidade="ESP1"),
    _row(evento_id="I-3006", paciente_id="1002", tipo_entidade="INTERNACAO",
         timestamp_principal="2026-03-10T09:00:00",
         timestamp_alta_administrativa=None, unidade="UB", especialidade="ESP1"),  # sem alta
]

FIXTURE_ROWS = _PRONT + _CONS + _EXA + _INT  # 16 linhas

# Valores esperados (group_by=unidade). Ver EXPECTED.md para a derivação.
EXPECTED = {
    "KPI-01": {"global": 8.0, "n": 3, "UA": (10.0, 2), "UB": (4.0, 1)},
    "KPI-03": {"global": 4.0, "n": 4, "UA": (4.5, 2), "UB": (3.5, 2)},
    "KPI-05": {"global": 4.0, "n": 3, "UA": (5.0, 2), "UB": (2.0, 1)},
    "KPI-06": {"global": 9.0, "n": 2, "UA": (10.0, 1), "UB": (8.0, 1)},
    "KPI-07": {"global": 5.0, "n": 3, "UA": (5.0, 2), "UB": (5.0, 1)},
}

# Contagens esperadas de /eventos
EXPECTED_EVENTOS = {
    "total": 16,
    "tipo_CONSULTA": 5,
    "unidade_UA": 8,
    "data_inicio_2026-03-01": 6,
}

# Ordem esperada de /gargalos (codes 03,05,06,07; group_by=unidade;
# sort key = (-media, transicao, dimensao)).
EXPECTED_GARGALOS = [
    ("KPI-06", "UA", 10.0),
    ("KPI-06", "UB", 8.0),
    ("KPI-05", "UA", 5.0),
    ("KPI-07", "UA", 5.0),
    ("KPI-07", "UB", 5.0),
    ("KPI-03", "UA", 4.5),
    ("KPI-03", "UB", 3.5),
    ("KPI-05", "UB", 2.0),
]
```

- [ ] **Step 2: Write EXPECTED.md (derivação à mão)**

Create `backend/tests/fixtures/EXPECTED.md`:
```markdown
# Valores esperados da fixture (group_by=unidade)

Diffs em dias (todos os timestamps às 09:00 → diffs inteiros).

## KPI-01 prontuário → 1º evento clínico
- 1001: 1º evento C-2001 (2026-01-11) − prontuário (2026-01-01) = 10 (UA)
- 1002: 1º evento E-4002 (2026-01-05) − prontuário (2026-01-01) = 4 (UB)
- 1003: 1º evento I-3003 (2026-01-20) − prontuário (2026-01-10) = 10 (UA)
- UA: (10+10)/2 = 10.0 (n=2) | UB: 4.0 (n=1) | global: 24/3 = 8.0 (n=3)

## KPI-03 consulta agendamento → realização (realizacao não-nula)
- C-2001: 14−11 = 3 (UA) | C-2007: 26−20 = 6 (UA) | C-2002: 6−1 = 5 (UB) | C-2005: 12−10 = 2 (UB)
- C-2004 excluída (realizacao NULL)
- UA: (3+6)/2 = 4.5 (n=2) | UB: (5+2)/2 = 3.5 (n=2) | global: 16/4 = 4.0 (n=4)

## KPI-05 exame solicitação → realização (realizacao não-nula)
- E-4003: 5−1 = 4 (UA) | E-4004: 16−10 = 6 (UA) | E-4002: 7−5 = 2 (UB)
- E-4001 excluído (realizacao NULL)
- UA: (4+6)/2 = 5.0 (n=2) | UB: 2.0 (n=1) | global: 12/3 = 4.0 (n=3)

## KPI-06 última consulta realizada → internação subsequente
- 1001: I-3001 (01-24) − última consulta realizada antes (C-2001 realiz 01-14) = 10 (UA)
- 1005: I-3005 (02-20) − última consulta realizada antes (C-2005 realiz 02-12) = 8 (UB)
- 1003: I-3003 não tem consulta realizada antes → excluída
- 1002: I-3006 sem alta não afeta KPI-06; tem consultas mas todas após I-3006? C-2002 realiz 03-06 < I-3006 03-10 → na verdade 1002 entra: I-3006 (03-10) − C-2002 (03-06) = 4 (UB). **Atenção:** ver nota.
```
> **NOTA IMPORTANTE (resolver na Task 11):** I-3006 (1002) tem consulta realizada antes (C-2002, 03-06), então KPI-06 incluiria 1002 com 4 dias (UB). Isso mudaria os esperados de KPI-06. **Para manter a fixture limpa, ajuste C-2002 para realizacao posterior a I-3006** OU aceite o terceiro ponto. Ver Step 3.

- [ ] **Step 3: Corrigir interferência KPI-06 × 1002 na fixture**

Para manter o EXPECTED de KPI-06 = {UA:10/n1, UB:8/n1, global:9/n2}, a consulta C-2002 (1002, realiz 2026-03-06) NÃO pode anteceder a internação sem alta I-3006 (2026-03-10) de forma a entrar no KPI-06. Mas I-3006 entra no KPI-06 (tem alta? não — mas KPI-06 não exige alta; exige consulta anterior). **Decisão de fixture:** remover o paciente 1002 do KPI-06 movendo I-3006 para um paciente sem consulta realizada anterior.

Edit `_INT` em `dataset.py`: troque o `paciente_id` de **I-3006** de `"1002"` para `"1009"` (paciente novo, só com essa internação sem alta, sem consulta anterior):
```python
    _row(evento_id="I-3006", paciente_id="1009", tipo_entidade="INTERNACAO",
         timestamp_principal="2026-03-10T09:00:00",
         timestamp_alta_administrativa=None, unidade="UB", especialidade="ESP1"),  # sem alta, sem consulta prévia
```
Agora KPI-06: só 1001 (10, UA) e 1005 (8, UB). 1009 não tem consulta realizada antes → excluído. 1003 idem. ✓ EXPECTED["KPI-06"] permanece válido. `EXPECTED_EVENTOS["total"]` continua 16 (5 pacientes viram 6, mas ainda 16 eventos; `unidade_UA`=8 inalterado pois I-3006 é UB).

Atualize a seção KPI-06 do `EXPECTED.md` removendo a NOTA e fixando:
```markdown
## KPI-06 última consulta realizada → internação subsequente
- 1001: I-3001 (01-24) − C-2001 realiz (01-14) = 10 (UA)
- 1005: I-3005 (02-20) − C-2005 realiz (02-12) = 8 (UB)
- 1003 (I-3003) e 1009 (I-3006): sem consulta realizada antes → excluídos
- UA: 10.0 (n=1) | UB: 8.0 (n=1) | global: 18/2 = 9.0 (n=2)

## KPI-07 internação permanência (alta_administrativa não-nula)
- I-3001: 29−24 = 5 (UA) | I-3003: 25−20 = 5 (UA) | I-3005: 25−20 = 5 (UB)
- I-3006 excluída (sem alta)
- UA: 5.0 (n=2) | UB: 5.0 (n=1) | global: 15/3 = 5.0 (n=3)

## /eventos
- total: 16 | tipo_entidade=CONSULTA: 5 | unidade=UA: 8 | data_inicio=2026-03-01: 6
```

- [ ] **Step 4: Add pytest fixtures to conftest.py**

Append to `backend/tests/conftest.py`:
```python
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from pija.db import Base
from pija.deps import get_session
from pija.main import app
from pija.models.fato import FatoEvento
from tests.fixtures.dataset import FIXTURE_ROWS


@pytest_asyncio.fixture
async def analytic_sessionmaker(tmp_path):
    db_path = tmp_path / "fixture.sqlite"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for row in FIXTURE_ROWS:
            await conn.execute(insert(FatoEvento).values(**row))
    sm = async_sessionmaker(engine, expire_on_commit=False)
    yield sm
    await engine.dispose()


@pytest_asyncio.fixture
async def client(analytic_sessionmaker):
    async def _override():
        async with analytic_sessionmaker() as session:
            yield session

    app.dependency_overrides[get_session] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```
> `tests/fixtures/dataset.py` é importado como `tests.fixtures.dataset` — `tests/__init__.py` e `tests/fixtures/__init__.py` devem existir. Crie `backend/tests/__init__.py` (empty) se ainda não existir.

- [ ] **Step 5: Sanity test for the fixture**

Create `backend/tests/test_fixture_dataset.py`:
```python
from sqlalchemy import func, select

from pija.models.fato import FatoEvento
from tests.fixtures.dataset import EXPECTED_EVENTOS, FIXTURE_ROWS


def test_fixture_has_expected_row_count():
    assert len(FIXTURE_ROWS) == 16


async def test_fixture_loads_into_db(analytic_sessionmaker):
    async with analytic_sessionmaker() as s:
        total = await s.scalar(select(func.count()).select_from(FatoEvento))
    assert total == EXPECTED_EVENTOS["total"]
```

- [ ] **Step 6: Run tests**

Run: `cd backend && pytest tests/test_fixture_dataset.py -v`
Expected: PASS (2 passed).

- [ ] **Step 7: Commit**
```bash
git add backend/tests/fixtures/ backend/tests/conftest.py backend/tests/test_fixture_dataset.py backend/tests/__init__.py
git commit -m "F2: add deterministic KPI fixture, EXPECTED.md and test harness"
```

---

## Task 4: Schemas — common, eventos

**Files:**
- Create: `backend/src/pija/schemas/__init__.py` (empty)
- Create: `backend/src/pija/schemas/common.py`
- Create: `backend/src/pija/schemas/eventos.py`
- Test: `backend/tests/test_schemas.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_schemas.py`:
```python
import pytest
from pydantic import ValidationError

from pija.schemas.common import GroupBy
from pija.schemas.eventos import EventoOut, EventosPage


def test_groupby_accepts_valid_values():
    assert GroupBy("unidade") == GroupBy.unidade
    assert GroupBy("especialidade") == GroupBy.especialidade


def test_groupby_rejects_invalid():
    with pytest.raises(ValueError):
        GroupBy("paciente_id")


def test_eventos_page_shape():
    page = EventosPage(
        items=[EventoOut(evento_id="C-1", paciente_id="9", tipo_entidade="CONSULTA",
                         entidade_id="1", timestamp_principal="2026-01-01T09:00:00",
                         unidade="UA", especialidade="ESP1", tipo_evento=None, situacao=None)],
        total=1, limit=50, offset=0,
    )
    assert page.total == 1
    assert page.items[0].evento_id == "C-1"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_schemas.py -v`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement schemas**

Create `backend/src/pija/schemas/__init__.py` (empty file).
Create `backend/src/pija/schemas/common.py`:
```python
from enum import Enum


class GroupBy(str, Enum):
    """Dimensões permitidas para breakdown/agrupamento (whitelist)."""

    unidade = "unidade"
    especialidade = "especialidade"


# Mapa whitelist enum → coluna SQL (impede injeção via group_by).
GROUP_COL: dict["GroupBy", str] = {
    GroupBy.unidade: "unidade",
    GroupBy.especialidade: "especialidade",
}
```
Create `backend/src/pija/schemas/eventos.py`:
```python
from pydantic import BaseModel


class EventoOut(BaseModel):
    evento_id: str
    paciente_id: str
    tipo_entidade: str
    entidade_id: str
    timestamp_principal: str
    unidade: str | None
    especialidade: str | None
    tipo_evento: str | None
    situacao: str | None


class EventosPage(BaseModel):
    items: list[EventoOut]
    total: int
    limit: int
    offset: int
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_schemas.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**
```bash
git add backend/src/pija/schemas/ backend/tests/test_schemas.py
git commit -m "F2: add GroupBy enum and eventos Pydantic schemas"
```

---

## Task 5: `/eventos` — SQL, provider, controller, router

**Files:**
- Create: `backend/src/pija/sql/eventos_filtrados.sql`, `backend/src/pija/sql/eventos_count.sql`
- Create: `backend/src/pija/providers/__init__.py` (empty), `backend/src/pija/providers/eventos_provider.py`
- Create: `backend/src/pija/controllers/__init__.py` (empty), `backend/src/pija/controllers/eventos_controller.py`
- Modify: `backend/src/pija/routers/eventos.py`
- Test: `backend/tests/test_eventos_endpoint.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_eventos_endpoint.py`:
```python
from tests.fixtures.dataset import EXPECTED_EVENTOS


async def test_eventos_no_filter_returns_total(client):
    resp = await client.get("/api/v1/eventos")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == EXPECTED_EVENTOS["total"]
    assert len(body["items"]) == EXPECTED_EVENTOS["total"]


async def test_eventos_filter_tipo_entidade(client):
    resp = await client.get("/api/v1/eventos", params={"tipo_entidade": "CONSULTA"})
    body = resp.json()
    assert body["total"] == EXPECTED_EVENTOS["tipo_CONSULTA"]
    assert all(i["tipo_entidade"] == "CONSULTA" for i in body["items"])


async def test_eventos_filter_unidade(client):
    resp = await client.get("/api/v1/eventos", params={"unidade": "UA"})
    assert resp.json()["total"] == EXPECTED_EVENTOS["unidade_UA"]


async def test_eventos_filter_data_inicio(client):
    resp = await client.get("/api/v1/eventos", params={"data_inicio": "2026-03-01"})
    assert resp.json()["total"] == EXPECTED_EVENTOS["data_inicio_2026-03-01"]


async def test_eventos_pagination(client):
    resp = await client.get("/api/v1/eventos", params={"limit": 5, "offset": 0})
    body = resp.json()
    assert len(body["items"]) == 5
    assert body["total"] == 16
    assert body["limit"] == 5


async def test_eventos_invalid_limit_returns_422(client):
    resp = await client.get("/api/v1/eventos", params={"limit": 0})
    assert resp.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_eventos_endpoint.py -v`
Expected: FAIL — 404 (endpoint não existe).

- [ ] **Step 3: Write the SQL files**

Create `backend/src/pija/sql/eventos_filtrados.sql`:
```sql
SELECT evento_id, paciente_id, tipo_entidade, entidade_id,
       timestamp_principal, unidade, especialidade, tipo_evento, situacao
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND (:tipo_entidade IS NULL OR tipo_entidade = :tipo_entidade)
  AND (:unidade IS NULL OR unidade = :unidade)
  AND (:especialidade IS NULL OR especialidade = :especialidade)
  AND (:data_inicio IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim IS NULL OR timestamp_principal <= :data_fim)
ORDER BY timestamp_principal DESC, evento_id
LIMIT :limit OFFSET :offset
```
Create `backend/src/pija/sql/eventos_count.sql`:
```sql
SELECT COUNT(*) AS total
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND (:tipo_entidade IS NULL OR tipo_entidade = :tipo_entidade)
  AND (:unidade IS NULL OR unidade = :unidade)
  AND (:especialidade IS NULL OR especialidade = :especialidade)
  AND (:data_inicio IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim IS NULL OR timestamp_principal <= :data_fim)
```

- [ ] **Step 4: Write the provider**

Create `backend/src/pija/providers/__init__.py` (empty file).
Create `backend/src/pija/providers/eventos_provider.py`:
```python
from sqlalchemy.ext.asyncio import AsyncSession

from pija.resources.sql_runner import SqlRunner, load_sql
from pija.schemas.eventos import EventoOut, EventosPage


async def list_eventos(session: AsyncSession, filters: dict, limit: int, offset: int) -> EventosPage:
    runner = SqlRunner(session)
    count_params = dict(filters)
    total_rows = await runner.fetch_all(load_sql("eventos_count.sql"), count_params)
    total = int(total_rows[0]["total"]) if total_rows else 0

    page_params = {**filters, "limit": limit, "offset": offset}
    rows = await runner.fetch_all(load_sql("eventos_filtrados.sql"), page_params)
    items = [EventoOut(**row) for row in rows]
    return EventosPage(items=items, total=total, limit=limit, offset=offset)
```

- [ ] **Step 5: Write the controller**

Create `backend/src/pija/controllers/__init__.py` (empty file).
Create `backend/src/pija/controllers/eventos_controller.py`:
```python
from sqlalchemy.ext.asyncio import AsyncSession

from pija.providers.eventos_provider import list_eventos
from pija.schemas.eventos import EventosPage


async def get_eventos(
    session: AsyncSession,
    *,
    tipo_entidade: str | None,
    unidade: str | None,
    especialidade: str | None,
    data_inicio: str | None,
    data_fim: str | None,
    limit: int,
    offset: int,
) -> EventosPage:
    filters = {
        "tipo_entidade": tipo_entidade,
        "unidade": unidade,
        "especialidade": especialidade,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
    }
    return await list_eventos(session, filters, limit, offset)
```

- [ ] **Step 6: Write the router**

Replace `backend/src/pija/routers/eventos.py`:
```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.controllers.eventos_controller import get_eventos
from pija.deps import get_session
from pija.schemas.eventos import EventosPage

router = APIRouter(prefix="/api/v1", tags=["eventos"])


@router.get("/eventos", response_model=EventosPage)
async def listar_eventos(
    tipo_entidade: str | None = None,
    unidade: str | None = None,
    especialidade: str | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> EventosPage:
    return await get_eventos(
        session,
        tipo_entidade=tipo_entidade,
        unidade=unidade,
        especialidade=especialidade,
        data_inicio=data_inicio,
        data_fim=data_fim,
        limit=limit,
        offset=offset,
    )
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_eventos_endpoint.py -v`
Expected: PASS (6 passed).

- [ ] **Step 8: Commit**
```bash
git add backend/src/pija/sql/eventos_*.sql backend/src/pija/providers/ backend/src/pija/controllers/ backend/src/pija/routers/eventos.py backend/tests/test_eventos_endpoint.py
git commit -m "F2: implement GET /api/v1/eventos with filters and pagination"
```

---

## Task 6: KPI schemas + `compute_kpi` infra

**Files:**
- Create: `backend/src/pija/schemas/kpis.py`
- Create: `backend/src/pija/providers/kpis_provider.py`
- Test: `backend/tests/test_kpis_provider.py` (KPI-03 only nesta task — é o padrão single-table)
- Create: `backend/src/pija/sql/kpis/__init__.py` (empty) + `backend/src/pija/sql/kpis/kpi_03_consulta_agend_realiz.sql`

- [ ] **Step 1: Write the failing test (KPI-03)**

Create `backend/tests/test_kpis_provider.py`:
```python
import pytest

from pija.providers.kpis_provider import compute_kpi
from pija.resources.sql_runner import SqlRunner
from pija.schemas.common import GroupBy
from tests.fixtures.dataset import EXPECTED

NO_FILTERS = {"unidade": None, "especialidade": None, "data_inicio": None, "data_fim": None}


def _bd(result):
    return {b.dimensao: (b.media, b.n) for b in result.breakdown}


@pytest.mark.parametrize("code", ["KPI-03"])
async def test_kpi_matches_expected(analytic_sessionmaker, code):
    async with analytic_sessionmaker() as s:
        result = await compute_kpi(SqlRunner(s), code, GroupBy.unidade, dict(NO_FILTERS))
    exp = EXPECTED[code]
    assert result.codigo == code
    assert result.media_global == pytest.approx(exp["global"], abs=1e-9)
    assert result.n_global == exp["n"]
    bd = _bd(result)
    assert bd["UA"][0] == pytest.approx(exp["UA"][0], abs=1e-9)
    assert bd["UA"][1] == exp["UA"][1]
    assert bd["UB"][0] == pytest.approx(exp["UB"][0], abs=1e-9)
    assert bd["UB"][1] == exp["UB"][1]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_kpis_provider.py -v`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write KPI schemas**

Create `backend/src/pija/schemas/kpis.py`:
```python
from pydantic import BaseModel


class KpiBreakdownItem(BaseModel):
    dimensao: str
    media: float
    n: int


class KpiResult(BaseModel):
    codigo: str
    descricao: str
    unidade_tempo: str = "dias"
    media_global: float | None
    n_global: int
    breakdown: list[KpiBreakdownItem]


class KpisResponse(BaseModel):
    kpis: list[KpiResult]
```

- [ ] **Step 4: Write the KPI-03 SQL**

Create `backend/src/pija/sql/kpis/__init__.py` (empty file).
Create `backend/src/pija/sql/kpis/kpi_03_consulta_agend_realiz.sql`:
```sql
SELECT {group_col} AS dimensao,
       SUM(julianday(timestamp_realizacao) - julianday(timestamp_agendamento)) AS soma_dias,
       COUNT(*) AS n
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND tipo_entidade = 'CONSULTA'
  AND timestamp_realizacao IS NOT NULL
  AND (:unidade IS NULL OR unidade = :unidade)
  AND (:especialidade IS NULL OR especialidade = :especialidade)
  AND (:data_inicio IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim IS NULL OR timestamp_principal <= :data_fim)
GROUP BY {group_col}
```

- [ ] **Step 5: Write `kpis_provider.py` with `compute_kpi`**

Create `backend/src/pija/providers/kpis_provider.py`:
```python
"""Provider dos KPIs de tempo médio.

Cada KPI SQL devolve, por dimensão, SUM(diff_dias) e COUNT(*). O provider
divide soma/n por grupo (média do grupo) e calcula o global como Σsoma/Σn
(exato). Cálculo temporal fica no SQL; montagem fica em Python.
"""

from pija.resources.sql_runner import SqlRunner, load_sql
from pija.schemas.common import GROUP_COL, GroupBy
from pija.schemas.kpis import KpiBreakdownItem, KpiResult

# code → (arquivo .sql, descrição)
KPI_META: dict[str, tuple[str, str]] = {
    "KPI-01": ("kpis/kpi_01_prontuario_1evento.sql", "Tempo médio prontuário → 1º evento"),
    "KPI-03": ("kpis/kpi_03_consulta_agend_realiz.sql", "Tempo médio agendamento → realização (consulta)"),
    "KPI-05": ("kpis/kpi_05_exame_solic_realiz.sql", "Tempo médio solicitação → realização (exame)"),
    "KPI-06": ("kpis/kpi_06_consulta_internacao.sql", "Tempo médio última consulta → internação"),
    "KPI-07": ("kpis/kpi_07_internacao_permanencia.sql", "Tempo médio de permanência na internação"),
}
ALL_KPIS: list[str] = list(KPI_META)


async def compute_kpi(runner: SqlRunner, code: str, group_by: GroupBy, filters: dict) -> KpiResult:
    sql_name, descricao = KPI_META[code]
    col = GROUP_COL[group_by]
    sql = load_sql(sql_name).replace("{group_col}", col)
    rows = await runner.fetch_all(sql, filters)

    breakdown: list[KpiBreakdownItem] = []
    total_soma = 0.0
    total_n = 0
    for r in rows:
        n = int(r["n"])
        if n == 0:
            continue
        soma = float(r["soma_dias"] or 0.0)
        total_soma += soma
        total_n += n
        if r["dimensao"] is not None:
            breakdown.append(KpiBreakdownItem(dimensao=r["dimensao"], media=soma / n, n=n))

    breakdown.sort(key=lambda b: (-b.media, b.dimensao))
    media_global = (total_soma / total_n) if total_n else None
    return KpiResult(
        codigo=code,
        descricao=descricao,
        media_global=media_global,
        n_global=total_n,
        breakdown=breakdown,
    )
```
> Usamos `.replace("{group_col}", col)` em vez de `str.format` para não colidir com chaves caso algum SQL futuro use `{}` em outro contexto. `col` vem da whitelist `GROUP_COL` — nunca de string crua.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_kpis_provider.py -v`
Expected: PASS (1 passed — KPI-03).

- [ ] **Step 7: Commit**
```bash
git add backend/src/pija/schemas/kpis.py backend/src/pija/providers/kpis_provider.py backend/src/pija/sql/kpis/ backend/tests/test_kpis_provider.py
git commit -m "F2: add KPI schemas, compute_kpi infra and KPI-03 SQL"
```

---

## Task 7: KPI-05 SQL

**Files:**
- Create: `backend/src/pija/sql/kpis/kpi_05_exame_solic_realiz.sql`
- Modify: `backend/tests/test_kpis_provider.py` (add KPI-05 to parametrize)

- [ ] **Step 1: Add KPI-05 to the parametrized test**

Edit the `@pytest.mark.parametrize` line in `backend/tests/test_kpis_provider.py`:
```python
@pytest.mark.parametrize("code", ["KPI-03", "KPI-05"])
```

- [ ] **Step 2: Run to verify KPI-05 fails**

Run: `cd backend && pytest tests/test_kpis_provider.py -v`
Expected: KPI-03 PASS, KPI-05 FAIL (`FileNotFoundError` on `kpi_05_...sql`).

- [ ] **Step 3: Write the KPI-05 SQL**

Create `backend/src/pija/sql/kpis/kpi_05_exame_solic_realiz.sql`:
```sql
SELECT {group_col} AS dimensao,
       SUM(julianday(timestamp_realizacao) - julianday(timestamp_solicitacao)) AS soma_dias,
       COUNT(*) AS n
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND tipo_entidade = 'EXAME'
  AND timestamp_realizacao IS NOT NULL
  AND (:unidade IS NULL OR unidade = :unidade)
  AND (:especialidade IS NULL OR especialidade = :especialidade)
  AND (:data_inicio IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim IS NULL OR timestamp_principal <= :data_fim)
GROUP BY {group_col}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_kpis_provider.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**
```bash
git add backend/src/pija/sql/kpis/kpi_05_exame_solic_realiz.sql backend/tests/test_kpis_provider.py
git commit -m "F2: add KPI-05 (exame solicitacao to realizacao) SQL"
```

---

## Task 8: KPI-07 SQL

**Files:**
- Create: `backend/src/pija/sql/kpis/kpi_07_internacao_permanencia.sql`
- Modify: `backend/tests/test_kpis_provider.py`

- [ ] **Step 1: Add KPI-07 to parametrize**
```python
@pytest.mark.parametrize("code", ["KPI-03", "KPI-05", "KPI-07"])
```

- [ ] **Step 2: Run to verify KPI-07 fails**

Run: `cd backend && pytest tests/test_kpis_provider.py -v`
Expected: KPI-07 FAIL (file not found).

- [ ] **Step 3: Write the KPI-07 SQL**

Create `backend/src/pija/sql/kpis/kpi_07_internacao_permanencia.sql`:
```sql
SELECT {group_col} AS dimensao,
       SUM(julianday(timestamp_alta_administrativa) - julianday(timestamp_principal)) AS soma_dias,
       COUNT(*) AS n
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND tipo_entidade = 'INTERNACAO'
  AND timestamp_alta_administrativa IS NOT NULL
  AND (:unidade IS NULL OR unidade = :unidade)
  AND (:especialidade IS NULL OR especialidade = :especialidade)
  AND (:data_inicio IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim IS NULL OR timestamp_principal <= :data_fim)
GROUP BY {group_col}
```

- [ ] **Step 4: Run tests**

Run: `cd backend && pytest tests/test_kpis_provider.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**
```bash
git add backend/src/pija/sql/kpis/kpi_07_internacao_permanencia.sql backend/tests/test_kpis_provider.py
git commit -m "F2: add KPI-07 (internacao permanencia) SQL"
```

---

## Task 9: KPI-01 SQL (CTE prontuário → 1º evento)

**Files:**
- Create: `backend/src/pija/sql/kpis/kpi_01_prontuario_1evento.sql`
- Modify: `backend/tests/test_kpis_provider.py`

- [ ] **Step 1: Add KPI-01 to parametrize**
```python
@pytest.mark.parametrize("code", ["KPI-01", "KPI-03", "KPI-05", "KPI-07"])
```

- [ ] **Step 2: Run to verify KPI-01 fails**

Run: `cd backend && pytest tests/test_kpis_provider.py -v`
Expected: KPI-01 FAIL.

- [ ] **Step 3: Write the KPI-01 SQL**

Create `backend/src/pija/sql/kpis/kpi_01_prontuario_1evento.sql`:
```sql
WITH prontuario AS (
    SELECT paciente_id, MIN(timestamp_principal) AS ts_prontuario
    FROM fato_eventos_jornada
    WHERE deleted_at IS NULL AND tipo_entidade = 'PRONTUARIO'
    GROUP BY paciente_id
),
primeiro AS (
    SELECT paciente_id, MIN(timestamp_principal) AS ts_primeiro
    FROM fato_eventos_jornada
    WHERE deleted_at IS NULL AND tipo_entidade <> 'PRONTUARIO'
    GROUP BY paciente_id
),
primeiro_dim AS (
    SELECT f.paciente_id, MIN(f.evento_id) AS evento_id, f.unidade, f.especialidade
    FROM fato_eventos_jornada f
    JOIN primeiro pe
      ON f.paciente_id = pe.paciente_id
     AND f.timestamp_principal = pe.ts_primeiro
    WHERE f.deleted_at IS NULL AND f.tipo_entidade <> 'PRONTUARIO'
    GROUP BY f.paciente_id
)
SELECT pd.{group_col} AS dimensao,
       SUM(julianday(pe.ts_primeiro) - julianday(p.ts_prontuario)) AS soma_dias,
       COUNT(*) AS n
FROM prontuario p
JOIN primeiro pe ON pe.paciente_id = p.paciente_id
JOIN primeiro_dim pd ON pd.paciente_id = p.paciente_id
WHERE julianday(pe.ts_primeiro) >= julianday(p.ts_prontuario)
  AND (:unidade IS NULL OR pd.unidade = :unidade)
  AND (:especialidade IS NULL OR pd.especialidade = :especialidade)
  AND (:data_inicio IS NULL OR pe.ts_primeiro >= :data_inicio)
  AND (:data_fim IS NULL OR pe.ts_primeiro <= :data_fim)
GROUP BY pd.{group_col}
```
> `primeiro_dim` usa `MIN(evento_id)` para desempatar caso dois eventos tenham o mesmo `ts_primeiro` (determinismo). `{group_col}` é substituído por `unidade`/`especialidade` (vira `pd.unidade`).

- [ ] **Step 4: Run tests**

Run: `cd backend && pytest tests/test_kpis_provider.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**
```bash
git add backend/src/pija/sql/kpis/kpi_01_prontuario_1evento.sql backend/tests/test_kpis_provider.py
git commit -m "F2: add KPI-01 (prontuario to first event) SQL with CTE"
```

---

## Task 10: KPI-06 SQL (cross-table) + medição de performance

**Files:**
- Create: `backend/src/pija/sql/kpis/kpi_06_consulta_internacao.sql`
- Modify: `backend/tests/test_kpis_provider.py`

- [ ] **Step 1: Add KPI-06 to parametrize (todos os 5)**
```python
@pytest.mark.parametrize("code", ["KPI-01", "KPI-03", "KPI-05", "KPI-06", "KPI-07"])
```

- [ ] **Step 2: Run to verify KPI-06 fails**

Run: `cd backend && pytest tests/test_kpis_provider.py -v`
Expected: KPI-06 FAIL.

- [ ] **Step 3: Write the KPI-06 SQL**

Create `backend/src/pija/sql/kpis/kpi_06_consulta_internacao.sql`:
```sql
WITH internacoes AS (
    SELECT paciente_id, timestamp_principal, unidade, especialidade
    FROM fato_eventos_jornada
    WHERE deleted_at IS NULL AND tipo_entidade = 'INTERNACAO'
      AND (:unidade IS NULL OR unidade = :unidade)
      AND (:especialidade IS NULL OR especialidade = :especialidade)
      AND (:data_inicio IS NULL OR timestamp_principal >= :data_inicio)
      AND (:data_fim IS NULL OR timestamp_principal <= :data_fim)
),
com_ultima AS (
    SELECT i.timestamp_principal,
           i.unidade,
           i.especialidade,
           (SELECT MAX(c.timestamp_realizacao)
            FROM fato_eventos_jornada c
            WHERE c.deleted_at IS NULL
              AND c.tipo_entidade = 'CONSULTA'
              AND c.paciente_id = i.paciente_id
              AND c.timestamp_realizacao IS NOT NULL
              AND c.timestamp_realizacao < i.timestamp_principal) AS ts_ultima_consulta
    FROM internacoes i
)
SELECT {group_col} AS dimensao,
       SUM(julianday(timestamp_principal) - julianday(ts_ultima_consulta)) AS soma_dias,
       COUNT(*) AS n
FROM com_ultima
WHERE ts_ultima_consulta IS NOT NULL
GROUP BY {group_col}
```

- [ ] **Step 4: Run tests to verify all 5 KPIs pass**

Run: `cd backend && pytest tests/test_kpis_provider.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Measure KPI-06 perf against the real DB**

Run (repo root, venv ativo, JWT_SECRET exportado):
```bash
python - <<'PY'
import asyncio, time
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from pija.db import sqlite_url
from pija.resources.sql_runner import SqlRunner
from pija.providers.kpis_provider import compute_kpi
from pija.schemas.common import GroupBy

async def main():
    engine = create_async_engine(sqlite_url("./backend/data/pija.db"))
    sm = async_sessionmaker(engine, expire_on_commit=False)
    async with sm() as s:
        t = time.perf_counter()
        r = await compute_kpi(SqlRunner(s), "KPI-06", GroupBy.unidade,
                              {"unidade": None, "especialidade": None, "data_inicio": None, "data_fim": None})
        dt = time.perf_counter() - t
    await engine.dispose()
    print(f"KPI-06 global={r.media_global} n={r.n_global} em {dt:.2f}s")

asyncio.run(main())
PY
```
Expected: imprime um valor e o tempo. **Se `dt > 5s`**, adicione índice e remeça:

- [ ] **Step 6: (Condicional) adicionar índice se KPI-06 for lento**

Só se Step 5 passou de ~5s. Crie a migration Alembic:
```bash
alembic -c backend/alembic.ini revision -m "add ix_fato_paciente_ts for KPI-06"
```
No arquivo gerado, em `upgrade()`:
```python
op.create_index("ix_fato_paciente_ts", "fato_eventos_jornada",
                ["paciente_id", "timestamp_principal"])
```
e em `downgrade()`:
```python
op.drop_index("ix_fato_paciente_ts", table_name="fato_eventos_jornada")
```
Aplique e remeça o Step 5:
```bash
alembic -c backend/alembic.ini upgrade head
```
> Se Step 5 já foi rápido (<5s no DB de 2.26M linhas — esperado, são só 162k internações), **pule o Step 6** e registre na descrição do commit que a medição dispensou índice.

- [ ] **Step 7: Commit**
```bash
git add backend/src/pija/sql/kpis/kpi_06_consulta_internacao.sql backend/tests/test_kpis_provider.py
# inclua a migration se criada no Step 6
git commit -m "F2: add KPI-06 (ultima consulta to internacao) SQL; measure perf"
```

---

## Task 11: `/kpis/tempos-medios` — controller + router

**Files:**
- Create: `backend/src/pija/controllers/kpis_controller.py`
- Modify: `backend/src/pija/routers/kpis.py`
- Test: `backend/tests/test_kpis_endpoint.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_kpis_endpoint.py`:
```python
import pytest

from tests.fixtures.dataset import EXPECTED


async def test_kpis_default_returns_all_five(client):
    resp = await client.get("/api/v1/kpis/tempos-medios")
    assert resp.status_code == 200
    codes = {k["codigo"] for k in resp.json()["kpis"]}
    assert codes == set(EXPECTED.keys())


async def test_kpis_global_values_match_expected(client):
    resp = await client.get("/api/v1/kpis/tempos-medios", params={"group_by": "unidade"})
    by_code = {k["codigo"]: k for k in resp.json()["kpis"]}
    for code, exp in EXPECTED.items():
        assert by_code[code]["media_global"] == pytest.approx(exp["global"], abs=1e-9), code
        assert by_code[code]["n_global"] == exp["n"], code


async def test_kpis_filter_kpi_codes(client):
    resp = await client.get("/api/v1/kpis/tempos-medios", params=[("kpi_codes", "KPI-03")])
    codes = [k["codigo"] for k in resp.json()["kpis"]]
    assert codes == ["KPI-03"]


async def test_kpis_invalid_code_returns_400(client):
    resp = await client.get("/api/v1/kpis/tempos-medios", params=[("kpi_codes", "KPI-99")])
    assert resp.status_code == 400


async def test_kpis_invalid_group_by_returns_422(client):
    resp = await client.get("/api/v1/kpis/tempos-medios", params={"group_by": "paciente_id"})
    assert resp.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_kpis_endpoint.py -v`
Expected: FAIL — 404.

- [ ] **Step 3: Write the controller**

Create `backend/src/pija/controllers/kpis_controller.py`:
```python
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from pija.providers.kpis_provider import ALL_KPIS, compute_kpi
from pija.resources.sql_runner import SqlRunner
from pija.schemas.common import GroupBy
from pija.schemas.kpis import KpisResponse


async def get_kpis(
    session: AsyncSession,
    *,
    kpi_codes: list[str] | None,
    group_by: GroupBy,
    filters: dict,
) -> KpisResponse:
    codes = kpi_codes or ALL_KPIS
    invalid = [c for c in codes if c not in ALL_KPIS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"kpi_codes inválidos: {invalid}")
    runner = SqlRunner(session)
    results = [await compute_kpi(runner, code, group_by, filters) for code in codes]
    return KpisResponse(kpis=results)
```

- [ ] **Step 4: Write the router**

Replace `backend/src/pija/routers/kpis.py`:
```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.controllers.kpis_controller import get_kpis
from pija.deps import get_session
from pija.schemas.common import GroupBy
from pija.schemas.kpis import KpisResponse

router = APIRouter(prefix="/api/v1", tags=["kpis"])


@router.get("/kpis/tempos-medios", response_model=KpisResponse)
async def listar_kpis(
    kpi_codes: list[str] | None = Query(None),
    group_by: GroupBy = GroupBy.unidade,
    unidade: str | None = None,
    especialidade: str | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> KpisResponse:
    filters = {
        "unidade": unidade,
        "especialidade": especialidade,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
    }
    return await get_kpis(session, kpi_codes=kpi_codes, group_by=group_by, filters=filters)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_kpis_endpoint.py -v`
Expected: PASS (5 passed).

- [ ] **Step 6: Commit**
```bash
git add backend/src/pija/controllers/kpis_controller.py backend/src/pija/routers/kpis.py backend/tests/test_kpis_endpoint.py
git commit -m "F2: implement GET /api/v1/kpis/tempos-medios endpoint"
```

---

## Task 12: `/gargalos` — schema, provider, controller, router

**Files:**
- Create: `backend/src/pija/schemas/gargalos.py`
- Create: `backend/src/pija/providers/gargalos_provider.py`
- Create: `backend/src/pija/controllers/gargalos_controller.py`
- Modify: `backend/src/pija/routers/gargalos.py`
- Test: `backend/tests/test_gargalos_endpoint.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_gargalos_endpoint.py`:
```python
import pytest

from tests.fixtures.dataset import EXPECTED_GARGALOS


async def test_gargalos_default_ranking_order(client):
    resp = await client.get("/api/v1/gargalos", params={"group_by": "unidade"})
    assert resp.status_code == 200
    items = resp.json()["items"]
    got = [(i["transicao"], i["dimensao"], i["media"]) for i in items]
    expected = [(t, d, pytest.approx(m, abs=1e-9)) for t, d, m in EXPECTED_GARGALOS]
    assert got == expected


async def test_gargalos_topn_limit(client):
    resp = await client.get("/api/v1/gargalos", params={"group_by": "unidade", "limit": 3})
    items = resp.json()["items"]
    assert len(items) == 3
    assert items[0]["transicao"] == "KPI-06"
    assert items[0]["dimensao"] == "UA"
    assert items[0]["media"] == pytest.approx(10.0, abs=1e-9)


async def test_gargalos_item_has_dimensao_tipo(client):
    resp = await client.get("/api/v1/gargalos", params={"group_by": "unidade"})
    assert resp.json()["items"][0]["dimensao_tipo"] == "unidade"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_gargalos_endpoint.py -v`
Expected: FAIL — 404.

- [ ] **Step 3: Write the schema**

Create `backend/src/pija/schemas/gargalos.py`:
```python
from pydantic import BaseModel


class GargaloItem(BaseModel):
    dimensao_tipo: str
    dimensao: str
    transicao: str
    media: float
    n: int


class GargalosResponse(BaseModel):
    items: list[GargaloItem]
```

- [ ] **Step 4: Write the provider (reusa compute_kpi)**

Create `backend/src/pija/providers/gargalos_provider.py`:
```python
"""Provider de gargalos: ranking combinado (dimensão × transição).

Reusa o breakdown de cada KPI (compute_kpi), marca a transição, concatena,
ordena por média DESC (desempate por transicao, dimensao) e corta top-N.
Não tem SQL próprio — impossível divergir dos KPIs.
"""

from pija.providers.kpis_provider import compute_kpi
from pija.resources.sql_runner import SqlRunner
from pija.schemas.common import GroupBy
from pija.schemas.gargalos import GargaloItem, GargalosResponse

# Transições com dimensão clara (KPI-01 só entra se pedido explicitamente).
DEFAULT_GARGALO_CODES = ["KPI-03", "KPI-05", "KPI-06", "KPI-07"]


async def list_gargalos(
    session,
    codes: list[str],
    group_by: GroupBy,
    filters: dict,
    limit: int,
) -> GargalosResponse:
    runner = SqlRunner(session)
    items: list[GargaloItem] = []
    for code in codes:
        kpi = await compute_kpi(runner, code, group_by, filters)
        for b in kpi.breakdown:
            items.append(
                GargaloItem(
                    dimensao_tipo=group_by.value,
                    dimensao=b.dimensao,
                    transicao=code,
                    media=b.media,
                    n=b.n,
                )
            )
    items.sort(key=lambda x: (-x.media, x.transicao, x.dimensao))
    return GargalosResponse(items=items[:limit])
```

- [ ] **Step 5: Write the controller**

Create `backend/src/pija/controllers/gargalos_controller.py`:
```python
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from pija.providers.gargalos_provider import DEFAULT_GARGALO_CODES, list_gargalos
from pija.providers.kpis_provider import ALL_KPIS
from pija.schemas.common import GroupBy
from pija.schemas.gargalos import GargalosResponse


async def get_gargalos(
    session: AsyncSession,
    *,
    kpi_codes: list[str] | None,
    group_by: GroupBy,
    filters: dict,
    limit: int,
) -> GargalosResponse:
    codes = kpi_codes or DEFAULT_GARGALO_CODES
    invalid = [c for c in codes if c not in ALL_KPIS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"kpi_codes inválidos: {invalid}")
    return await list_gargalos(session, codes, group_by, filters, limit)
```

- [ ] **Step 6: Write the router**

Replace `backend/src/pija/routers/gargalos.py`:
```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.controllers.gargalos_controller import get_gargalos
from pija.deps import get_session
from pija.schemas.common import GroupBy
from pija.schemas.gargalos import GargalosResponse

router = APIRouter(prefix="/api/v1", tags=["gargalos"])


@router.get("/gargalos", response_model=GargalosResponse)
async def listar_gargalos(
    kpi_codes: list[str] | None = Query(None),
    group_by: GroupBy = GroupBy.unidade,
    unidade: str | None = None,
    especialidade: str | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    limit: int = Query(10, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> GargalosResponse:
    filters = {
        "unidade": unidade,
        "especialidade": especialidade,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
    }
    return await get_gargalos(
        session, kpi_codes=kpi_codes, group_by=group_by, filters=filters, limit=limit
    )
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_gargalos_endpoint.py -v`
Expected: PASS (3 passed).

- [ ] **Step 8: Commit**
```bash
git add backend/src/pija/schemas/gargalos.py backend/src/pija/providers/gargalos_provider.py backend/src/pija/controllers/gargalos_controller.py backend/src/pija/routers/gargalos.py backend/tests/test_gargalos_endpoint.py
git commit -m "F2: implement GET /api/v1/gargalos combined ranking endpoint"
```

---

## Task 13: Remover xfail + verificação da suíte completa

**Files:**
- Modify: `backend/tests/test_app_wiring.py`

- [ ] **Step 1: Remove the xfail marker**

In `backend/tests/test_app_wiring.py`, delete the `@pytest.mark.xfail(...)` decorator above `test_routers_registered` (os 3 endpoints agora existem).

- [ ] **Step 2: Run the full suite**

Run: `cd backend && pytest -q`
Expected: todos verdes (45 antigos + ~25 novos), zero xfail/xpass.

- [ ] **Step 3: Coverage gate (≥80% em providers/controllers)**

Run: `cd backend && pytest --cov=pija.providers --cov=pija.controllers --cov-report=term-missing -q`
Expected: cobertura ≥80% nos dois pacotes. Se faltar, adicione casos (ex.: filtro `especialidade`, KPI vazio retornando `media_global=null`).

- [ ] **Step 4: Manual smoke contra o DB real**

Run (repo root): `uvicorn pija.main:app --app-dir backend/src` em um terminal; em outro:
```bash
curl "http://127.0.0.1:8000/api/v1/eventos?limit=2"
curl "http://127.0.0.1:8000/api/v1/kpis/tempos-medios?group_by=unidade"
curl "http://127.0.0.1:8000/api/v1/gargalos?limit=5"
```
Expected: os 3 retornam JSON 200 sobre os 2.26M eventos reais. Anote o KPI-05 com a ressalva de janela (jan–mai/2026).

- [ ] **Step 5: Commit**
```bash
git add backend/tests/test_app_wiring.py
git commit -m "F2: enable router registration test; full suite green"
```

---

## Task 14: Atualizar docs canônicos (convenção "tudo em MD")

**Files:**
- Modify: `SPEC.md` (§5 Fase 2 — KPI-06)
- Modify: `docs/PLANO.md` (§5 — KPI-06)
- Modify: `CLAUDE.md` ("Estado atual do desenvolvimento")

- [ ] **Step 1: Corrigir KPI-06 no SPEC.md**

Em `SPEC.md`, na lista da Fase 2, troque:
```
  - `KPI-06`: solicitação → internação
```
por:
```
  - `KPI-06`: última consulta realizada → internação subsequente
```

- [ ] **Step 2: Corrigir KPI-06 no PLANO.md**

Em `docs/PLANO.md §5`, onde a tabela/lista cita KPI-06 como "solicitação → internação", troque para "última consulta realizada → internação subsequente".

- [ ] **Step 3: Atualizar estado no CLAUDE.md**

Em `CLAUDE.md`, seção "Estado atual do desenvolvimento", substitua o parágrafo "ainda não temos código" por:
```markdown
**2026-06-12:** F0 (scaffold) + F1 (ETL) + F2 (3 endpoints analíticos) entregues.
Backend bootável; 2.26M eventos em `backend/data/pija.db`; endpoints
`/api/v1/eventos`, `/api/v1/kpis/tempos-medios`, `/api/v1/gargalos` com
5 KPIs validados contra fixture (tolerância 0%); suíte de testes verde.

**Próximo:** F3 — auth interim (users.yml + PyJWT) com `Depends(get_current_user)`.
```

- [ ] **Step 4: Commit**
```bash
git add SPEC.md docs/PLANO.md CLAUDE.md
git commit -m "docs: fix KPI-06 definition and update project state for F2"
```

---

## Self-Review (executado ao escrever este plano)

**1. Spec coverage:**
- `/eventos` filtros+paginação+total → Task 5 ✓
- 5 KPIs (01,03,05,06,07) global+breakdown por group_by → Tasks 6–11 ✓
- `/gargalos` ranking combinado reusando KPIs → Task 12 ✓
- Segurança group_by (whitelist) → Task 4 (`GROUP_COL`) + Task 6 (`.replace`) ✓
- Fixture determinística + EXPECTED.md + tolerância 0% → Task 3 + testes ✓
- KPI-06 = "última consulta → internação" + medição de perf → Task 10 ✓
- Caveats (KPI-05 janela, KPI-07 obstetrícia) → documentados no spec; smoke note Task 13 ✓
- Auditoria deferida F3 → fora de escopo (spec) ✓
- Docs a atualizar (SPEC/PLANO/CLAUDE) → Task 14 ✓
- Erros 400/422 → testados em Tasks 5, 11 ✓

**2. Placeholder scan:** sem TBD/TODO; todo passo tem código/comando concreto. A única condicional (índice KPI-06, Task 10 Step 6) tem critério explícito (>5s) e código completo.

**3. Type consistency:** `compute_kpi(runner, code, group_by, filters)` usado igual em Tasks 6/11/12. `EventosPage/KpiResult/KpiBreakdownItem/GargaloItem/GargalosResponse` definidos antes do uso. `GROUP_COL`/`GroupBy` consistentes. `filters` dict sempre com as 4 chaves (`unidade,especialidade,data_inicio,data_fim`) que os SQLs referenciam.

**Correção aplicada inline:** Task 3 Step 3 corrige a interferência do paciente 1002 no KPI-06 (movendo I-3006 para paciente 1009), preservando todos os valores de EXPECTED.