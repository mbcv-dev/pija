# Handoff — 2026-06-26 (pós F2 backend + integração v2 + frontend no ar)

> **Para a próxima sessão Claude Code / dev:** este é o estado curado e completo do projeto. Leia este arquivo primeiro; depois os ponteiros para `CLAUDE.md`, `SPEC.md`, `docs/DADOS-ESTADO.md` e os planos em `docs/plans/`.
> **Próximo trabalho combinado: Fase 7 — repaginação completa do frontend** (ver seção "Próximo passo").

---

## TL;DR

- **Backend:** F0+F1 (scaffold+ETL) e **F2 (endpoints analíticos)** entregues. Os 3 endpoints (`/eventos`, `/kpis/tempos-medios`, `/gargalos`) funcionam sobre 2,26M eventos reais, alinhados ao contrato do frontend, com KPIs **escopados por tipo de unidade** e filtro por `grupo`. **~99 testes verdes.**
- **Frontend:** Vue 3 + Vite, **no ar em https://pija-alpha.vercel.app/** (conta Vercel matheus-vieira, modo **mock**). Ainda **não conectado** ao backend.
- **Dados:** `grupo` populado (100% das linhas com unidade); **alta médica real integrada** (export v2) → KPI-07B (alta→saída em horas) implementado.
- **Pendência principal de produto:** repaginar o front (Fase 7) e depois conectar back↔front com performance (banco intermediário / KPIs materializados).

---

## Estado por frente

### Backend (Python, `backend/`)
- **3 endpoints** (prefixo `/api/v1`): `/eventos` (paginado, filtros), `/kpis/tempos-medios`, `/gargalos`. Estrutura: `routers/*_router.py` → `controllers/*_controller.py` → `providers/*_provider.py` → `sql/`. Sessão via `Depends(get_db)`; SQL nativo carregado por `pija.db.load_sql`.
- **5+1 KPIs**, escopados por `grupo` (decisão HC):
  - KPI-01 "Prontuário → 1º evento assistencial" — escopo **Ambulatorial**
  - KPI-03 "Agendamento → realização (consulta)" — **Ambulatorial**
  - KPI-05 "Solicitação → realização (exame)" — **executores de exame** (Análises Clínicas / Diagnóstico por Imagem / Anatomia Patológica)
  - KPI-06 "Última consulta → internação" — **Internação**
  - KPI-07 "Permanência no leito" (entrada→saída, dias) — **Internação**
  - **KPI-07B "Alta médica → saída do leito" (em HORAS, meta 4h)** — **Internação**. `unidade_tempo="horas"`. Não entra no ranking de gargalos default (unidade diferente).
  - Lógica: cada KPI SQL devolve `SUM(diff)`+`COUNT` por dimensão; provider divide soma/n (global = Σsoma/Σn, exato). Escopo injetado via `{grupo_scope}` (whitelist de constantes — seguro). `group_by` = `unidade` (default) ou `especialidade`.
- **Filtros** aceitos: `unidade` (= unidade executora p/ exames), `especialidade`, `grupo`, `data_inicio`, `data_fim`, `tipo_entidade` (só /eventos), `kpi_codes`, `limit`/`offset`.
- **Contrato de resposta** = exatamente o que o front espera. Fonte: `docs/GUIA-FRONTEND.md` + schemas em `backend/src/pija/schemas/*_schema.py`.
- **Performance:** os 5 KPIs sem filtro levam ~12s sobre a base cheia (KPI-06 otimizado de 90s→0,6s via índice `ix_fato_kpi06`). Aceitável, mas é o motivo de planejar **KPIs materializados** (Fase 3).

