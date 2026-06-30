# Fase 4 — Infra & Deploy: o que fazer + pendências gerais

> **Data:** 2026-06-29
> **Tema:** fechar a integração front↔back em produção (Vercel + Railway) e mapear pendências do sistema.
> **Contexto:** o João entregou o backend de integração (commit `b37eacd` — CORS, filtro de eventos por `paciente_id`, `Dockerfile`, `Dockerfile.seed`, `railway.json`, `frontend/.env.example`). O frontend já está repaginado e no ar (`pija-alpha.vercel.app`). Falta a **parte de infra** (responsável: usuário).

> **✅ Atualização 2026-06-30 (FASE 4 CONECTADA PONTA-A-PONTA):** front (Vercel) consumindo backend (Railway) com dados reais. Envs setadas na Vercel (`VITE_API_BASE_URL` + `VITE_USE_MOCK=false`), redeploy via push. Dashboard valida em produção (Playwright): 5 KPIs + KPI-07B renderizando com breakdown real. **Bug de contrato corrigido:** o front (Zod) exige `breakdown.media >= 0`, mas KPI-03/05/07/07b somavam durações sem guard e geravam médias negativas (timestamps invertidos) — o mock escondia. Adicionado guard de não-negatividade (igual ao KPI-01) nos 4 SQLs; verificado 0 negativos na base. **Redeploy do backend = `railway up --no-gitignore` (se der timeout de rede no CLI, o build geralmente já foi disparado — confira com `railway status`).**

> **🚀 Atualização 2026-06-30 (BACKEND NO AR):** deploy do backend concluído no Railway via `railway up --no-gitignore`. **URL: `https://pija-backend-production.up.railway.app`** — `/health` OK, `/api/v1/eventos` retorna 2.264.504 eventos, CORS liberado pra `pija-alpha.vercel.app`. **Como o `.db` chegou lá:** o `railway up` tem teto de upload (rejeitou o `.db` cheio: 247 MB comprimido → 413). Solução: subir um **`pija_demo.db` enxuto** — mesmas 2.26M linhas, **sem os 11 índices secundários** (1.5 GB → 539 MB → **77 MB no upload**), embutido na imagem via `COPY`. Perf medida OK (KPIs sem filtro 8.3 s). O `pija_demo.db` é gerado local por `scratchpad/db_slim.py` e fica gitignored. **Falta só:** setar `VITE_API_BASE_URL` + `VITE_USE_MOCK=false` na Vercel e redeployar o front. ⚠️ Deploy do backend é sempre `railway up --no-gitignore` desta máquina (o `.db` não está no Git).

> **🟢 Atualização 2026-06-29 (criticais de código aplicados):** os footguns de path foram resolvidos **na imagem** (não precisam mais de env manual): `SQLITE_PATH=/data/pija.db` no `Dockerfile`, `CSV_DIR=/seed-csv` + `SQLITE_PATH=/data/pija.db` no `Dockerfile.seed`, ambos com `VOLUME /data`. Adicionado `CORS_ORIGINS_REGEX` (opcional) p/ previews da Vercel. **105/105 testes verdes** + **smoke test contra a base real**: `GET /api/v1/eventos` → 200 (total **2.264.504** eventos), `GET /api/v1/kpis/tempos-medios` → 200, CORS exato e por regex confirmados. **Resta o que só você faz no painel** (envs no Railway/Vercel, volume, popular o `.db`) — ver §6.

---

## 1. Arquitetura de deploy alvo

```
┌─────────────────────────┐         HTTPS          ┌──────────────────────────────┐
│  Frontend (Vercel)      │  ───────────────────►  │  Backend FastAPI (Railway)   │
│  pija-alpha.vercel.app   │   GET /api/v1/...      │  uvicorn :$PORT  ·  /health   │
│  VITE_API_BASE_URL ──────┼──► aponta p/ Railway   │  CORS_ORIGINS allowlist       │
│  VITE_USE_MOCK=false     │                        │  lê SQLite em /data/pija.db   │
└─────────────────────────┘                        └───────────────┬──────────────┘
                                                                    │ mesmo volume /data
                                                    ┌───────────────┴──────────────┐
                                                    │  Seed job (Dockerfile.seed)   │
                                                    │  lê /seed-csv → escreve /data │
                                                    │  python -m pija.etl.runner     │
                                                    └──────────────────────────────┘
```

O backend é **read-only** sobre um SQLite pré-populado pelo ETL. O grande problema de infra é **como o `pija.db` chega ao volume que o app lê**, já que os CSVs (685 MB) são gitignored.

