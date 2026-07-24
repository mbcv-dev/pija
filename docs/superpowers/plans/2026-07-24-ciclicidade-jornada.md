# Ciclicidade da Jornada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a visualização de ciclicidade da jornada assistencial — fluxo agregado da população (grafo de transições + matriz) e mini-grafo por paciente — sobre a `fato_eventos_jornada` existente.

**Architecture:** Um único endpoint `GET /api/v1/ciclicidade/transicoes` calcula, numa passada SQL com `LAG`, as transições evento→próximo-evento por paciente (semântica de coorte: o filtro escolhe os pacientes, mostra-se a jornada completa deles). O backend devolve nós+arestas agregados; o front desenha grafo (SVG) ou matriz. O mesmo endpoint serve o escopo individual via `paciente_id` opcional.

**Tech Stack:** Backend — FastAPI, SQLAlchemy 2.0 Async, SQLite (window functions), Pydantic v2, pytest-asyncio. Frontend — Vue 3 + TS, Pinia, Zod, Axios, Vitest.

**Spec:** [docs/superpowers/specs/2026-07-24-ciclicidade-jornada-design.md](../specs/2026-07-24-ciclicidade-jornada-design.md)

---

## File Structure

**Backend (novos):**
- `backend/src/pija/sql/ciclicidade/transicoes.sql` — a query (CTE coorte → LAG → GROUP BY).
- `backend/src/pija/schemas/ciclicidade_schema.py` — `TransicaoItem`, `NoItem`, `CiclicidadeResponse`.
- `backend/src/pija/providers/ciclicidade_provider.py` — roda a SQL, deriva nós.
- `backend/src/pija/controllers/ciclicidade_controller.py` — parse de query params + `Depends`.
- `backend/src/pija/routers/ciclicidade_router.py` — registra a rota.
- `backend/tests/test_ciclicidade_provider.py`, `backend/tests/test_ciclicidade.py` — testes.

**Backend (modificados):**
- `backend/src/pija/main.py` — registrar o router + tag OpenAPI.

**Frontend (novos):**
- `frontend/src/stores/useCiclicidadeStore.ts`
- `frontend/src/components/ciclicidade/TransitionMatrix.vue`
- `frontend/src/components/ciclicidade/TransitionGraph.vue`
- `frontend/src/views/CiclicidadeView.vue`
- `frontend/src/stores/useCiclicidadeStore.test.ts`, `frontend/src/components/ciclicidade/TransitionMatrix.test.ts`

**Frontend (modificados):**
- `frontend/src/types/api.types.ts` — tipos do endpoint.
- `frontend/src/schemas/api.schemas.ts` — Zod schema + validação.
- `frontend/src/services/api.ts` — `getCiclicidade()`.
- `frontend/src/router/index.ts` — rota `/ciclicidade`.
- `frontend/src/components/ui/AppSidebar.vue`, `BottomNav.vue`, `Icon.vue` — navegação + ícone.
- `frontend/src/views/JornadaView.vue` — mini-grafo do paciente.

**Ordem de entrega (de-riscada):** Backend (T1–T4) → dados+matriz+view no ar (T5–T9) → grafo estrela (T10) → mini-grafo individual (T11).

---

## Como rodar os testes

- **Backend:** `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest <arquivo>::<teste> -v`
- **Frontend:** `cd frontend; npx vitest run <arquivo>` · type-check: `npm run type-check`

---

## Task 1: SQL da query de transições

**Files:**
- Create: `backend/src/pija/sql/ciclicidade/transicoes.sql`

Sem teste isolado (é validada via provider na Task 3). Este passo só cria o arquivo.

- [ ] **Step 1: Criar o arquivo SQL**

Cria `backend/src/pija/sql/ciclicidade/transicoes.sql` com:

```sql
-- Transições evento -> próximo evento, por paciente, na coorte filtrada.
-- Semântica de coorte: o filtro define QUAIS pacientes entram; contam-se TODAS
-- as transições desses pacientes (mesmo eventos fora do filtro).
-- {filtros} é injetado por sql_filtros.build_filtros (começa com "AND").
WITH coorte AS (
    SELECT DISTINCT paciente_id
    FROM fato_eventos_jornada
    WHERE deleted_at IS NULL
      AND (:paciente_id IS NULL OR paciente_id = :paciente_id)
      {filtros}
      AND (:data_inicio IS NULL OR timestamp_principal >= :data_inicio)
      AND (:data_fim    IS NULL OR timestamp_principal <= :data_fim)
),
ordenados AS (
    SELECT
        LAG(f.tipo_entidade) OVER (
            PARTITION BY f.paciente_id
            ORDER BY f.timestamp_principal, f.evento_id
        ) AS origem,
        f.tipo_entidade AS destino,
        (
            julianday(f.timestamp_principal)
            - julianday(LAG(f.timestamp_principal) OVER (
                PARTITION BY f.paciente_id
                ORDER BY f.timestamp_principal, f.evento_id
            ))
        ) * 86400.0 AS gap_s
    FROM fato_eventos_jornada f
    JOIN coorte c ON c.paciente_id = f.paciente_id
    WHERE f.deleted_at IS NULL
)
SELECT
    origem,
    destino,
    COUNT(*)      AS volume,
    AVG(gap_s)    AS tempo_medio_s,
    COUNT(gap_s)  AS n
FROM ordenados
WHERE origem IS NOT NULL
GROUP BY origem, destino
ORDER BY origem, destino;
```

> Notas: o desempate por `evento_id` no `ORDER BY` torna a ordem determinística em timestamps iguais. `AVG(gap_s)`/`COUNT(gap_s)` ignoram gaps nulos (SQLite ignora NULL em agregações). Auto-laços aparecem quando `origem = destino`.

- [ ] **Step 2: Commit**

```bash
git add backend/src/pija/sql/ciclicidade/transicoes.sql
git commit -m "feat(ciclicidade): SQL de transicoes evento->evento por coorte"
```

---

## Task 2: Schemas Pydantic

**Files:**
- Create: `backend/src/pija/schemas/ciclicidade_schema.py`

- [ ] **Step 1: Criar os schemas**

Cria `backend/src/pija/schemas/ciclicidade_schema.py` com:

```python
"""Schemas do endpoint /api/v1/ciclicidade/transicoes.

Fluxo agregado da jornada: nós (etapas) + arestas (transições origem->destino)
com volume e tempo médio. Serve tanto o escopo agregado quanto o individual.
"""
from pydantic import BaseModel, Field


class TransicaoItem(BaseModel):
    origem: str = Field(description="tipo_entidade de origem da transição.")
    destino: str = Field(description="tipo_entidade de destino (== origem em auto-laço).")
    volume: int = Field(description="Número de transições origem→destino na coorte.")
    tempo_medio_s: float | None = Field(
        default=None, description="Tempo médio da transição em segundos (None se indeterminável)."
    )
    n: int = Field(description="Tamanho da amostra usada no tempo_medio_s.")


class NoItem(BaseModel):
    tipo: str = Field(description="Um dos tipo_entidade presentes nas transições.")
    total_entradas: int = Field(description="Soma dos volumes de transições que chegam neste tipo.")
    total_saidas: int = Field(description="Soma dos volumes de transições que saem deste tipo.")


class CiclicidadeResponse(BaseModel):
    nos: list[NoItem] = Field(description="Etapas com totais de entrada/saída.")
    transicoes: list[TransicaoItem] = Field(description="Arestas do fluxo, ordenadas por origem, destino.")
```

- [ ] **Step 2: Verificar que importa sem erro**

Run: `cd backend; .\venv\Scripts\python.exe -c "from pija.schemas.ciclicidade_schema import CiclicidadeResponse; print('ok')"`
Expected: imprime `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/src/pija/schemas/ciclicidade_schema.py
git commit -m "feat(ciclicidade): schemas Pydantic (nos, transicoes)"
```

---

## Task 3: Provider (TDD)

**Files:**
- Create: `backend/src/pija/providers/ciclicidade_provider.py`
- Test: `backend/tests/test_ciclicidade_provider.py`

Os testes usam a fixture `fixture_db_session` de `conftest.py` (17 eventos determinísticos). Sequências por paciente já mapeadas:
- 001: PRONTUARIO→CONSULTA, CONSULTA→INTERNACAO, INTERNACAO→CONSULTA
- 002: PRONTUARIO→CONSULTA, CONSULTA→INTERNACAO
- 003: PRONTUARIO→CONSULTA, CONSULTA→INTERNACAO
- 004: PRONTUARIO→CONSULTA · 005: PRONTUARIO→CONSULTA
- 008: (1 evento, sem transição) · 009: EXAME→INTERNACAO

Agregado global: PRONTUARIO→CONSULTA=5, CONSULTA→INTERNACAO=3, INTERNACAO→CONSULTA=1, EXAME→INTERNACAO=1.

- [ ] **Step 1: Escrever os testes que falham**

Cria `backend/tests/test_ciclicidade_provider.py` com:

```python
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from pija.models.fato import FatoEvento
from pija.providers.ciclicidade_provider import CiclicidadeProvider
from pija.sql_filtros import Filtros


def _pares(resp):
    return {(t.origem, t.destino): t.volume for t in resp.transicoes}


class TestCiclicidadeAgregado:
    async def test_transicoes_globais(self, fixture_db_session):
        resp = await CiclicidadeProvider(fixture_db_session).get_transicoes(
            filtros=Filtros(), paciente_id=None
        )
        assert _pares(resp) == {
            ("PRONTUARIO", "CONSULTA"): 5,
            ("CONSULTA", "INTERNACAO"): 3,
            ("INTERNACAO", "CONSULTA"): 1,
            ("EXAME", "INTERNACAO"): 1,
        }

    async def test_nos_totais(self, fixture_db_session):
        resp = await CiclicidadeProvider(fixture_db_session).get_transicoes(
            filtros=Filtros(), paciente_id=None
        )
        nos = {n.tipo: (n.total_entradas, n.total_saidas) for n in resp.nos}
        # CONSULTA: entradas=5 (de PRONTUARIO), saídas=3 (para INTERNACAO)
        assert nos["CONSULTA"] == (5, 3)
        # INTERNACAO: entradas=3+1=4 (de CONSULTA e EXAME), saídas=1 (para CONSULTA)
        assert nos["INTERNACAO"] == (4, 1)
        assert nos["PRONTUARIO"] == (0, 5)

    async def test_tempo_medio_conhecido(self, fixture_db_session):
        resp = await CiclicidadeProvider(fixture_db_session).get_transicoes(
            filtros=Filtros(), paciente_id=None
        )
        # INTERNACAO→CONSULTA só existe no paciente 001: I-001 (2024-02-05) → C-006 (2024-04-01)
        t = next(x for x in resp.transicoes if (x.origem, x.destino) == ("INTERNACAO", "CONSULTA"))
        dias = t.tempo_medio_s / 86400.0
        assert dias == pytest.approx(56.0, abs=1e-6)  # 2024-02-05 → 2024-04-01
        assert t.n == 1

    async def test_coorte_por_especialidade_mantem_jornada_completa(self, fixture_db_session):
        # Especialidade ORTOPEDIA → pacientes 003, 004, 009. Conta TODAS as transições deles,
        # inclusive PRONTUARIO→CONSULTA (o PRONTUARIO não tem especialidade).
        resp = await CiclicidadeProvider(fixture_db_session).get_transicoes(
            filtros=Filtros(especialidade=["ORTOPEDIA"]), paciente_id=None
        )
        assert _pares(resp) == {
            ("PRONTUARIO", "CONSULTA"): 2,   # 003, 004
            ("CONSULTA", "INTERNACAO"): 1,   # 003
            ("EXAME", "INTERNACAO"): 1,      # 009
        }

    async def test_paciente_unico(self, fixture_db_session):
        resp = await CiclicidadeProvider(fixture_db_session).get_transicoes(
            filtros=Filtros(), paciente_id="001"
        )
        assert _pares(resp) == {
            ("PRONTUARIO", "CONSULTA"): 1,
            ("CONSULTA", "INTERNACAO"): 1,
            ("INTERNACAO", "CONSULTA"): 1,
        }


class TestCiclicidadeCasos:
    async def _session(self, async_engine, eventos):
        factory = async_sessionmaker(async_engine, expire_on_commit=False)
        async with factory() as s:
            s.add_all(eventos)
            await s.commit()
        return factory

    async def test_auto_laco(self, async_engine):
        # Duas CONSULTAs consecutivas do mesmo paciente => auto-laço CONSULTA→CONSULTA.
        eventos = [
            FatoEvento(evento_id="a1", paciente_id="X", tipo_entidade="CONSULTA", entidade_id="1",
                       timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
            FatoEvento(evento_id="a2", paciente_id="X", tipo_entidade="CONSULTA", entidade_id="2",
                       timestamp_principal="2024-01-05", dt_carga="2024-01-01"),
            FatoEvento(evento_id="a3", paciente_id="X", tipo_entidade="EXAME", entidade_id="3",
                       timestamp_principal="2024-01-10", dt_carga="2024-01-01"),
        ]
        factory = await self._session(async_engine, eventos)
        async with factory() as s:
            resp = await CiclicidadeProvider(s).get_transicoes(filtros=Filtros(), paciente_id=None)
        assert _pares(resp) == {("CONSULTA", "CONSULTA"): 1, ("CONSULTA", "EXAME"): 1}

    async def test_desempate_determinista_por_evento_id(self, async_engine):
        # Mesmo timestamp: a ordem é definida por evento_id (b1 antes de b2).
        eventos = [
            FatoEvento(evento_id="b1", paciente_id="Y", tipo_entidade="PRONTUARIO", entidade_id="1",
                       timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
            FatoEvento(evento_id="b2", paciente_id="Y", tipo_entidade="EXAME", entidade_id="2",
                       timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
        ]
        factory = await self._session(async_engine, eventos)
        async with factory() as s:
            resp = await CiclicidadeProvider(s).get_transicoes(filtros=Filtros(), paciente_id=None)
        assert _pares(resp) == {("PRONTUARIO", "EXAME"): 1}

    async def test_soft_delete_ignorado(self, async_engine):
        eventos = [
            FatoEvento(evento_id="c1", paciente_id="Z", tipo_entidade="CONSULTA", entidade_id="1",
                       timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
            FatoEvento(evento_id="c2", paciente_id="Z", tipo_entidade="EXAME", entidade_id="2",
                       timestamp_principal="2024-01-05", dt_carga="2024-01-01",
                       deleted_at="2024-06-01"),
        ]
        factory = await self._session(async_engine, eventos)
        async with factory() as s:
            resp = await CiclicidadeProvider(s).get_transicoes(filtros=Filtros(), paciente_id=None)
        assert resp.transicoes == []  # evento vivo sozinho não gera transição
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_ciclicidade_provider.py -v`
Expected: FAIL com `ModuleNotFoundError: No module named 'pija.providers.ciclicidade_provider'`

