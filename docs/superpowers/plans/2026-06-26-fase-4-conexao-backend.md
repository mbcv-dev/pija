# Fase 4 — Conectar front ↔ backend real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Handoff:** plano escrito para outro dev, com zero contexto do repo. Leia primeiro `docs/superpowers/specs/2026-06-26-fase-4-conexao-backend-design.md` (spec), `docs/DEPLOY.md` e `docs/HANDOFF.md`.

**Goal:** Hospedar o backend FastAPI (SQLite) no Railway com volume persistente, habilitar CORS travado na origem do front, e conectar a demo Vercel a dados reais.

**Architecture:** Backend empacotado em Docker, rodando no Railway com volume em `/data`. O banco `pija.db` é gerado **no host** por uma imagem "seed" de carga única (roda o ETL existente a partir dos CSVs e termina); depois o serviço roda a imagem normal (slim, só `uvicorn`) lendo o `.db` do volume. CORS lê origens de env. O cutover do front (env no Vercel) é ação do dono da conta.

**Tech Stack:** Python 3.11 + FastAPI + SQLAlchemy async + aiosqlite; Docker; Railway; pytest + httpx.

**Pré-requisitos do dev (confirmar ANTES de começar):**
- Acesso ao repo `https://github.com/mbcv-dev/pija` (branch a partir da `main`).
- Os **6 CSVs do HC** (5 views + `vw_pacientes_anonimizado_v2.csv`) — **não estão no repo** (gitignored). Obter com o time (origem: WhatsApp do Daniel Turmina, HC-UFPE). Ver `docs/DADOS-ESTADO.md`.
- Conta no **Railway** (plano hobby serve; conferir limite do volume ≥1,1 GB) + **Railway CLI** instalado (`npm i -g @railway/cli`).
- Docker instalado localmente (para os smoke tests).
- Ambiente do backend para rodar testes: `cd backend && source venv/Scripts/activate` (Windows Git Bash), `export JWT_SECRET="any-string-with-at-least-32-characters-yes"`, `export PYTHONIOENCODING=utf-8`.

---

## Mapa de arquivos

- Modify: `backend/src/pija/settings.py` (campo `cors_origins` + helper de lista)
- Modify: `backend/src/pija/main.py` (CORSMiddleware)
- Test: `backend/tests/test_settings.py` (parsing de CORS), `backend/tests/test_cors.py` (novo — header de CORS)
- Create: `backend/Dockerfile` (imagem steady-state, slim)
- Create: `backend/Dockerfile.seed` (imagem de carga única — roda ETL)
- Create: `backend/.dockerignore`
- Create: `backend/docker-entrypoint.sh` (steady-state: só uvicorn) — opcional, ver Task 3
- Create: `backend/railway.json` (healthcheck `/health`)
- Modify: `docs/DEPLOY.md`, `docs/HANDOFF.md` (estado pós-conexão)

---

## Phase A — Backend: CORS (TDD)

### Task 1: `Settings.cors_origins` + helper de lista

**Files:**
- Modify: `backend/src/pija/settings.py`
- Test: `backend/tests/test_settings.py`

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar ao final de `backend/tests/test_settings.py`:
```python
def test_cors_origins_list_splits_and_trims(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://a.com, https://b.com ,")
    from pija.settings import Settings
    s = Settings()
    assert s.cors_origins_list() == ["https://a.com", "https://b.com"]


def test_cors_origins_list_empty_when_unset(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    from pija.settings import Settings
    s = Settings()
    assert s.cors_origins_list() == []
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && python -m pytest tests/test_settings.py -q`
Expected: FAIL (`AttributeError: 'Settings' object has no attribute 'cors_origins_list'`).

- [ ] **Step 3: Implementar**

Em `backend/src/pija/settings.py`, dentro da classe `Settings`, adicionar o campo (perto de `csv_dir`) e o método:
```python
    # CORS (Fase 4) — origens permitidas, separadas por vírgula
    cors_origins: str = ""
```
E, como método da classe:
```python
    def cors_origins_list(self) -> list[str]:
        """Lista de origens permitidas para CORS (ignora vazios e espaços)."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && python -m pytest tests/test_settings.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/pija/settings.py backend/tests/test_settings.py
git commit -m "feat(back): add cors_origins setting + list helper"
```

### Task 2: CORSMiddleware no app