---

## 2. Pendências CRÍTICAS de infra (bloqueiam o backend de subir/funcionar)

Estas foram confirmadas lendo o código — não são suposições.

### 2.1 `JWT_SECRET` é obrigatório no boot
[`settings.py`](../../../backend/src/pija/settings.py) define `jwt_secret: str = Field(..., min_length=32)` e [`main.py`](../../../backend/src/pija/main.py) instancia `Settings()` no import. **Sem `JWT_SECRET` (≥32 chars) o backend nem inicia** (ValidationError), mesmo que auth (Fase 3) ainda não seja usado.
- **Ação:** setar `JWT_SECRET` no Railway com uma string ≥32 chars (ex.: `openssl rand -hex 32`).

### 2.2 `SQLITE_PATH` aponta para um caminho que não existe no container — ✅ resolvido na imagem
Default do código: `sqlite_path = "./backend/data/pija.db"`, inexistente no container.
- **✅ Feito:** [`Dockerfile`](../../../backend/Dockerfile) agora tem `ENV SQLITE_PATH=/data/pija.db` + `VOLUME /data`.
- **Resta (painel):** anexar um **volume persistente em `/data`** ao serviço do app no Railway.

### 2.3 Seed (ETL) precisa apontar para os mesmos caminhos — ✅ resolvido na imagem
O runner usa `settings.csv_dir` (default `./CSV-aghu`) e `settings.sqlite_path` (default `./backend/data/pija.db`).
- **✅ Feito:** [`Dockerfile.seed`](../../../backend/Dockerfile.seed) agora tem `ENV CSV_DIR=/seed-csv` + `ENV SQLITE_PATH=/data/pija.db` + `VOLUME /data`. Nenhuma env manual necessária.

### 2.4 Os CSVs (685 MB) precisam chegar ao build/seed
`backend/seed-csv/` está **vazio/gitignored**. O `Dockerfile.seed` faz `COPY seed-csv/ /seed-csv/` — então a imagem de seed só funciona se os CSVs estiverem lá **no momento do build local**.
- **Ação (decisão, ver §4):** definir como os CSVs chegam — build local da imagem seed + `railway up`, ou upload manual ao volume, ou outra via.

---

## 3. Pendências de INTEGRAÇÃO (front ↔ back)

### 3.1 CORS: liberar a origem do front
[`main.py`](../../../backend/src/pija/main.py) adiciona o middleware se `CORS_ORIGINS` (lista exata) **ou** `CORS_ORIGINS_REGEX` estiver setado.
- **Ação:** setar no Railway `CORS_ORIGINS=https://pija-alpha.vercel.app` (+ domínio custom quando houver, separados por vírgula).
- **✅ Previews resolvidos por código:** agora existe `CORS_ORIGINS_REGEX` (opcional). Para liberar previews da Vercel, setar `CORS_ORIGINS_REGEX=https://pija-.*\.vercel\.app`. Ambos os modos testados (exato + regex).

### 3.2 Frontend: apontar para o backend real
Na Vercel (Project → Settings → Environment Variables):
- `VITE_API_BASE_URL=https://<sua-url>.up.railway.app` (sem barra final — o cliente já concatena `/api/v1`, ver [`api.ts`](../../../frontend/src/services/api.ts)).
- `VITE_USE_MOCK=false`.
- Após setar, **redeploy** (Vite injeta env em build-time; mudar a env exige rebuild).

### 3.3 Tabela de variáveis de ambiente

**Railway — serviço do app (backend):**
| Var | Valor | Obrigatória? |
|---|---|---|
| `JWT_SECRET` | string ≥32 chars (`python -c "import secrets;print(secrets.token_hex(32))"`) | **Sim** — senão não sobe (§2.1) |
| `CORS_ORIGINS` | `https://pija-alpha.vercel.app` | **Sim** — senão o front leva erro de CORS (§3.1) |
| `CORS_ORIGINS_REGEX` | `https://pija-.*\.vercel\.app` | Opcional — só se quiser previews |
| `SQLITE_PATH` | `/data/pija.db` | Não — já é default na imagem (§2.2) |
| `RESOURCE_MODE` | `csv` | Não — default |
| `PORT` | (Railway injeta) | Não |

**Railway — job de seed (Dockerfile.seed):** nenhuma env necessária — `CSV_DIR` e `SQLITE_PATH` já são default na imagem (§2.3).

