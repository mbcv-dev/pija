# Fase 4 — Conectar front ↔ backend real (hospedar + CORS + cutover)

> Spec de design da fase de conexão. Brainstorming concluído em 2026-06-26.
> Convenção do projeto: decisão registrada em MD antes de codar (CLAUDE.md).
> Documentos relacionados: `docs/DEPLOY.md`, `docs/HANDOFF.md`, `docs/GUIA-FRONTEND.md`, `SPEC.md`, `docs/plans/2026-06-26-roadmap-pos-reuniao-hc.md` (Fases 3/4).
> **Esta fase é um handoff para outro dev.** Escrita para quem tem zero contexto do repositório.

---

## 1. Objetivo e resultado

Fazer a demo em **https://pija-alpha.vercel.app/** parar de usar mocks e passar a ler **dados reais** do backend FastAPI, hospedado num host com disco persistente.

**Resultado observável:** Dashboard e Gargalos exibindo KPIs/rankings calculados sobre os ~2,26M eventos reais; `https://<backend>/docs` acessível; o front aponta para o backend via env, sem mudança de código no front.

## 2. Escopo

**Dentro:**
- Hospedar o backend no **Railway** mantendo **SQLite** (Opção A do `docs/DEPLOY.md`), com **volume persistente**.
- Gerar o banco `pija.db` **no host** rodando o **ETL existente** uma vez (CSVs colocados no volume).
- Adicionar **CORS** ao FastAPI, travado na origem do front Vercel; API permanece **read-only**.
- **Cutover** do front: trocar `VITE_USE_MOCK=false` + `VITE_API_BASE_URL` no Vercel e redeploy.

**Fora (registrado para fases futuras):**
- Materialização/performance dos KPIs (Fase 3) — aceitam-se os ~12s nos KPIs sem filtro por ora.
- Autenticação/login + RBAC (Fase 3).
- Filtro `paciente_id` no `/eventos` para a **Jornada** sair do mock (Fase 4+; a Jornada **continua em mock** após esta fase).
- Migração para Turso/Postgres (Opção B do `DEPLOY.md`).

## 3. Restrições inegociáveis (do projeto)

- **Stack travada:** Python 3.11+, FastAPI, SQLAlchemy 2.0 async + aiosqlite. SQLite local (nunca Postgres local). Adapter `Resource` plugável já existente.
- **API read-only:** nenhuma escrita no AGHU; nenhum endpoint que grave dados.
- **Sem dados pessoais:** a base só tem `paciente_id` (= nº do prontuário). Nada muda aqui, mas a API pública não pode passar a expor outra coisa.
- **Segredos só via env** (`.env`/secrets do host), nunca no código.
- **Convenção "tudo em MD":** qualquer decisão/achado novo durante a execução vai para `.md` no repo antes de codar.

## 4. Divisão de responsabilidades (handoff)

- **Dev (executor):** mudanças de código no backend (CORS, empacotamento), provisionar Railway, carga inicial do banco, validar a API pública + CORS. **Entrega:** URL pública do backend + confirmação de que `/health` e `/api/v1/kpis/tempos-medios` respondem e que o CORS aceita a origem Vercel.
- **Dono da conta (você):** passo final no Vercel — `VITE_USE_MOCK=false` + `VITE_API_BASE_URL=<url do dev>` → redeploy. (O projeto Vercel é `pija`, conta `matheus-vieiras-projects-203976e8`, Root Directory `frontend`.)

## 5. Estado atual do backend (pontos de toque)

- `backend/src/pija/main.py` — app FastAPI; **não há CORS**; já existe `GET /health` → `{"status":"ok"}` (servirá de healthcheck do Railway); routers sob `/api/v1`; `lifespan` abre o engine a partir de `settings.sqlite_path`.
- `backend/src/pija/settings.py` — Pydantic Settings: `sqlite_path` (default `./backend/data/pija.db`), `csv_dir` (default `./CSV-aghu`), **`jwt_secret` é obrigatório** (`min_length=32`) mesmo sem auth — precisa estar no ambiente do host senão a app não sobe. `resource_mode` default `csv`.
- `backend/src/pija/etl/runner.py` — ETL: `python -m pija.etl.runner` processa as 5 views (idempotente, upsert por `evento_id`). `--sample N` limita linhas (para smoke test). Lê via `Resource` (CSV) de `csv_dir`, escreve em `sqlite_path`.
- `backend/pyproject.toml` — dependências do backend (fonte para o `pip install` no Dockerfile). **Não há** Dockerfile, requirements.txt nem config de Railway ainda — esta fase os cria.

## 6. Arquitetura de deploy

```
[Vercel: front Vue]  --HTTPS-->  [Railway: FastAPI/uvicorn]  --lê-->  [Volume /data: pija.db]
   VITE_API_BASE_URL                CORS trava origem               (gerado pelo ETL no host)
```

- **Railway service** a partir do repo, **Root Directory `backend`**, build por **Dockerfile**.
- **Volume persistente** montado em `/data`. Convenção: `SQLITE_PATH=/data/pija.db`, CSVs em `/data/csv/`.
- **Start:** `uvicorn pija.main:app --host 0.0.0.0 --port $PORT` (Railway injeta `$PORT`).
- **Healthcheck:** `/health`.
- **Env vars no host:** `JWT_SECRET` (string ≥32 chars), `SQLITE_PATH=/data/pija.db`, `CSV_DIR=/data/csv` (usado só na carga), `CORS_ORIGINS=https://pija-alpha.vercel.app`, `RESOURCE_MODE=csv`.

## 7. Mudanças de código no backend

