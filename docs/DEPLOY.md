# Deploy do PIJA

> Estado: **frontend** indo para a Vercel (conta `matheus-vieiras-projects-203976e8`, demo com mocks). **Backend** ainda não hospedado — este documento registra as opções e a decisão pendente.

---

## 1. Frontend — Vercel (em andamento)

- **App:** `frontend/` (Vue 3 + Vite SPA).
- **Build:** `npm run build` → `dist/` (preset Vite, auto-detectado pela Vercel).
- **Root Directory** no projeto Vercel: `frontend`.
- **SPA routing:** `frontend/vercel.json` reescreve todas as rotas para `/index.html` (necessário p/ o `vue-router` em history mode).
- **Modo demo:** `frontend/.env.production` define `VITE_USE_MOCK=true` → o build usa os mocks (`src/mocks/`), **sem depender do backend**. É um demo navegável e funcional.
- **Conta:** isolada via `.mcp.json` (MCP da Vercel com escopo só deste repo, autenticado na conta matheus-vieira). Não afeta o MCP global usado em outros projetos. O `.mcp.json` está no `.gitignore` (config local da máquina).

Quando o backend estiver no ar, basta, no projeto Vercel:
1. Trocar `VITE_USE_MOCK` para `false` (env var de produção).
2. Definir `VITE_API_BASE_URL` com a URL pública do backend.
3. Redeploy. Nenhuma mudança de código no front é necessária (o `api.ts` já alterna mock/real por env).

---

## 2. Backend — por que NÃO na Vercel

O backend é FastAPI + SQLAlchemy async sobre um **SQLite de ~1,1 GB** (2,26M eventos), alimentado por um ETL de 685 MB de CSV.

Incompatível com serverless da Vercel:
- Funções são **efêmeras** e com filesystem **read-only** (exceto `/tmp`, que não persiste entre invocações).
- Limite de tamanho do bundle (~250 MB descomprimido) « 1,1 GB do banco.
- Sem disco persistente para o `.db` nem para rodar o ETL.

Ou seja: o backend precisa de **disco persistente** ou de um **banco gerenciado**.

---

## 3. Opções para hospedar o backend (decisão pendente)

### Opção A — Host com disco persistente (menor esforço)
Subir o backend como container/processo num PaaS com volume persistente, mantendo o SQLite atual.

| Host | Prós | Contras |
|---|---|---|
| **Railway** | Deploy simples por git, volume persistente, bom free/hobby | Volume tem custo conforme tamanho |
| **Fly.io** | Volumes persistentes, regiões, bom p/ Docker | Curva de Docker/flyctl |
| **Render** | Web service + disco persistente, fácil | Disco persistente é plano pago |

- **Esforço:** baixo — empacotar o backend (Dockerfile), subir o `.db` (ou rodar o ETL no host uma vez), expor a API.
- **Atenção:** o `.db` de 1,1 GB precisa chegar ao host (upload do volume ou rodar o ETL lá a partir dos CSVs). SQLite com 1 só writer é ok aqui (carga é read-mostly).

### Opção B — Migrar o SQLite para banco gerenciado (mais robusto, mais trabalho)
Trocar o SQLite por um Postgres/Turso gerenciado; aí o backend pode rodar até em serverless.

| Banco | Observação |
|---|---|
| **Turso** (libSQL) | É "SQLite na nuvem" — migração mais suave; o SQL nativo atual (`julianday`, etc.) tende a funcionar |
| **Postgres** (Neon/Supabase/Vercel Postgres) | Mais padrão de mercado, mas exige adaptar o SQL (`julianday` → `EXTRACT/EPOCH`, etc.) e reescrever a carga do ETL |

- **Esforço:** médio/alto — adaptar `Resource`/queries e re-rodar o ETL para o banco novo.
- **Ganho:** backend cabe em serverless (inclusive funções Python na Vercel), escala melhor, alinhado ao futuro (Fase 5 já prevê adapter plugável CSV↔AGHU).

### Recomendação
Para colocar o backend no ar **rápido** e manter o que já funciona: **Opção A com Railway** (ou Fly). Deixar a Opção B (Turso/Postgres) para quando fizer sentido escalar — encaixa bem no adapter `Resource` plugável que o projeto já tem.

---

## 4. Pendências ao conectar front ↔ back (qualquer host)

- **CORS:** habilitar `CORSMiddleware` no FastAPI permitindo a origem do frontend Vercel (`https://<projeto>.vercel.app` e domínio custom, se houver). Hoje não há CORS configurado.
- **Performance:** os 5 KPIs sem filtro levam ~12s na base cheia (KPI-06 já otimizado de 90s→0,6s via índice). Em produção, considerar cache de resposta ou pré-cálculo se o uso for intenso.
- **JWT_SECRET:** o backend exige `JWT_SECRET` no ambiente — definir como secret no host.
- **Auth (F3):** ainda não implementada; o front já tem o interceptor pronto para o token.

---

## 5. Próximos passos sugeridos
1. ✅ Frontend demo na Vercel (mocks).
2. Escolher host do backend (recomendo Railway) e empacotar (Dockerfile + estratégia do `.db`).
3. Configurar CORS no backend.
4. No Vercel: `VITE_USE_MOCK=false` + `VITE_API_BASE_URL`, redeploy.