**Vercel — frontend:**
| Var | Valor |
|---|---|
| `VITE_API_BASE_URL` | `https://<app>.up.railway.app` |
| `VITE_USE_MOCK` | `false` |

---

## 4. Decisões de infra em aberto (precisam de você)

1. **Compartilhamento de volume entre app e seed.** No Railway, um volume é montado por serviço — dois serviços não compartilham o mesmo volume trivialmente. Opções:
   - **(a) Recomendado p/ simplicidade:** rodar o ETL como **pre-deploy / release command** do próprio serviço do app (mesmo container, mesmo volume `/data`), em vez de um serviço separado. Exige os CSVs disponíveis no app.
   - **(b)** Serviço de seed separado + volume compartilhado (se o plano do Railway permitir) — mais complexo.
   - **(c)** Buildar o `pija.db` localmente e subir só o `.db` ao volume (sem rodar ETL no Railway) — evita mandar 685 MB de CSV pra nuvem.
2. **Entrega dos CSVs / do `.db`.** O `pija.db` **já existe localmente** (`backend/data/pija.db`, ~1.48 GB, ETL já validado). Trade-off: subir o `.db` pronto (~1.48 GB, opção **c**, evita rodar ETL na nuvem) vs subir os CSVs (~685 MB) e rodar o seed no Railway (opção **a/b**). A opção **(c)** é a mais simples e já está com o artefato pronto. Decidir.
3. **Previews da Vercel no CORS.** ✅ já não exige mudança de código — basta **setar (ou não)** `CORS_ORIGINS_REGEX` no painel. Decidir se quer previews liberados.

---

## 5. Pendências GERAIS do sistema (fora de infra — já apontadas antes)

- **Fase 3 — Autenticação/RBAC (não iniciada).** Os interceptors em [`api.ts`](../../../frontend/src/services/api.ts) são stubs (`token = null`, TODO refresh em 401). Não há `users.yml` no repo (settings aponta para `./backend/users.yml`). Double Token + login + LDAP continuam pendentes.
- **Tela Jornada (paciente_id).** O backend agora **suporta** o filtro (`eventos_filtrados.sql` tem `:paciente_id`, provider e controller wired pelo João). Falta **validar end-to-end** com `VITE_USE_MOCK=false` — hoje `getJornada` cai em mock se a flag estiver ligada.
- **Validação dos KPIs com dados reais.** O dashboard atual usa números mockados (print). Confirmar que os 5 KPIs + KPI-07B batem ao consumir o backend real sobre a base completa (~2.26M eventos; o cliente já tem timeout de 30s pensando nisso).
- **Suíte de testes do backend.** O commit do João adicionou `test_cors.py`, `test_settings.py`, `test_eventos.py`. Rodar `pytest` no backend para garantir verde antes de fechar a Fase 4.
- **Fase 5 — AGHU/Oracle.** `RESOURCE_MODE=aghu`, `aghu_dsn`, `ldap_uri` continuam fora de escopo (read-only no AGHU).

---

## 6. Ordem de execução sugerida

1. ✅ **`pija.db` já gerado localmente** (`backend/data/pija.db`, ~1.48 GB) — ETL validado, smoke test OK contra a base (2.26M eventos).
2. **Decidir §4** (subir o `.db` pronto vs rodar seed na nuvem; setar ou não `CORS_ORIGINS_REGEX`).
3. **Provisionar o backend no Railway**: criar serviço a partir do `Dockerfile`, anexar volume `/data`, setar envs da tabela (§3.3). Validar `GET /health` → 200.
4. **Popular o volume** conforme a decisão de §4. Validar `GET /api/v1/kpis/tempos-medios` retornando dados.
5. **Configurar o front na Vercel**: `VITE_API_BASE_URL` + `VITE_USE_MOCK=false` → redeploy.
6. **Validar CORS end-to-end**: abrir `pija-alpha.vercel.app`, conferir no DevTools que as chamadas `/api/v1/*` retornam 200 (sem erro de CORS) e que o dashboard mostra dados reais.
7. **Rodar `pytest`** no backend; marcar Fase 4 como concluída.

---

## 7. Como validar (smoke tests)

- `curl https://<app>.up.railway.app/health` → `{"status":"ok"}`
- `curl 'https://<app>.up.railway.app/api/v1/eventos?limit=1'` → 1 evento
- `curl -H "Origin: https://pija-alpha.vercel.app" -I https://<app>.up.railway.app/api/v1/eventos?limit=1` → header `access-control-allow-origin` presente
- Dashboard em produção com números reais (não mock) e favicon novo na aba.