**Files:**
- Modify: `backend/src/pija/main.py`
- Test: `backend/tests/test_cors.py` (novo)

- [ ] **Step 1: Escrever o teste (falhando)**

Create `backend/tests/test_cors.py`:
```python
import importlib
import os

from fastapi.testclient import TestClient


def _client_with_origins(origins: str) -> TestClient:
    os.environ["CORS_ORIGINS"] = origins
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


def teardown_module(_module):
    # Limpar env e recarregar para não vazar estado p/ outros testes
    os.environ.pop("CORS_ORIGINS", None)
    import importlib
    import pija.settings as settings_mod
    import pija.main as main_mod
    importlib.reload(settings_mod)
    importlib.reload(main_mod)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && python -m pytest tests/test_cors.py -q`
Expected: FAIL (`test_cors_allows_configured_origin` — header ausente, pois não há CORS ainda).

- [ ] **Step 3: Implementar CORS no `main.py`**

Em `backend/src/pija/main.py`:
(a) adicionar o import perto dos outros:
```python
from fastapi.middleware.cors import CORSMiddleware
```
(b) logo após a criação do `app = FastAPI(...)` (antes dos `include_router`), adicionar:
```python
_cors_origins = _settings.cors_origins_list()
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["*"],
        allow_credentials=False,
    )
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && python -m pytest tests/test_cors.py -q`
Expected: PASS (2 testes).

- [ ] **Step 5: Suite completa (sem regressão)**

Run: `cd backend && python -m pytest -q`
Expected: todos verdes (~99 + os novos). Garanta `JWT_SECRET` e `PYTHONIOENCODING=utf-8` exportados.

- [ ] **Step 6: Commit**

```bash
git add backend/src/pija/main.py backend/tests/test_cors.py
git commit -m "feat(back): CORS middleware gated by CORS_ORIGINS (read-only)"
```

---

## Phase B — Empacotamento (Docker)

### Task 3: Dockerfile steady-state + .dockerignore + railway.json

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Create: `backend/railway.json`

- [ ] **Step 1: `.dockerignore`**

Create `backend/.dockerignore`:
```
venv/
data/
**/__pycache__/
*.db
*.sqlite
.env
seed-csv/
.pytest_cache/
tests/
```

- [ ] **Step 2: `Dockerfile` (slim, só serve a API)**

Create `backend/Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Dependências de runtime (sem dev). Instala a partir do pyproject.
COPY pyproject.toml ./
RUN pip install --no-cache-dir \
    "fastapi>=0.115" "uvicorn[standard]>=0.30" "pydantic>=2.8" "pydantic-settings>=2.4" \
    "sqlalchemy[asyncio]>=2.0" "aiosqlite>=0.20" "alembic>=1.13" "pandas>=2.2" \
    "python-multipart>=0.0.9" "PyJWT>=2.9" "bcrypt>=4.2" "PyYAML>=6.0"

COPY src/ ./src/
ENV PYTHONPATH=/app/src

# Railway injeta $PORT. Default 8000 para rodar local.
ENV PORT=8000
CMD ["sh", "-c", "uvicorn pija.main:app --host 0.0.0.0 --port ${PORT}"]
```

- [ ] **Step 3: `railway.json` (healthcheck)**

Create `backend/railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 120,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore backend/railway.json
git commit -m "build(back): steady-state Dockerfile + dockerignore + railway config"
```

### Task 4: Smoke test local da imagem steady-state

**Files:** nenhum (verificação).

- [ ] **Step 1: Build da imagem**

Run: `cd backend && docker build -t pija-back:steady .`
Expected: build conclui sem erro.

- [ ] **Step 2: Rodar com um banco pequeno (sample) e checar `/health` + um KPI**

Gere um `pija.db` pequeno só para o smoke (10 linhas por view) usando o ETL local — requer CSVs em `./CSV-aghu` no host de dev:
```bash
cd backend && source venv/Scripts/activate
export JWT_SECRET="any-string-with-at-least-32-characters-yes"
export SQLITE_PATH="./data/smoke.db" CSV_DIR="./CSV-aghu"
python -m pija.etl.runner --sample 10
```
Então rode o container montando esse db:
```bash
docker run --rm -p 8000:8000 \
  -e JWT_SECRET="any-string-with-at-least-32-characters-yes" \
  -e SQLITE_PATH="/data/smoke.db" \
  -e CORS_ORIGINS="https://pija-alpha.vercel.app" \
  -v "$(pwd)/data:/data" \
  pija-back:steady
```
Em outro terminal:
```bash
curl -s localhost:8000/health
curl -s "localhost:8000/api/v1/kpis/tempos-medios" | head -c 300
```
Expected: `/health` → `{"status":"ok",...}`; o KPI retorna JSON com `kpis` (valores pequenos do sample). Pare o container (Ctrl+C).