### Frontend (`frontend/`, Vue 3 + TS + Vite + Pinia + Tailwind + Zod + Axios)
- **No ar:** https://pija-alpha.vercel.app/ — projeto Vercel `pija` na conta **matheus-vieiras-projects-203976e8** (Hobby). Auto-deploy a cada push na `main` (Git integration, Root Directory = `frontend`).
- **Modo mock:** `frontend/.env.production` tem `VITE_USE_MOCK=true` → demo funciona sem backend. `src/services/api.ts` alterna mock/real por env e centraliza todo HTTP (com `paramsSerializer` p/ arrays e timeout 30s).
- **Telas atuais:** Dashboard (KPIs), Gargalos, Eventos (tabela). Schemas Zod em `src/schemas/api.schemas.ts`, tipos em `src/types/api.types.ts`, mocks em `src/mocks/`.
- ⚠️ **Será repaginado na Fase 7** — não invista em ajustes incrementais no front atual; o design vai ser refeito.

### Dados (`CSV-aghu/`, gitignored; DB `backend/data/pija.db`, gitignored ~1.1GB)
- 2.261.659 eventos (7 tipos). `grupo` populado em 100% das linhas com unidade (Ambulatorial, Internação, 3 grupos executores de exame, Procedimental, "Serviços de Apoio" p/ os ~3,5% de apoio).
- **Alta médica real integrada** a partir de `CSV-aghu/vw_pacientes_anonimizado_v2.csv` (⚠️ nome diz "pacientes" mas **conteúdo é vw_internacoes v2** — tem `dthr_alta_medica` + `dt_saida_paciente`). Re-ETL de internações já rodou. `timestamp_alta_medica` (real) e `timestamp_alta_administrativa` (=saída) agora distintos; 17,3% têm gap > 0 (média 2,4h).

### Deploy
- Frontend: Vercel (acima). MCP da Vercel deste repo está em `.mcp.json` (gitignored), servidor `vercel-pija`, autenticado na conta matheus-vieira — **isolado deste projeto**, não afeta outras contas/MCPs.
- Backend: **ainda não hospedado.** Vercel não comporta (SQLite 1.1GB). Plano em `docs/DEPLOY.md` (recomendado Railway, ou migrar p/ Postgres/Turso).

---

## Próximo passo: Fase 7 — repaginação completa do front

Quando o usuário pedir para começar:
1. **Invocar `superpowers:brainstorming` + a skill `frontend-design`** (e `baseline-ui`) — desenhar identidade visual e telas antes de codar.
2. Telas-alvo: **Dashboard** (KPIs), **Gargalos**, e **Jornada/timeline** (evoluir a tela de Eventos de tabela plana → linha do tempo por paciente, busca por prontuário, intervalos entre etapas).
3. **Absorver os itens de UX já decididos pelo HC** (estavam diferidos para cá):
   - **KPIs sem número** — mostrar só a descrição do que cada KPI mede (esconder o valor por ora).
   - **Gargalos com filtro por métrica** (escolher qual KPI/transição; o backend já aceita `kpi_codes`).
   - **Filtros** por `grupo` e `unidade executora` na UI (backend já suporta).
   - KPI-07B aparece "dentro" do KPI-07 (alta→saída em horas, meta 4h).
4. É **front-only** sobre mocks; o backend já está pronto pra alimentar tudo. Conectar de verdade é a Fase 3/4 (depois).
5. Plano detalhado da fase em `docs/plans/2026-06-26-roadmap-pos-reuniao-hc.md` (Fase 7).

---

## Fatos e gotchas que NÃO podem ser esquecidos

- **Ambiente (Windows + Git Bash), comandos do REPO ROOT:**
  ```bash
  source backend/venv/Scripts/activate
  export JWT_SECRET="any-string-with-at-least-32-characters-yes"   # obrigatório p/ qualquer comando que toque Settings
  export PYTHONIOENCODING=utf-8                                     # console Windows quebra com acentos sem isso
  cd backend && python -m pytest -q                                # ~99 testes
  ```