- [ ] **Step 3: Implementar o provider**

Cria `backend/src/pija/providers/ciclicidade_provider.py` com:

```python
"""Provider da ciclicidade: agrega transições origem→destino por coorte.

Uma passada SQL (LAG window function) conta as transições evento→próximo-evento
por paciente. Os nós (totais de entrada/saída por etapa) são derivados em Python
das próprias transições, evitando 2ª query.
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import load_sql
from pija.schemas.ciclicidade_schema import CiclicidadeResponse, NoItem, TransicaoItem
from pija.sql_filtros import Filtros, build_filtros


class CiclicidadeProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_transicoes(
        self, *, filtros: Filtros, paciente_id: str | None
    ) -> CiclicidadeResponse:
        frag, fparams = build_filtros(filtros)
        sql = load_sql("ciclicidade/transicoes.sql").replace("{filtros}", frag)
        params = {
            **fparams,
            "paciente_id": paciente_id,
            "data_inicio": filtros.data_inicio,
            "data_fim": filtros.data_fim,
        }
        rows = (await self._session.execute(text(sql), params)).all()

        transicoes: list[TransicaoItem] = []
        entradas: dict[str, int] = {}
        saidas: dict[str, int] = {}
        for r in rows:
            m = r._mapping
            origem = m["origem"]
            destino = m["destino"]
            volume = int(m["volume"])
            tempo = float(m["tempo_medio_s"]) if m["tempo_medio_s"] is not None else None
            transicoes.append(
                TransicaoItem(
                    origem=origem, destino=destino, volume=volume,
                    tempo_medio_s=tempo, n=int(m["n"] or 0),
                )
            )
            saidas[origem] = saidas.get(origem, 0) + volume
            entradas[destino] = entradas.get(destino, 0) + volume

        tipos = sorted(set(entradas) | set(saidas))
        nos = [
            NoItem(tipo=t, total_entradas=entradas.get(t, 0), total_saidas=saidas.get(t, 0))
            for t in tipos
        ]
        return CiclicidadeResponse(nos=nos, transicoes=transicoes)
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_ciclicidade_provider.py -v`
Expected: PASS (8 testes)

- [ ] **Step 5: Commit**

```bash
git add backend/src/pija/providers/ciclicidade_provider.py backend/tests/test_ciclicidade_provider.py
git commit -m "feat(ciclicidade): provider de transicoes com testes (coorte, auto-laco, determinismo)"
```

---

## Task 4: Controller, Router e registro (TDD)

**Files:**
- Create: `backend/src/pija/controllers/ciclicidade_controller.py`
- Create: `backend/src/pija/routers/ciclicidade_router.py`
- Modify: `backend/src/pija/main.py`
- Test: `backend/tests/test_ciclicidade.py`

- [ ] **Step 1: Escrever o teste de integração que falha**

Cria `backend/tests/test_ciclicidade.py` com:

```python
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_ciclicidade.py -v`
Expected: FAIL com 404 (rota não registrada)

- [ ] **Step 3: Criar o controller**

Cria `backend/src/pija/controllers/ciclicidade_controller.py` com:

```python
from datetime import date

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.providers.ciclicidade_provider import CiclicidadeProvider
from pija.schemas.ciclicidade_schema import CiclicidadeResponse
from pija.sql_filtros import Filtros


async def get_ciclicidade(
    paciente_id: str | None = Query(None, description="Se preenchido, restringe a coorte a um único paciente (escopo individual)."),
    unidade: list[str] | None = Query(None, description="Coorte: pacientes que passaram por uma ou mais unidades (repita o parâmetro)."),
    especialidade: list[str] | None = Query(None, description="Coorte: pacientes que passaram por uma ou mais especialidades (repita o parâmetro)."),
    grupo: list[str] | None = Query(None, description="Coorte: pacientes de um ou mais grupos assistenciais (repita o parâmetro)."),
    data_inicio: date | None = Query(None, description="Coorte: eventos a partir desta data. Formato: `YYYY-MM-DD`."),
    data_fim: date | None = Query(None, description="Coorte: eventos até esta data. Formato: `YYYY-MM-DD`."),
    session: AsyncSession = Depends(get_db),
) -> CiclicidadeResponse:
    filtros = Filtros(
        unidade=unidade,
        especialidade=especialidade,
        grupo=grupo,
        data_inicio=data_inicio.isoformat() if data_inicio else None,
        data_fim=data_fim.isoformat() if data_fim else None,
    )
    return await CiclicidadeProvider(session).get_transicoes(
        filtros=filtros, paciente_id=paciente_id
    )
```

- [ ] **Step 4: Criar o router**

Cria `backend/src/pija/routers/ciclicidade_router.py` com:

```python
from fastapi import APIRouter

from pija.controllers.ciclicidade_controller import get_ciclicidade
from pija.schemas.ciclicidade_schema import CiclicidadeResponse

router = APIRouter(tags=["ciclicidade"])
router.add_api_route(
    "/ciclicidade/transicoes",
    get_ciclicidade,
    methods=["GET"],
    response_model=CiclicidadeResponse,
    summary="Fluxo de transições entre etapas da jornada",
    description=(
        "Conta as transições evento→próximo-evento por paciente e agrega em nós (etapas) "
        "e arestas (transições origem→destino), com volume e tempo médio.\n\n"
        "**Coorte:** os filtros selecionam *quais* pacientes entram; contam-se **todas** as "
        "transições desses pacientes. Informe `paciente_id` para o escopo individual."
    ),
    response_description="Nós e transições do fluxo agregado (ou de um paciente).",
)
```

- [ ] **Step 5: Registrar no main.py**

Em `backend/src/pija/main.py`, adiciona o import junto aos outros routers (após a linha `from pija.routers.gargalos_router import router as gargalos_router`):

```python
from pija.routers.ciclicidade_router import router as ciclicidade_router
```

Adiciona a entrada de tag em `_TAGS_METADATA` (após o bloco `gargalos`):

```python
    {
        "name": "ciclicidade",
        "description": "Fluxo de transições entre etapas da jornada — agregado (coorte) e individual.",
    },
```

Registra o router (após `app.include_router(gargalos_router, prefix="/api/v1")`):

```python
app.include_router(ciclicidade_router, prefix="/api/v1")
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_ciclicidade.py -v`
Expected: PASS (3 testes)

- [ ] **Step 7: Rodar a suíte inteira (não regredir)**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest -q`
Expected: PASS (todos, incluindo os 147 anteriores + os novos)

- [ ] **Step 8: Commit**

```bash
git add backend/src/pija/controllers/ciclicidade_controller.py backend/src/pija/routers/ciclicidade_router.py backend/src/pija/main.py backend/tests/test_ciclicidade.py
git commit -m "feat(ciclicidade): endpoint GET /ciclicidade/transicoes + testes de integracao"
```

---

## Task 5: Tipos + Zod schema + serviço de API (frontend)

**Files:**
- Modify: `frontend/src/types/api.types.ts`
- Modify: `frontend/src/schemas/api.schemas.ts`
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Adicionar os tipos**

No fim de `frontend/src/types/api.types.ts`, adiciona:

```typescript
// ── Ciclicidade ────────────────────────────────────────────────

export interface CiclicidadeParams {
  paciente_id?: string
  grupo?: string[]
  unidade?: string[]
  especialidade?: string[]
  data_inicio?: string
  data_fim?: string
}

export interface TransicaoItem {
  origem: TipoEntidade
  destino: TipoEntidade
  volume: number
  tempo_medio_s: number | null
  n: number
}

export interface NoItem {
  tipo: TipoEntidade
  total_entradas: number
  total_saidas: number
}

export interface CiclicidadeResponse {
  nos: NoItem[]
  transicoes: TransicaoItem[]
}
```

> `TipoEntidade` já existe neste arquivo (usado em `EventoItem`/`JornadaView`). Confirme o nome exato do tipo exportado antes de reusar; se divergir, use o mesmo identificador já exportado.

- [ ] **Step 2: Adicionar o Zod schema**

Em `frontend/src/schemas/api.schemas.ts`, após o bloco Gargalos, adiciona (reusa `TipoEntidadeSchema` definido mais abaixo — mova a definição de `TipoEntidadeSchema` para antes deste bloco se necessário, ou referencie após sua declaração):

```typescript
// ── Ciclicidade ────────────────────────────────────────────────

export const TransicaoItemSchema = z.object({
  origem: TipoEntidadeSchema,
  destino: TipoEntidadeSchema,
  volume: z.number().int().nonnegative(),
  tempo_medio_s: z.number().nullable(),
  n: z.number().int().nonnegative(),
})

export const NoItemSchema = z.object({
  tipo: TipoEntidadeSchema,
  total_entradas: z.number().int().nonnegative(),
  total_saidas: z.number().int().nonnegative(),
})

export const CiclicidadeResponseSchema = z.object({
  nos: z.array(NoItemSchema),
  transicoes: z.array(TransicaoItemSchema),
})
```

> `TipoEntidadeSchema` está declarado no bloco "Eventos" deste arquivo. Como `const` não sofre hoisting, **mova** a declaração de `TipoEntidadeSchema` (linhas ~45-53) para antes do bloco Ciclicidade, ou coloque o bloco Ciclicidade depois do bloco Eventos. Garanta que fique declarado antes do uso.

- [ ] **Step 3: Adicionar o serviço em api.ts**

Em `frontend/src/services/api.ts`, ajusta o import de tipos (adiciona `CiclicidadeParams, CiclicidadeResponse` à lista importada de `@/types/api.types`) e o import de schema (adiciona `CiclicidadeResponseSchema` à lista de `@/schemas/api.schemas`). No fim do arquivo, adiciona:

```typescript
/**
 * GET /api/v1/ciclicidade/transicoes
 * Fluxo agregado de transições entre etapas (coorte) ou de um paciente (paciente_id).
 */