> Se não tiver os CSVs no host de dev, pule o sample e apenas valide `/health` apontando `SQLITE_PATH` para um `.db` vazio criado com `python -m pija.etl.runner --sample 0` ou um arquivo SQLite vazio. O objetivo é provar que a imagem sobe e serve.

- [ ] **Step 2b: Sem commit** (verificação apenas). Remova `backend/data/smoke.db` ao final (`rm -f backend/data/smoke.db`).

### Task 5: Dockerfile.seed (carga única do banco no volume)

Esta imagem **roda o ETL e termina**; será deployada UMA vez no Railway com o volume montado para popular `/data/pija.db`. Não fica no ar.

**Files:**
- Create: `backend/Dockerfile.seed`

- [ ] **Step 1: `Dockerfile.seed`**

Create `backend/Dockerfile.seed`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app
RUN pip install --no-cache-dir \
    "pydantic>=2.8" "pydantic-settings>=2.4" "sqlalchemy[asyncio]>=2.0" \
    "aiosqlite>=0.20" "pandas>=2.2" "PyYAML>=6.0"

COPY src/ ./src/
ENV PYTHONPATH=/app/src

# Os CSVs são copiados pela pipeline do Railway a partir de backend/seed-csv/
# (pasta gitignored onde o dev coloca os 6 arquivos antes do deploy de seed).
COPY seed-csv/ /seed-csv/

# Roda o ETL escrevendo no volume montado, depois sai 0.
# CSV_DIR e SQLITE_PATH vêm do ambiente do serviço de seed (ver Task 7).
CMD ["python", "-m", "pija.etl.runner"]
```

- [ ] **Step 2: Garantir que `seed-csv/` é ignorado pelo git**

Confirme/adapte: `backend/.dockerignore` NÃO deve ignorar `seed-csv/` para a imagem de seed — mas como usamos o MESMO contexto, e o steady-state `.dockerignore` lista `seed-csv/`, faça o build de seed a partir de um `.dockerignore` específico OU remova a linha `seed-csv/` do `.dockerignore` só durante o build de seed. **Mais simples:** criar `backend/.dockerignore.seed` sem a linha `seed-csv/` e buildar com `docker build -f Dockerfile.seed`. Para o Railway (que usa `.dockerignore` global), documentar que o serviço de seed roda com um `.dockerignore` que permite `seed-csv/`. Registre essa nuance no commit/PR.

Acrescente ao `.gitignore` da raiz (se ainda não cobrir): `backend/seed-csv/`.

- [ ] **Step 3: Commit**

```bash
git add backend/Dockerfile.seed .gitignore
git commit -m "build(back): one-time seed image to load pija.db on the volume"
```

---

## Phase C — Provisionar Railway + carregar o banco (runbook)

> Estas tarefas executam contra o produto Railway ao vivo. Os comandos do Railway CLI mudam de tempos em tempos — confirme na doc atual (`railway --help`). Onde a UI/CLI variar, use o dashboard do Railway equivalente. Registre no PR os comandos/telas exatos usados.

### Task 6: Criar projeto, volume e variáveis

- [ ] **Step 1: Login + init**
```bash
railway login
cd backend && railway init        # cria/conecta um projeto Railway
```

- [ ] **Step 2: Anexar volume persistente**
No dashboard do Railway (ou CLI, se disponível): criar um **Volume** montado em `/data` no serviço. Confirmar capacidade ≥ 2 GB (o `.db` ~1,1 GB + folga).

- [ ] **Step 3: Definir variáveis de ambiente do serviço**
```bash
railway variables set \
  JWT_SECRET="<gere uma string aleatória de 32+ chars>" \
  SQLITE_PATH="/data/pija.db" \
  CSV_DIR="/data/csv" \
  RESOURCE_MODE="csv" \
  CORS_ORIGINS="https://pija-alpha.vercel.app"
