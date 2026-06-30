# Handoff — PIJA (continuar no próximo chat)

> **Data:** 2026-06-30 (noite, véspera do demo 01/07). Este chat ficou sem contexto; siga daqui.
> **Objetivo deste doc:** dar ao próximo chat tudo pra continuar **sem** o histórico desta conversa.

---

## 1. Estado atual — TUDO no ar e verificado em produção

- **Front (Vercel):** https://pija-alpha.vercel.app
- **Back (Railway):** https://pija-backend-production.up.railway.app
- **Fase 4 conectada ponta-a-ponta:** front → back → SQLite com **dados reais** (2.264.504 eventos). CORS ok.
- **6 ajustes pré-demo concluídos** (ver [2026-06-30-ajustes-pre-demo.md](2026-06-30-ajustes-pre-demo.md)):
  1. **Mediana (p50)** em todos os KPIs de tempo (era média, inflada). Perf ~6s no Railway.
  2. **INATIVOS** excluídos da analítica (KPIs + gargalos).
  3. **`ENFERMARIA -`** prefixado nas 11 "especialidades" que eram nome de andar.
  4. **Filtro em cascata** unidade → especialidade (`/dimensoes?unidade=`).
  5. **Jornada** validada com `paciente_id` exemplo.
  6. **Página `/metodologia`** com a fórmula de cada KPI.

---

## 2. Como rodar / testar / deployar (GOTCHAS — ler antes de mexer)

### Backend
- venv em `backend/venv/`. Testes: `cd backend; $env:JWT_SECRET="qualquer-coisa-min-32-chars"; .\venv\Scripts\python.exe -m pytest` (**110 testes verdes**).
- Rodar local apontando pra base real: `SQLITE_PATH=./data/pija_demo.db`.
- **Deploy backend:** `railway up --no-gitignore` na pasta `backend` (CLI do Railway já logado na máquina do usuário).
  - ⚠️ **O `railway up` quase sempre sai com "erro" (exit 1)** por timeout de rede no stream de log do CLI — **MAS o deploy sobe**. NÃO confie no exit code; **confirme pollando o endpoint ao vivo** (ex.: `curl .../api/v1/dimensoes`).
  - O endpoint de upload do Railway anda **instável** (já deu 413, timeout, 500). Se o upload falhar, **retente**.
- **Deploy front:** `git push` no `main` → Vercel auto-deploya. Envs na Vercel: `VITE_API_BASE_URL`, `VITE_USE_MOCK=false`. Pra forçar rebuild: commit vazio + push (o MCP `deploy_to_vercel` só dá instrução, não deploya).

### Banco (importante)
- O artefato deployado é **`backend/data/pija_demo.db`** (gitignored): banco **enxuto** (sem índices secundários), ~542MB, ~70MB comprimido. É **embutido na imagem** (Dockerfile `COPY data/pija_demo.db`).
- Por que sem índices: `railway up` tem **teto de upload** (rejeitou 247MB comprimido). Sem índices → 70MB → passa.
- Regenerar o banco: `scratchpad/db_slim.py` — copia `pija.db` (completo, 1.48GB), **dropa índices**, **prefixa ENFERMARIA** (`UPDATE ... WHERE especialidade GLOB '[0-9]*'`), VACUUM. (Esse script está no scratchpad da sessão; se sumir, está descrito aqui e no doc de ajustes.) Depois `railway up --no-gitignore`.
- **Mediana perf:** ~6s no Railway sem filtro (com filtro é rápido). Timeout do front subido p/ **60s**. Não precisou de índices.
- **`paciente_id` exemplo p/ Jornada (jornada completa):** **`21331343`** (e 21529797, 13961980).

### Arquitetura do backend (seguir)
`.sql → Provider → Controller → Router → Schema` + teste. KPIs: cada `kpi_XX.sql` é **produtor de linhas** `(dimensao, valor)`; o `kpis_provider.py` envelopa com window functions e calcula **mediana** breakdown + global numa passagem. **Gargalos reusa `KpisProvider.compute`** (sem SQL próprio).

---

## 3. TAREFAS A FAZER (próximo chat) — com recomendação