1. **`Settings` (`settings.py`):** novo campo `cors_origins: str = ""` (lista separada por vírgula, lida de `CORS_ORIGINS`). Helper para split em lista (ignorando vazios).
2. **CORS (`main.py`):** adicionar `from fastapi.middleware.cors import CORSMiddleware` e `app.add_middleware(CORSMiddleware, allow_origins=<lista de cors_origins>, allow_methods=["GET","OPTIONS"], allow_headers=["*"], allow_credentials=False)`. Em dev (lista vazia) o comportamento atual não muda.
3. **Empacotamento:**
   - `backend/Dockerfile` — base `python:3.11-slim`; instala dependências do `pyproject.toml`; copia `src/`; expõe a app; `CMD` com `uvicorn ... --port $PORT`. Não copiar `data/`, `venv/`, CSVs.
   - `backend/.dockerignore` — `data/`, `venv/`, `__pycache__/`, `*.db`, CSVs, `.env`.
   - `backend/railway.json` (ou `.toml`) — builder Dockerfile, `healthcheckPath=/health`, política de restart.
4. **Teste:** um teste rápido garantindo que, com `CORS_ORIGINS` setado, a resposta a um `OPTIONS`/`GET` traz o header `access-control-allow-origin` correto; e que, vazio, nada quebra. (pytest + httpx, como o resto do backend.)

> **YAGNI:** não adicionar rate-limit, gzip, nem logging estruturado nesta fase — fora do escopo.

## 8. Carga inicial do banco (one-time, no host)

1. Subir os **CSVs do HC** para `/data/csv/` no volume (via Railway CLI/SFTP/job — o método exato fica no plano). **Atenção:** os CSVs (~685 MB) **não estão no repo** (gitignored); o dev precisa obtê-los com o time (origem: WhatsApp do Daniel Turmina, HC-UFPE).
2. **Conjunto de CSVs necessário** (5 + o export v2): `vw_pacientes`, `vw_consultas`, `vw_exames`, `vw_internacoes`, `vw_cirurgias` **e** `vw_pacientes_anonimizado_v2.csv` (⚠️ nome diz "pacientes" mas o **conteúdo é vw_internacoes v2** — traz `dthr_alta_medica` + `dt_saida_paciente`, necessários para o **KPI-07B** alta médica → saída). Confirmar com `docs/DADOS-ESTADO.md` qual arquivo o mapper de internação consome.
3. Rodar o ETL uma vez: `python -m pija.etl.runner` (com `CSV_DIR=/data/csv`, `SQLITE_PATH=/data/pija.db`). Gera `pija.db` no volume.
4. **`grupo` sai correto automaticamente:** os mappers já chamam `pija.unidades.get_grupo`, então um ETL completo no host popula `grupo` em 100% das linhas com unidade — **não** é preciso rodar o `backfill_grupo.py` (esse script foi só para o DB local que carregou antes da coluna existir).
5. Validar a contagem (esperado ~2,26M eventos; conferir `etl_log`).

> O `.db` fica no volume; **deploys seguintes não re-rodam o ETL** (só rebuild da imagem). Re-carga só quando os dados mudarem.

## 9. Cutover do front (dono da conta)

1. Dev confirma: `GET https://<backend>/health` → 200, `GET /api/v1/kpis/tempos-medios` → 5 KPIs reais, CORS aceitando `pija-alpha.vercel.app`.
2. No projeto Vercel `pija`: setar env de produção `VITE_USE_MOCK=false` e `VITE_API_BASE_URL=https://<backend>` → **redeploy**.
3. Nenhuma mudança de código no front (o `src/services/api.ts` já alterna mock/real por env).

## 10. Verificação (gate de "pronto")

- Backend: `/health` 200; `/docs` abre; os 3 endpoints (`/eventos`, `/kpis/tempos-medios`, `/gargalos`) retornam dados reais; `etl_log` mostra a carga das 5 views.
- CORS: request com `Origin: https://pija-alpha.vercel.app` recebe `access-control-allow-origin`; origem aleatória **não**.
- Testes do backend continuam verdes (`cd backend && python -m pytest -q`, ~99 testes) com `JWT_SECRET` e `PYTHONIOENCODING=utf-8` no ambiente.
- Pós-cutover: Dashboard e Gargalos no site público carregam dados reais; **Jornada permanece em mock** (esperado — depende de `paciente_id`, fase futura).

## 11. Rollback

- Reverter `VITE_USE_MOCK=true` no Vercel + redeploy → a demo volta ao mock na hora, independente do backend.
- O backend pode ficar fora do ar sem quebrar a demo enquanto o front estiver em mock.

## 12. Critérios de sucesso

- Backend FastAPI no ar no Railway, lendo `pija.db` (~2,26M eventos) de volume persistente, com `/health` verde.
- CORS travado na origem do front; API read-only; segredos só em env.
- Após o passo do dono no Vercel, Dashboard e Gargalos do site público exibem dados reais; rollback documentado e testado.
- Decisões/achados da execução registrados em MD (atualizar `docs/DEPLOY.md` e `docs/HANDOFF.md` ao final).

## 13. Riscos e mitigação

- **CSVs indisponíveis ao dev** → bloqueia a carga. Mitigar cedo: confirmar com o time o acesso aos 6 arquivos (5 + v2) antes de começar.
- **ETL longo no host** (685 MB, streaming chunked) → rodar como job/one-off com timeout adequado; validar com `--sample` antes da carga cheia.
- **Custo do volume** (≥1,1 GB) no Railway → conferir limites do plano hobby; documentar o custo observado.
- **~12s nos KPIs sem filtro** → aceito nesta fase; se o uso na demo incomodar, a Fase 3 (materialização) resolve. Não otimizar aqui.
- **`JWT_SECRET` ausente** no host → a app não sobe (Settings exige). Garantir o secret no provisionamento.