```
Expected: variáveis listadas em `railway variables`.

- [ ] **Step 4: Sem commit** (config no Railway). Anote no PR o nome do projeto/serviço Railway.

### Task 7: Carga única do banco (seed)

> Objetivo: gerar `/data/pija.db` no volume rodando o ETL no host, a partir dos CSVs. Estratégia: um deploy temporário usando `Dockerfile.seed`, que copia os CSVs e roda o ETL escrevendo no volume; ao terminar (exit 0), o serviço fica "completed" e trocamos para a imagem steady-state.

- [ ] **Step 1: Colocar os 6 CSVs em `backend/seed-csv/`**
Copie localmente os 6 arquivos (5 views + `vw_pacientes_anonimizado_v2.csv`) para `backend/seed-csv/`. Confira em `docs/DADOS-ESTADO.md` quais nomes de arquivo o mapper de internação espera (o export v2 traz a alta médica real do KPI-07B).

- [ ] **Step 2: Apontar o build do serviço para `Dockerfile.seed`** e garantir `CSV_DIR=/data/csv` **ou** ajustar para ler de `/seed-csv` (a imagem copia os CSVs para `/seed-csv`). Escolha uma:
  - **Opção rápida:** setar `CSV_DIR=/seed-csv` para o deploy de seed (lê direto da pasta copiada na imagem), com `SQLITE_PATH=/data/pija.db` (escreve no volume).
  - Reverter `CSV_DIR` para `/data/csv` (ou remover) depois do seed, já que o steady-state não usa CSV.
Setar via `railway variables set CSV_DIR="/seed-csv"`.

- [ ] **Step 3: Deploy do seed**
```bash
cd backend && railway up      # builda Dockerfile.seed e roda o ETL no host
```
Acompanhe os logs (`railway logs`): deve registrar `Iniciando ETL: vw_pacientes ... vw_cirurgias` e terminar sem erro. Pode levar minutos (685 MB, streaming chunked).

- [ ] **Step 4: Validar a carga**
Com o volume populado, valide a contagem. Faça um deploy steady-state (Task 8) e, com a API no ar, cheque um endpoint que reflita volume (ex.: `/api/v1/eventos?limit=1` deve trazer `total` ~2,26M). Se preferir validar antes, use um shell/one-off no Railway para `sqlite3 /data/pija.db "select count(*) from fato_eventos_jornada;"` (esperado ~2.261.659) — registre o número real no PR.

- [ ] **Step 5: Sem commit.** (`backend/seed-csv/` é gitignored e nunca vai ao repo.)

### Task 8: Subir steady-state + validar API pública e CORS

- [ ] **Step 1: Trocar o build para o `Dockerfile` steady-state** (o `railway.json` já aponta para `Dockerfile`). Garanta que o serviço usa a imagem normal (sem CSVs) e que o volume `/data` continua montado.
```bash
cd backend && railway up
```
Aguarde o healthcheck `/health` passar (verde no dashboard).

- [ ] **Step 2: Obter a URL pública**
No dashboard, gerar/!ler o domínio público do serviço (ex.: `https://pija-back-production.up.railway.app`). Anote.

- [ ] **Step 3: Validar a API real**
```bash
curl -s https://<backend>/health
curl -s "https://<backend>/api/v1/kpis/tempos-medios" | head -c 400
curl -s "https://<backend>/api/v1/eventos?limit=1" | head -c 300
```
Expected: `/health` 200; KPIs com `media_global` reais; `total` de eventos na casa dos milhões. `https://<backend>/docs` abre.

- [ ] **Step 4: Validar CORS**
```bash
curl -s -i -H "Origin: https://pija-alpha.vercel.app" https://<backend>/health | grep -i access-control-allow-origin
curl -s -i -H "Origin: https://evil.example" https://<backend>/health | grep -i access-control-allow-origin || echo "blocked (esperado)"
```
Expected: a 1ª devolve `access-control-allow-origin: https://pija-alpha.vercel.app`; a 2ª não.

- [ ] **Step 5: Sem commit.** Entregar ao dono da conta: **URL pública** + confirmação de `/health`, KPIs reais e CORS ok.

---

## Phase D — Cutover do front (dono) + docs

### Task 9: Cutover no Vercel (ação do DONO da conta)