### Tarefa A — Drill-down do KPI: ver todos os valores, ordenar (asc/desc), filtrar, paginar
- **Pedido do usuário:** clicar num card de KPI abre a lista **completa** do breakdown (hoje o card mostra só **top 5**), com **filtro**, **ordenação crescente/decrescente** por tempo e **paginação**.
- **Gargalos já é parcialmente isso:** rankeia dimensão (unidade/especialidade) por métrica, **pior→melhor**, **top-N** (`limit`, default 10). **Falta:** toggle **asc/desc**, **paginação** (hoje só top-N), e o **drill direto do card**.
- **Recomendação (esforço baixo-médio, sem backend):** o **breakdown completo já vem** na resposta do KPI — o `KpiCard.vue` só corta em 5 no front. Então:
  - Modal/expand ao clicar no card (`KpiCard.vue` → novo `KpiDetailModal.vue`) mostrando **todo** o breakdown, com sort asc/desc + busca + paginação **client-side** (~110 linhas, leve).
  - Adicionar **toggle asc/desc** no `GargalosView.vue` (e, se quiser, paginação no lugar de top-N fixo — aí mexe no backend: `limit/offset/ordem` no gargalos).
- **Arquivos:** `frontend/src/components/kpis/KpiCard.vue`, novo modal, `frontend/src/views/GargalosView.vue`. Backend opcional (só se quiser paginação real no gargalos).

### Tarefa B — Unidade de tempo adaptativa (horas/dias/min)
- **Problema:** com mediana, vários KPIs ficam **< 1 dia** e mostram `0,1 dias` / `0 dias` (ilegível). Print do usuário reclamou disso.
- **Por que não "tudo em horas":** KPI-06 = 61,9 dias → 1486h (ilegível). KPI-07 = 3,5 dias → 84h. Não serve pra todos.
- **Recomendação:** **formatação adaptativa** por magnitude no front — `< 1h → minutos`, `< 1 dia → horas`, `senão dias`. Resolve os dois extremos.
  - Arquivo: `frontend/src/lib/format.ts` (`formatDuration`). O backend devolve `media_global` em **dias** (exceto **KPI-07B em horas**). O formatter precisa da **unidade-base** (campo `unidade_tempo` da resposta) pra converter certo.
  - Aplicar em `KpiCard.vue`, breakdowns, `RankBar.vue`, e no novo modal da Tarefa A.

---

## 4. Achados de qualidade de dado (levar pro HC, NÃO são bug)
- **`agendamento` ≈ `realização` no AGHU** → KPIs de espera (KPI-03/05/07B) ficam ~0 na mediana. O campo de agendamento parece não capturar o lead time real. **Bom gancho de discussão.**
- **KPI-01** mede o 1º evento **presente na base** (prontuários 2015–2026); pode superestimar se houve eventos antes da janela. Considerar âncora (só prontuários abertos na janela).
- **~21 "especialidades" eram nome de andar** (resolvido: prefixo `ENFERMARIA -`; padrão certo = começa com dígito, `GLOB '[0-9]*'` — NÃO usar `LIKE '%SUL%'`, pega "interconSULta").
- **Unidades `- INATIVO`** existem no dado (filtradas do dropdown e da analítica).

---

## 5. Docs de referência (no repo)
- [docs/superpowers/plans/2026-06-29-fase-4-infra-deploy.md](2026-06-29-fase-4-infra-deploy.md) — infra/deploy completo, env vars, smoke tests.
- [docs/superpowers/plans/2026-06-30-ajustes-pre-demo.md](2026-06-30-ajustes-pre-demo.md) — os 6 itens + decisões + fórmulas dos KPIs.
- `CLAUDE.md` / `SPEC.md` — convenções e contrato (SQL nativo p/ analytics, Pydantic v2, mediana p/ tempos).

---

## 6. Sugestão de ordem pro próximo chat
1. **Tarefa B** (formatação adaptativa) — rápida, melhora a leitura imediata dos KPIs com mediana.
2. **Tarefa A** (drill-down + sort/filtro/paginação) — client-side primeiro (modal no card), depois decidir se paginação real no Gargalos.
3. Validar tudo em produção (Playwright) + `railway up` confirmando pelo endpoint.