export async function getCiclicidade(params: CiclicidadeParams = {}): Promise<CiclicidadeResponse> {
  if (USE_MOCK) {
    await delay(400)
    return {
      nos: [
        { tipo: 'PRONTUARIO', total_entradas: 0, total_saidas: 5 },
        { tipo: 'CONSULTA', total_entradas: 5, total_saidas: 3 },
        { tipo: 'EXAME', total_entradas: 0, total_saidas: 1 },
        { tipo: 'INTERNACAO', total_entradas: 4, total_saidas: 1 },
      ],
      transicoes: [
        { origem: 'PRONTUARIO', destino: 'CONSULTA', volume: 5, tempo_medio_s: 777600, n: 5 },
        { origem: 'CONSULTA', destino: 'INTERNACAO', volume: 3, tempo_medio_s: 2160000, n: 3 },
        { origem: 'INTERNACAO', destino: 'CONSULTA', volume: 1, tempo_medio_s: 4838400, n: 1 },
        { origem: 'EXAME', destino: 'INTERNACAO', volume: 1, tempo_medio_s: 777600, n: 1 },
      ],
    }
  }
  const { data } = await client.get<CiclicidadeResponse>('/ciclicidade/transicoes', { params })
  return CiclicidadeResponseSchema.parse(data)
}
```

- [ ] **Step 4: Type-check**

Run: `cd frontend; npm run type-check`
Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/api.types.ts frontend/src/schemas/api.schemas.ts frontend/src/services/api.ts
git commit -m "feat(ciclicidade): tipos, zod schema e getCiclicidade no frontend"
```

---

## Task 6: Store Pinia (TDD)

**Files:**
- Create: `frontend/src/stores/useCiclicidadeStore.ts`
- Test: `frontend/src/stores/useCiclicidadeStore.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Cria `frontend/src/stores/useCiclicidadeStore.test.ts` com:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({
  getCiclicidade: vi.fn(async () => ({
    nos: [{ tipo: 'CONSULTA', total_entradas: 5, total_saidas: 3 }],
    transicoes: [{ origem: 'PRONTUARIO', destino: 'CONSULTA', volume: 5, tempo_medio_s: 100, n: 5 }],
  })),
}))

import { useCiclicidadeStore } from './useCiclicidadeStore'

describe('useCiclicidadeStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('começa vazio', () => {
    const s = useCiclicidadeStore()
    expect(s.transicoes).toEqual([])
    expect(s.loading).toBe(false)
  })

  it('fetch popula nós e transições', async () => {
    const s = useCiclicidadeStore()
    await s.fetch()
    expect(s.transicoes).toHaveLength(1)
    expect(s.nos[0].tipo).toBe('CONSULTA')
    expect(s.loading).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend; npx vitest run src/stores/useCiclicidadeStore.test.ts`
Expected: FAIL (módulo `useCiclicidadeStore` não existe)

- [ ] **Step 3: Implementar o store**

Cria `frontend/src/stores/useCiclicidadeStore.ts` com:

```typescript
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useFilterStore } from './useFilterStore'
import { getCiclicidade } from '@/services/api'
import type { NoItem, TransicaoItem } from '@/types/api.types'

/**
 * useCiclicidadeStore — fluxo agregado de transições.
 * Observa os filtros globais (semântica de coorte) e re-busca ao mudarem.
 */
export const useCiclicidadeStore = defineStore('ciclicidade', () => {
  const nos        = ref<NoItem[]>([])
  const transicoes = ref<TransicaoItem[]>([])
  const loading    = ref(false)
  const error      = ref<string | null>(null)

  async function fetch(): Promise<void> {
    const filterStore = useFilterStore()
    loading.value = true
    error.value = null
    try {
      const { group_by: _gb, ...coorte } = filterStore.activeFilters
      const resp = await getCiclicidade(coorte)
      nos.value = resp.nos
      transicoes.value = resp.transicoes
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erro ao carregar ciclicidade'
      nos.value = []
      transicoes.value = []
    } finally {
      loading.value = false
    }
  }

  function initWatcher(): void {
    const filterStore = useFilterStore()
    watch(() => filterStore.activeFilters, () => { void fetch() }, { deep: true })
  }

  return { nos, transicoes, loading, error, fetch, initWatcher }
})
```

> `group_by` é descartado porque o endpoint de ciclicidade não agrupa por dimensão — só usa a coorte.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend; npx vitest run src/stores/useCiclicidadeStore.test.ts`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/useCiclicidadeStore.ts frontend/src/stores/useCiclicidadeStore.test.ts
git commit -m "feat(ciclicidade): store Pinia com watcher de filtros"
```

---

## Task 7: Componente TransitionMatrix (rede de segurança) (TDD)

**Files:**
- Create: `frontend/src/components/ciclicidade/TransitionMatrix.vue`
- Test: `frontend/src/components/ciclicidade/TransitionMatrix.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Cria `frontend/src/components/ciclicidade/TransitionMatrix.test.ts` com:

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TransitionMatrix from './TransitionMatrix.vue'

const props = {
  nos: [
    { tipo: 'PRONTUARIO', total_entradas: 0, total_saidas: 5 },
    { tipo: 'CONSULTA', total_entradas: 5, total_saidas: 0 },
  ],
  transicoes: [
    { origem: 'PRONTUARIO', destino: 'CONSULTA', volume: 5, tempo_medio_s: 86400, n: 5 },
  ],
}

describe('TransitionMatrix', () => {
  it('renderiza uma célula com o volume da transição', () => {
    const w = mount(TransitionMatrix, { props })
    expect(w.text()).toContain('5')
  })

  it('renderiza os tipos como cabeçalhos de linha/coluna', () => {
    const w = mount(TransitionMatrix, { props })
    expect(w.text()).toContain('PRONTUARIO')
    expect(w.text()).toContain('CONSULTA')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend; npx vitest run src/components/ciclicidade/TransitionMatrix.test.ts`
Expected: FAIL (componente não existe)

- [ ] **Step 3: Implementar o componente**

Cria `frontend/src/components/ciclicidade/TransitionMatrix.vue` com:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { NoItem, TransicaoItem } from '@/types/api.types'