> Executado por quem tem acesso ao projeto Vercel `pija` (conta `matheus-vieiras-projects-203976e8`). O dev entrega a URL; o dono faz este passo.

- [ ] **Step 1:** No projeto Vercel `pija` → Settings → Environment Variables (Production):
  - `VITE_USE_MOCK = false`
  - `VITE_API_BASE_URL = https://<backend>`
- [ ] **Step 2:** Redeploy do último build (Deployments → ⋯ → Redeploy) ou um push na `main`.
- [ ] **Step 3:** Abrir `https://pija-alpha.vercel.app/` (Ctrl+Shift+R). Verificar: Dashboard e Gargalos com **dados reais**; Jornada **continua em mock** (esperado — `paciente_id` é fase futura). Conferir o Network: chamadas a `https://<backend>/api/v1/...` retornando 200.

### Task 10: Atualizar docs + verificação final + rollback

**Files:**
- Modify: `docs/DEPLOY.md`, `docs/HANDOFF.md`

- [ ] **Step 1: Documentar o deploy real em `docs/DEPLOY.md`**
Atualizar a seção 5 "Próximos passos" e a seção 3: registrar que o backend está no ar no Railway, a URL pública, o nome do projeto/serviço, o caminho do volume (`/data`), as env vars usadas, e o número real de eventos carregados (do Step 4/Task 7).

- [ ] **Step 2: Atualizar `docs/HANDOFF.md`**
Na seção "Deploy" e no TL;DR: registrar que **back↔front estão conectados** (Fase 4 entregue), modo real (`VITE_USE_MOCK=false`), e que a **Jornada segue em mock** até o filtro `paciente_id` (fase futura). Mover os itens de Fase 4 já feitos das "Pendências".

- [ ] **Step 3: Testar o rollback**
No Vercel, reverter `VITE_USE_MOCK=true` + redeploy → confirmar que a demo volta a funcionar em mock. Depois voltar para `false` (estado conectado). Registrar no PR que o rollback foi testado.

- [ ] **Step 4: Commit das docs**
```bash
git add docs/DEPLOY.md docs/HANDOFF.md
git commit -m "docs: backend deployed on Railway; front connected to real data (Fase 4)"
```

- [ ] **Step 5: Suite do backend verde**
Run: `cd backend && python -m pytest -q` (com `JWT_SECRET` e `PYTHONIOENCODING=utf-8`).
Expected: todos os testes passam (incluindo `test_cors.py`).

---

## Self-Review

**Spec coverage (spec §→task):**
- §2/§6 hospedar no Railway + volume + SQLite → Tasks 3,6,8.
- §7 CORS + read-only → Tasks 1,2.
- §7 empacotamento (Dockerfile/.dockerignore/railway) → Tasks 3,5.
- §8 carga única no host via ETL existente (inclui CSV v2 p/ KPI-07B; `grupo` correto no ETL completo) → Tasks 5,7.
- §9 cutover do front pelo dono → Task 9.
- §10 verificação (health/endpoints/CORS/etl_log/pytest) → Tasks 4,8,10.
- §11 rollback → Task 10 Step 3.
- §12 docs atualizadas ao final → Task 10.
- §13 riscos (CSVs, ETL longo, custo volume, JWT_SECRET) → cobertos nos pré-requisitos e Tasks 6/7.

**Placeholder scan:** as tarefas de infra (6–9) são runbooks contra um provedor ao vivo; onde a CLI do Railway pode variar, está explícito "confirmar na doc atual / usar dashboard equivalente e registrar no PR" — isso é instrução real, não placeholder. As tarefas de código (1–3,5) têm código completo.

**Consistência:** env vars (`JWT_SECRET`, `SQLITE_PATH=/data/pija.db`, `CSV_DIR`, `CORS_ORIGINS`, `RESOURCE_MODE`), `cors_origins_list()`, `/health`, `Dockerfile` vs `Dockerfile.seed` e o caminho `/seed-csv` são usados de forma idêntica entre as tarefas que os definem e as que os consomem.

**Nuance conhecida (registrada na Task 5 Step 2):** o `.dockerignore` steady-state ignora `seed-csv/`; o build de seed precisa de um `.dockerignore` que permita a pasta. Resolver com `.dockerignore.seed` + `docker build -f`, e documentar o equivalente no Railway.