- **`grupo` no DB real foi populado por backfill** (`backend/scripts/backfill_grupo.py`), não por re-ETL completo. Cargas futuras populam via `pija.unidades.get_grupo` (mappers já chamam). Se re-rodar ETL completo, o grupo sai certo.
- **Parser de data:** `parse_br_datetime` só lê formato BR (`DD/M/YYYY, HH:MM`). O export v2 usa ISO (`YYYY-MM-DD HH:MM:SS.fff`) → usar `parse_datetime` (flexível, criado na integração v2). Outros CSVs ainda são BR.
- **`unidades.py`:** `normalizar_unidade()` (remove zero-width/typo) + `get_grupo()` (mapa explícito → regras de padrão → "Serviços de Apoio"). É a fonte única da classificação.
- **Convenção do projeto (CLAUDE.md):** toda decisão/achado/replan vai para `.md` no repo ANTES de codar. Mantida ao longo de toda a F2.
- **Commits:** sem `Co-Authored-By` de modelo específico (genérico ok). 1 commit = 1 mudança lógica.
- **Não há auth ainda** (F3). Endpoints abertos; front tem interceptor pronto p/ token.

---

## Pendências

### Para levar ao HC
1. **Cancelamentos de consultas** — confirmar o campo de estado (a amostra de `Situação da Consulta` só trouxe "MARCADA"); exames (`CANCELADO`) e cirurgias (`cancelada=1`/`CANC`) já confirmados.
2. **Validar o bucket "Serviços de Apoio"** (~20 unidades: fisioterapia, nutrição, hospital-dia, urgência…) — classificação por validar.
3. Renomear `vw_pacientes_anonimizado_v2.csv` → `vw_internacoes_anonimizado_v2.csv` no time (nome confuso).
4. Unidades "INATIVO" (ex.: "UTI COVID … INATIVO") aparecem em alguns KPIs — decidir se filtra.

### Técnicas (próximas fases)
- **Fase 5 — indicadores operacionais** (contagens/%): prontuários/dia, exames por grupo/unidade, internações por especialidade/UTI, cirurgias/partos, % consultas por tipo, tempo entre consultas, **cancelamentos**. Viabilidades já levantadas no roadmap §B.
- **Fase 3/4 — performance + conexão:** materializar KPIs/gargalos em tabelas-resumo no job de carga; hospedar backend (Railway) + CORS + `VITE_USE_MOCK=false`/`VITE_API_BASE_URL` no Vercel.
- **Tempo até o laudo** (exame): `data_hora_liberacao` só ~38% preenchida — indicador parcial.

---

## Git

- **Branch:** `main` | **HEAD:** `88e57b4` | working tree limpo | origin sincronizado (https://github.com/mbcv-dev/pija.git).
- Marcos recentes: `4f01c90` (merge F2 scoping), `88e57b4` (merge integração v2 + KPI-07B).
- Fluxo usado: branch por feature multi-task → merge `--no-ff` na main → push. (Frontend e correções menores foram direto na main em sessões anteriores, a pedido.)

---

## Docs canônicos
- `CLAUDE.md` — convenções + stack + "tudo em MD"
- Este arquivo — estado atual
- `SPEC.md` — contrato SDD
- `docs/DADOS-ESTADO.md` — verdade sobre os dados (§7 = decisões das reuniões HC; spike v2)
- `docs/GUIA-FRONTEND.md` — contrato dos endpoints p/ o front
- `docs/DEPLOY.md` — deploy (front no ar + plano do backend)
- `docs/plans/2026-06-26-roadmap-pos-reuniao-hc.md` — roadmap faseado (Fase 7 = front)
- `docs/plans/2026-06-26-fase-2-kpi-scoping.md` — plano da F2 (executado)
- `docs/_archive-hc-template/` — **NÃO MODIFICAR**

*Handoff gerado em 2026-06-26 após F2 (escopo de KPIs), integração do export v2 (alta médica real + KPI-07B) e frontend publicado na Vercel.*