const props = defineProps<{ nos: NoItem[]; transicoes: TransicaoItem[] }>()

// Ordem fixa das etapas (as presentes nos dados, na ordem canônica da jornada).
const ORDEM = ['PRONTUARIO', 'CONSULTA', 'PROCEDIMENTO', 'EXAME', 'INTERNACAO', 'CIRURGIA', 'ALTA']
const tipos = computed(() => {
  const presentes = new Set(props.nos.map((n) => n.tipo))
  return ORDEM.filter((t) => presentes.has(t as never))
})

const mapa = computed(() => {
  const m = new Map<string, TransicaoItem>()
  for (const t of props.transicoes) m.set(`${t.origem}→${t.destino}`, t)
  return m
})
const maxVol = computed(() => Math.max(1, ...props.transicoes.map((t) => t.volume)))

function cell(origem: string, destino: string): TransicaoItem | undefined {
  return mapa.value.get(`${origem}→${destino}`)
}
function intensidade(vol: number): number {
  return 0.12 + 0.88 * (vol / maxVol.value) // 0.12–1.0 (evita célula invisível)
}
function tempoLabel(s: number | null): string {
  if (s === null) return 'tempo n/d'
  const dias = s / 86400
  return dias >= 1 ? `${dias.toFixed(1)} d` : `${(s / 3600).toFixed(1)} h`
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="border-collapse text-xs">
      <thead>
        <tr>
          <th class="p-2 text-left text-text-muted dark:text-text-dark-muted">de \ para</th>
          <th v-for="d in tipos" :key="d" class="p-2 font-medium text-text dark:text-text-dark whitespace-nowrap">{{ d }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="o in tipos" :key="o">
          <th class="p-2 text-left font-medium text-text dark:text-text-dark whitespace-nowrap">{{ o }}</th>
          <td v-for="d in tipos" :key="d" class="p-0">
            <div
              class="h-10 w-16 flex items-center justify-center rounded"
              :class="cell(o, d) ? 'text-white font-semibold' : 'text-text-faint'"
              :style="cell(o, d) ? { backgroundColor: `rgba(37, 99, 235, ${intensidade(cell(o, d)!.volume)})` } : {}"
              :title="cell(o, d) ? `${o} → ${d}: ${cell(o, d)!.volume} · ${tempoLabel(cell(o, d)!.tempo_medio_s)}` : ''"
            >
              {{ cell(o, d)?.volume ?? '·' }}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

> Ao aplicar a skill `dataviz` (Task 10), reveja a cor `rgba(37, 99, 235, …)` para a paleta oficial e o contraste em dark/light. Por ora, azul do brand.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend; npx vitest run src/components/ciclicidade/TransitionMatrix.test.ts`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ciclicidade/TransitionMatrix.vue frontend/src/components/ciclicidade/TransitionMatrix.test.ts
git commit -m "feat(ciclicidade): componente TransitionMatrix (heatmap origem x destino)"
```

---

## Task 8: View + rota + navegação (matriz no ar)

**Files:**
- Create: `frontend/src/views/CiclicidadeView.vue`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/components/ui/Icon.vue`
- Modify: `frontend/src/components/ui/AppSidebar.vue`
- Modify: `frontend/src/components/ui/BottomNav.vue`

- [ ] **Step 1: Criar a view (só matriz por enquanto)**

Cria `frontend/src/views/CiclicidadeView.vue` com:

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useCiclicidadeStore } from '@/stores/useCiclicidadeStore'
import FilterBar from '@/components/ui/FilterBar.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import TransitionMatrix from '@/components/ciclicidade/TransitionMatrix.vue'

const store = useCiclicidadeStore()

onMounted(() => {
  store.initWatcher()
  void store.fetch()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-text dark:text-text-dark tracking-tight">Ciclicidade da jornada</h1>
      <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">
        Fluxo agregado das transições entre etapas · coorte definida pelos filtros
      </p>
    </div>
    <FilterBar />
    <BaseCard>
      <Skeleton v-if="store.loading" height="h-64" />
      <ErrorState v-else-if="store.error" :message="store.error" @retry="store.fetch" />
      <EmptyState
        v-else-if="store.transicoes.length === 0"
        title="Sem transições"
        description="Nenhuma transição encontrada para esta coorte."
      />
      <TransitionMatrix v-else :nos="store.nos" :transicoes="store.transicoes" />
    </BaseCard>
  </div>
</template>
```

- [ ] **Step 2: Adicionar o ícone**

Em `frontend/src/components/ui/Icon.vue`, dentro do objeto `PATHS` (após a linha `jornada: '...'`), adiciona:

```typescript
  ciclicidade: '<path d="M4 12a8 8 0 0 1 13.5-5.5L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-13.5 5.5L4 15"/><path d="M4 20v-5h5"/>',
```

- [ ] **Step 3: Adicionar a rota**

Em `frontend/src/router/index.ts`, importa a view e adiciona a rota (após a linha do `jornada`):

```typescript
import CiclicidadeView from '@/views/CiclicidadeView.vue'
```
```typescript
  { path: '/ciclicidade', name: 'ciclicidade', component: CiclicidadeView, meta: { title: 'Ciclicidade — PIJA' } },
```

- [ ] **Step 4: Adicionar à navegação**

Em `frontend/src/components/ui/AppSidebar.vue`, no array `items`, adiciona após a entrada `jornada`:

```typescript
  { to: '/ciclicidade', label: 'Ciclicidade', icon: 'ciclicidade' },
```

Em `frontend/src/components/ui/BottomNav.vue`, no array `items`, adiciona após a entrada `jornada`:

```typescript
  { to: '/ciclicidade', label: 'Ciclos', icon: 'ciclicidade' },
```

- [ ] **Step 5: Type-check + rodar app**

Run: `cd frontend; npm run type-check`
Expected: sem erros.
Verificação manual: `npm run dev`, navegar para `/ciclicidade`, ver a matriz preencher (mock ou backend real).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/CiclicidadeView.vue frontend/src/router/index.ts frontend/src/components/ui/Icon.vue frontend/src/components/ui/AppSidebar.vue frontend/src/components/ui/BottomNav.vue
git commit -m "feat(ciclicidade): view + rota + navegacao (matriz no ar)"
```

---

## Task 9: Componente TransitionGraph (a estrela) (TDD)

**Files:**
- Create: `frontend/src/components/ciclicidade/TransitionGraph.vue`
- Test: `frontend/src/components/ciclicidade/TransitionGraph.test.ts`

Grafo SVG com nós em posição fixa (círculo). Arestas como curvas com espessura ∝ volume; auto-laços como arco no nó; tooltip com volume + tempo.

- [ ] **Step 1: Escrever o teste que falha**

Cria `frontend/src/components/ciclicidade/TransitionGraph.test.ts` com:

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TransitionGraph from './TransitionGraph.vue'

const props = {
  nos: [
    { tipo: 'PRONTUARIO', total_entradas: 0, total_saidas: 5 },
    { tipo: 'CONSULTA', total_entradas: 5, total_saidas: 1 },
    { tipo: 'INTERNACAO', total_entradas: 1, total_saidas: 1 },
  ],
  transicoes: [
    { origem: 'PRONTUARIO', destino: 'CONSULTA', volume: 5, tempo_medio_s: 86400, n: 5 },
    { origem: 'CONSULTA', destino: 'INTERNACAO', volume: 1, tempo_medio_s: 172800, n: 1 },
    { origem: 'INTERNACAO', destino: 'CONSULTA', volume: 1, tempo_medio_s: 259200, n: 1 },
  ],
}

describe('TransitionGraph', () => {
  it('renderiza um <svg>', () => {
    const w = mount(TransitionGraph, { props })
    expect(w.find('svg').exists()).toBe(true)
  })

  it('desenha um nó por tipo e uma aresta por transição', () => {
    const w = mount(TransitionGraph, { props })
    expect(w.findAll('[data-node]')).toHaveLength(3)
    expect(w.findAll('[data-edge]')).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend; npx vitest run src/components/ciclicidade/TransitionGraph.test.ts`
Expected: FAIL (componente não existe)

- [ ] **Step 3: Implementar o componente**

Cria `frontend/src/components/ciclicidade/TransitionGraph.vue` com:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { NoItem, TransicaoItem } from '@/types/api.types'

const props = defineProps<{ nos: NoItem[]; transicoes: TransicaoItem[] }>()

const ORDEM = ['PRONTUARIO', 'CONSULTA', 'PROCEDIMENTO', 'EXAME', 'INTERNACAO', 'CIRURGIA', 'ALTA']
const W = 420
const H = 420
const R = 150   // raio do círculo dos nós
const CX = W / 2
const CY = H / 2

const tipos = computed(() => {
  const presentes = new Set(props.nos.map((n) => n.tipo))
  return ORDEM.filter((t) => presentes.has(t as never))
})

// Posição fixa de cada nó no círculo.
const pos = computed(() => {
  const m = new Map<string, { x: number; y: number }>()
  const n = tipos.value.length
  tipos.value.forEach((t, i) => {
    const ang = (-Math.PI / 2) + (2 * Math.PI * i) / n
    m.set(t, { x: CX + R * Math.cos(ang), y: CY + R * Math.sin(ang) })
  })
  return m
})

const maxVol = computed(() => Math.max(1, ...props.transicoes.map((t) => t.volume)))
function largura(vol: number): number {
  return 1 + 6 * (vol / maxVol.value) // 1–7 px
}
function tempoLabel(s: number | null): string {
  if (s === null) return 'tempo n/d'
  const dias = s / 86400
  return dias >= 1 ? `${dias.toFixed(1)} d` : `${(s / 3600).toFixed(1)} h`
}

interface Edge {
  key: string; d: string; w: number; title: string; selfLoop: boolean; mx: number; my: number
}

const edges = computed<Edge[]>(() => {
  const out: Edge[] = []
  for (const t of props.transicoes) {
    const a = pos.value.get(t.origem)
    const b = pos.value.get(t.destino)
    if (!a || !b) continue
    const title = `${t.origem} → ${t.destino}: ${t.volume} · ${tempoLabel(t.tempo_medio_s)}`
    if (t.origem === t.destino) {
      // Auto-laço: pequeno arco saindo e voltando ao nó, apontando pra fora do centro.
      const ox = a.x - CX, oy = a.y - CY
      const len = Math.hypot(ox, oy) || 1
      const ux = ox / len, uy = oy / len
      const tipx = a.x + ux * 34, tipy = a.y + uy * 34
      const d = `M ${a.x - uy * 6} ${a.y + ux * 6} Q ${tipx} ${tipy} ${a.x + uy * 6} ${a.y - ux * 6}`
      out.push({ key: `${t.origem}-self`, d, w: largura(t.volume), title, selfLoop: true, mx: tipx, my: tipy })
    } else {
      // Curva quadrática levemente arqueada (assimetria distingue A→B de B→A).
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
      const nx = -(b.y - a.y), ny = (b.x - a.x)
      const nlen = Math.hypot(nx, ny) || 1
      const bend = 28
      const cx = mx + (nx / nlen) * bend, cy = my + (ny / nlen) * bend
      const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`
      out.push({ key: `${t.origem}-${t.destino}`, d, w: largura(t.volume), title, selfLoop: false, mx: cx, my: cy })
    }
  }
  return out
})
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" class="w-full max-w-md mx-auto text-primary" role="img" aria-label="Grafo de transições entre etapas">
    <defs>
      <marker id="cic-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" fill="currentColor" />
      </marker>
    </defs>

    <!-- Arestas -->
    <g fill="none" stroke="currentColor" opacity="0.55">
      <path
        v-for="e in edges" :key="e.key" data-edge
        :d="e.d" :stroke-width="e.w" marker-end="url(#cic-arrow)"
      >
        <title>{{ e.title }}</title>
      </path>
    </g>

    <!-- Nós -->
    <g>
      <g v-for="t in tipos" :key="t" data-node :transform="`translate(${pos.get(t)!.x}, ${pos.get(t)!.y})`">
        <circle r="22" class="fill-surface dark:fill-surface-dark" stroke="currentColor" stroke-width="1.5" />
        <text text-anchor="middle" dy="0.32em" class="fill-text dark:fill-text-dark" font-size="8" font-weight="600">
          {{ t.slice(0, 5) }}
        </text>
      </g>
    </g>
  </svg>
</template>
```

> A skill `dataviz` guia paleta/contraste. As classes `fill-*` seguem o design system do projeto; ajuste se os tokens diferirem.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend; npx vitest run src/components/ciclicidade/TransitionGraph.test.ts`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ciclicidade/TransitionGraph.vue frontend/src/components/ciclicidade/TransitionGraph.test.ts
git commit -m "feat(ciclicidade): componente TransitionGraph (SVG, nos fixos, auto-lacos)"
```

---

## Task 10: Toggle Grafo ⇄ Matriz na view + polish dataviz

**Files:**
- Modify: `frontend/src/views/CiclicidadeView.vue`

- [ ] **Step 1: Aplicar a skill dataviz**

Invoca a skill `dataviz` e revê as cores/contraste de `TransitionMatrix.vue` e `TransitionGraph.vue` (paleta oficial, legibilidade em dark/light, foco/hover acessível). Aplica os ajustes recomendados.

- [ ] **Step 2: Adicionar o toggle na view**

Em `frontend/src/views/CiclicidadeView.vue`, atualiza o `<script setup>` para incluir o estado do modo e importar os componentes:

```typescript
import { onMounted, ref } from 'vue'
import { useCiclicidadeStore } from '@/stores/useCiclicidadeStore'
import FilterBar from '@/components/ui/FilterBar.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import TransitionMatrix from '@/components/ciclicidade/TransitionMatrix.vue'
import TransitionGraph from '@/components/ciclicidade/TransitionGraph.vue'

const store = useCiclicidadeStore()
const modo = ref<'grafo' | 'matriz'>('grafo')
const opcoes = [
  { value: 'grafo', label: 'Grafo' },
  { value: 'matriz', label: 'Matriz' },
]

onMounted(() => {
  store.initWatcher()
  void store.fetch()
})
```

Substitui o `<BaseCard>` do template por:

```vue
    <div class="flex justify-end">
      <SegmentedControl v-model="modo" :options="opcoes" />
    </div>
    <BaseCard>
      <Skeleton v-if="store.loading" height="h-64" />
      <ErrorState v-else-if="store.error" :message="store.error" @retry="store.fetch" />
      <EmptyState
        v-else-if="store.transicoes.length === 0"
        title="Sem transições"
        description="Nenhuma transição encontrada para esta coorte."
      />
      <TransitionGraph v-else-if="modo === 'grafo'" :nos="store.nos" :transicoes="store.transicoes" />
      <TransitionMatrix v-else :nos="store.nos" :transicoes="store.transicoes" />
    </BaseCard>
```

- [ ] **Step 3: Type-check + verificação manual**

Run: `cd frontend; npm run type-check`
Expected: sem erros. Manual: `/ciclicidade` alterna Grafo ⇄ Matriz; filtros re-buscam.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/CiclicidadeView.vue frontend/src/components/ciclicidade/TransitionMatrix.vue frontend/src/components/ciclicidade/TransitionGraph.vue
git commit -m "feat(ciclicidade): toggle grafo/matriz na view + ajustes dataviz"
```

---

## Task 11: Mini-grafo na Jornada individual

**Files:**
- Modify: `frontend/src/views/JornadaView.vue`

Reusa o `TransitionGraph` com a coorte = 1 paciente (via `getCiclicidade({ paciente_id })`). Guarda: esconde se < 2 transições.

- [ ] **Step 1: Buscar as transições do paciente na view**

Em `frontend/src/views/JornadaView.vue`, adiciona ao `<script setup>` (após os imports existentes):

```typescript
import { watch } from 'vue'
import { getCiclicidade } from '@/services/api'
import TransitionGraph from '@/components/ciclicidade/TransitionGraph.vue'
import type { CiclicidadeResponse } from '@/types/api.types'

const ciclo = ref<CiclicidadeResponse | null>(null)

watch(
  () => store.pacienteId,
  async (id) => {
    ciclo.value = null
    if (!id) return
    try {
      ciclo.value = await getCiclicidade({ paciente_id: id })
    } catch {
      ciclo.value = null // silencioso: a timeline continua sendo o principal
    }
  },
)
```

> `ref` já está importado no topo do arquivo. Adicione apenas `watch` ao import de `vue` existente (`import { ref, computed, watch } from 'vue'`).

- [ ] **Step 2: Renderizar o mini-grafo (guarda de < 2 transições)**

Em `JornadaView.vue`, dentro do `<template v-else>` (o bloco que mostra a timeline), antes do `<BaseCard>` da Timeline, adiciona:

```vue
      <BaseCard v-if="ciclo && ciclo.transicoes.length >= 2">
        <p class="text-xs text-text-muted dark:text-text-dark-muted mb-2">Fluxo de transições deste paciente</p>
        <TransitionGraph :nos="ciclo.nos" :transicoes="ciclo.transicoes" />
      </BaseCard>
```

- [ ] **Step 3: Type-check + verificação manual**

Run: `cd frontend; npm run type-check`
Expected: sem erros. Manual: buscar prontuário `21331343` (ou `001` no mock) → mini-grafo aparece acima da timeline; paciente com < 2 transições não mostra o grafo.

- [ ] **Step 4: Rodar toda a suíte frontend**

Run: `cd frontend; npx vitest run`
Expected: PASS (35 anteriores + novos).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/JornadaView.vue
git commit -m "feat(ciclicidade): mini-grafo de transicoes na Jornada individual"
```

---

## Verificação final

- [ ] Backend: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest -q` → tudo verde.
- [ ] Frontend: `cd frontend; npx vitest run` → tudo verde · `npm run type-check` → limpo.
- [ ] Manual: `/ciclicidade` (grafo + matriz + filtros como coorte) e Jornada individual com mini-grafo.
- [ ] Atualizar o handoff/estado marcando §4.1 (ciclicidade) em progresso/concluído e seguir para code-review (`superpowers:requesting-code-review`) antes do merge.

---

## Notas de escopo (do spec)

- **Fora agora (YAGNI):** agrupar os 7 tipos em 5 áreas; animações; exportar imagem; comparar coortes lado a lado; novos índices no banco (só se a query se mostrar lenta no DB real).
- **Ordem que garante entrega:** o valor mínimo (matriz no ar) chega no fim da Task 8; grafo e individual são incrementos.
