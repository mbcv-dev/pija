# PLANO.md — Plano de Implementação do MVP

**Projeto:** PIJA — Plataforma Integrada da Jornada Assistencial
**Última atualização:** 2026-05-28

Este documento detalha as fases, tasks, gates e **skills Claude Code** recomendadas para a implementação do MVP. Complementa o [SPEC.md](../SPEC.md), que mantém os guardrails e o task breakdown autoritativo.

---

## 0. Premissas e estratégias-chave

| Premissa | Estratégia adotada |
|---|---|
| Acesso ao AGHU está bloqueado até liberação de VPN | **CSV-first**: ETL trabalha com CSVs exportados pelo HC; AGHU entra na Fase 5 |
| CSVs do HC são "extremamente grandes" | **Streaming chunked** desde o dia 1 (`pandas.read_csv(chunksize=50_000)`) + upsert batched |
| Framework auth do HC ainda não foi entregue | **Auth interim**: `users.yml` + PyJWT com **contrato idêntico** ao Double Token oficial. Swap por LDAP só altera implementação, não consumidores. |
| Escopo enxuto pedido pelo HC e pela equipe | Apenas RF001, RF002 (5 KPIs), RF003 no MVP. Outras RFs ficam no backlog. |

### Adapter `Resource` — princípio de design

```python
# resources/base_resource.py
class BaseResource(Protocol):
    def iter_rows(self, view: str, *, sample: int | None = None) -> Iterator[dict]: ...
    def count(self, view: str) -> int: ...
```

- **MVP**: `CsvResource` lê arquivos de `CSV_DIR/<view>.csv`
- **Fase 5**: `AghuResource` abre cursor Oracle contra `vw_<view>`
- `resource_factory.get_resource()` retorna a impl correta via env `RESOURCE_MODE`
- Providers, controllers, routers e o `etl_runner` **não sabem** qual adapter está ativo

---

## 1. Visão geral das fases

| Fase | Saída | Duração estimada |
|---|---|---|
| **F0 — Scaffold** | Monorepo bootável, `/health` ponta-a-ponta, CI mínima | 1–2 dias |
| **F1 — ETL CSV → SQLite** | `etl_runner --sample 1000` funcional, idempotente, logs em `etl_log` | 3–5 dias |
| **F2 — 3 endpoints essenciais** | `/eventos`, `/kpis/tempos-medios`, `/gargalos` testados contra fixture | 3–5 dias |
| **F3 — Auth interim** | Login → JWT → refresh silencioso → audit log | 1–2 dias |
| **F4 — Frontend (2 telas)** | LoginView + DashboardView + GargaloView | 4–6 dias |
| **F5 — Cutover HC** (gated) | Swap CSV→AGHU + LDAP; deploy ambiente HC | 2–3 dias após liberação VPN |

**Total MVP:** ~3 semanas (F0–F4). F5 fica gated pela liberação externa.

---

## 2. Skills Claude Code — uso geral

Todas as skills citadas já estão disponíveis no ambiente — nada para instalar via CLI.

### Skills cross-cutting (usar em todas as fases)

| Skill | Quando invocar |
|---|---|
| `superpowers:using-superpowers` | Início de toda conversa |
| `superpowers:brainstorming` | Antes de qualquer nova feature ou decisão de design |
| `superpowers:writing-plans` | Antes de iniciar uma fase (transforma esta lista de tasks em plano executor-ready) |
| `superpowers:executing-plans` | Durante a execução de uma fase |
| `superpowers:verification-before-completion` | Antes de marcar qualquer task como done |
| `superpowers:requesting-code-review` | Antes de abrir PR |
| `commit-commands:commit` ou `commit-commands:commit-push-pr` | Ao final de cada task com mudanças |
| `init` | Logo após a F0 (popula `CLAUDE.md` com convenções estabilizadas) |

### Princípio

> **Sempre invocar skill antes de agir.** Mesmo 1% de chance de aplicar, vale invocar.

---

## 3. Fase 0 — Scaffold (1–2 dias)

**Objetivo:** repo bootável com backend FastAPI e frontend Vue rodando localmente; CI mínima; CLAUDE.md inicial.

### Tasks

| ID | Descrição | Saída concreta |
|---|---|---|
| T0-1 | Consolidação do repo (**✓ já feito**) | Time 2 promovido à raiz; templates HC em `docs/_archive-hc-template/` |
| T0-2 | Backend skeleton | `backend/pyproject.toml`, `backend/main.py` (FastAPI + `/health`), pastas conforme `06-arquitetura.md §5` |
| T0-3 | Frontend skeleton | `frontend/package.json`, Vite + Vue 3 + TS + Tailwind + Pinia + Axios + Zod + Vee-Validate, página `/health` consumindo backend |
| T0-4 | `.env.example` e `Settings` Pydantic | Vars: `RESOURCE_MODE`, `SQLITE_PATH`, `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `CSV_DIR`, `AGHU_DSN`, `LDAP_URI`, `USERS_YML_PATH` |
| T0-5 | Estrutura de testes + CI mínima | `pytest` + `vitest` configurados; workflow GitHub Actions: install + lint + test em PR |

### Skills recomendadas

| Skill | Por quê |
|---|---|
| `superpowers:writing-plans` | Transformar T0-2..T0-5 em plano executor-ready |
| `frontend-design:frontend-design` | Scaffold do Vue com layout distintivo e baseline UI |
| `baseline-ui` | Garantir baseline sem slop visual no scaffold |
| `commit-commands:commit-push-pr` | Abrir PR com scaffold completo |
| `init` | Popular `CLAUDE.md` após scaffold estabilizar |
| `fewer-permission-prompts` | Reduzir prompts de permissão repetitivos durante setup |

### Gate de saída

- [ ] `uvicorn main:app --reload` sobe e responde `GET /health` com `200`
- [ ] `npm run dev` sobe Vite e a página `/health` exibe resposta do backend
- [ ] `pytest` e `vitest` rodam sem erros em CI
- [ ] `CLAUDE.md` criado com convenções (estrutura de pastas, fluxo obrigatório, modo `RESOURCE_MODE`)

---

## 4. Fase 1 — ETL CSV → SQLite (3–5 dias)

**Objetivo:** ler CSVs grandes em streaming e carregar no SQLite local de forma idempotente, com log estruturado.

### Tasks

| ID | Descrição | Saída concreta |
|---|---|---|
| T1-1 | Schema Alembic | Tabelas: `fato_eventos_jornada`, `dim_unidade`, `dim_especialidade`, `etl_log`, `audit_log`, `users`. Migration aplicada. |
| T1-2 | `BaseResource` + `CsvResource` | Protocol em `resources/base_resource.py`; impl com `pandas.read_csv(chunksize=...)`, suporte a `sample` |
| T1-3 | `AghuResource` stub | Mesma interface, levanta `NotImplementedError("Disponível na Fase 5")` |
| T1-4 | `resource_factory` + DI | `Depends(get_resource)` seleciona por `RESOURCE_MODE`; testes confirmam ambos os modos |
| T1-5 | `etl_runner.py` | CLI: `python -m etl.etl_runner [--sample N] [--view VIEW]`; itera 7 entidades; normaliza; upsert batched por `(entidade_id, tipo_entidade)`; popula `etl_log` |
| T1-6 | 7 `.sql` de extração | `backend/sql/extract/{prontuarios,consultas,exames,internacoes,cirurgias,procedimentos,altas}.sql` — projetam colunas conforme `04-modelo-dados.md §2` |
| T1-7 | Testes ETL | Sample CSV em `tests/fixtures/`; valida volumes, idempotência (rerun não duplica), soft-fail em linha inválida |

### Skills recomendadas

| Skill | Por quê |
|---|---|
| `superpowers:writing-plans` | Plano executor-ready para T1-1..T1-7 |
| `superpowers:test-driven-development` | ETL precisa ser determinístico; escrever testes antes |
| `pr-review-toolkit:silent-failure-hunter` | Try/except no ETL é tentação — esta skill caça `except Exception: pass` e log silencioso |
| `superpowers:verification-before-completion` | Antes de marcar T1-5 done, comparar `etl_log.rows_loaded` com `wc -l` do CSV |
| `feature-dev:code-architect` | Para o desenho do Resource adapter (Protocol + Factory + DI) |
| `commit-commands:commit-push-pr` | PR por task ou agrupada por marco |

### Gate de saída

- [ ] `etl_runner --sample 1000` carrega CSV sample para SQLite sem erros
- [ ] Rerun do ETL **não duplica** registros (idempotência)
- [ ] Linha inválida no CSV não trava o pipeline — registrada em `etl_log.rows_rejected`
- [ ] `etl_log` populado com `started_at`, `finished_at`, `view_name`, `rows_read`, `rows_loaded`, `rows_rejected`, `errors`
- [ ] Cobertura de testes ≥ 80% nas funções de ETL

---

## 5. Fase 2 — 3 Endpoints essenciais (3–5 dias)

**Objetivo:** entregar os endpoints analíticos do MVP com KPIs determinísticos validados contra fixture.

### Tasks

| ID | Descrição | Saída concreta |
|---|---|---|
| T2-1 | `GET /api/v1/eventos` (RF001 / UC001) | Router + Pydantic schema + provider + `sql/eventos_filtrados.sql`. Filtros: `unidade`, `especialidade`, `tipo_entidade`, `data_inicio`, `data_fim`, `limit`, `offset`. |
| T2-2 | `GET /api/v1/kpis/tempos-medios` (RF002 subset) | Controller + 5 `.sql` em `sql/kpis/` (KPI-01, KPI-03, KPI-05, KPI-06, KPI-07). Param `kpi_codes[]` filtra quais retornar. |
| T2-3 | `GET /api/v1/gargalos` (RF003 / UC003) | Controller + `sql/gargalos.sql` ordenando por `AVG(tempo_espera) DESC`; filtros idênticos a `/eventos` |
| T2-4 | Fixture SQLite determinística | `tests/fixtures/fixture.sqlite` com 12 prontuários e ~50 eventos; valores de KPI calculados na mão e documentados em `tests/fixtures/EXPECTED.md` |
| T2-5 | Testes contra fixture | Tolerância 0% em cada KPI; ranking de gargalos batendo com `EXPECTED.md` |

### Skills recomendadas

| Skill | Por quê |
|---|---|
| `superpowers:test-driven-development` | KPIs **devem** ser testados antes contra fixture (spec exige tolerância 0%) |
| `superpowers:verification-before-completion` | Gate por KPI: validar valor calculado vs. manual antes de fechar |
| `pr-review-toolkit:code-reviewer` | Antes de PR, revisar SQL contra padrões do projeto |
| `pr-review-toolkit:type-design-analyzer` | Para os Pydantic schemas de request/response |
| `superpowers:brainstorming` | Decidir formato exato do JSON `KpiResponse` e estrutura de drill-down futuro |

### Gate de saída

- [ ] Todos os 5 KPIs MVP retornam valor numérico para a fixture com tolerância 0%
- [ ] Ranking de gargalos retorna ordenação idêntica à `EXPECTED.md`
- [ ] `/eventos` com cada combinação de filtro retorna apenas eventos do recorte
- [ ] Schemas Pydantic v2 cobrem `400 Bad Request` para parâmetros inválidos
- [ ] Cobertura de testes ≥ 80% nos controllers e providers

---

## 6. Fase 3 — Auth Interim (1–2 dias)

**Objetivo:** Double Token funcional usando `users.yml`, com contrato idêntico ao da Fase 5 (LDAP). Audit log ativo.

### Tasks

| ID | Descrição | Saída concreta |
|---|---|---|
| T3-1 | `auth/local_auth.py` | Lê `users.yml` (3 perfis: `gestor`, `assistencial`, `etl`); hash bcrypt; `login(username, password) → User` |
| T3-2 | `auth/jwt_service.py` | PyJWT: emite access token (curto, 15 min) e refresh token (longo, 7 dias) em HttpOnly cookie |
| T3-3 | `auth/dependencies.py` | `get_current_user()` e `require_role(role)` via `Depends()` — mesmo contrato da Fase 5 |
| T3-4 | Middleware `audit_log` | Registra `user_id, endpoint, method, params, status_code, ts` em `audit_log` para toda requisição autenticada |
| T3-5 | Testes integração | `pytest` + `httpx` + `pytest-asyncio`: login OK, refresh silencioso, RBAC nega 403, audit grava |

### Skills recomendadas

| Skill | Por quê |
|---|---|
| `superpowers:test-driven-development` | Auth/RBAC devem ser testados antes (alto risco de regressão) |
| `pr-review-toolkit:silent-failure-hunter` | Error handling em auth não pode ser silencioso (NUNCA `except: pass` em validação de token) |
| `security-review` (built-in) | Review obrigatório antes de fechar a fase |
| `superpowers:requesting-code-review` | PR de auth precisa de review humano + IA |

### Gate de saída

- [ ] `curl -X POST /api/v1/auth/login` com credencial válida retorna `200` + JWT
- [ ] Request com JWT expirado dispara renovação silenciosa via cookie de refresh
- [ ] Perfil `assistencial` recebe `403` ao tentar acessar endpoint exclusivo `gestor`
- [ ] Toda requisição autenticada gera linha em `audit_log`
- [ ] `security-review` passa sem findings críticos

---

## 7. Fase 4 — Frontend Vue 3 (4–6 dias)

**Objetivo:** 2 telas (Login + Dashboard + Gargalos) ponta-a-ponta com a API.

### Tasks

| ID | Descrição | Saída concreta |
|---|---|---|
| T4-1 | `src/services/api.ts` | Axios + interceptor 401 + refresh silencioso (Passo 3 da arquitetura) |
| T4-2 | Pinia stores | `useFilterStore` (filtros globais), `useUserStore` (sessão), `useKpiStore` (cache de KPI) |
| T4-3 | Layout base + roteamento | `App.vue`, `router/index.ts` com `beforeEach` guard de auth |
| T4-4 | `LoginView.vue` | Form Vee-Validate + Zod schema; submit → `useUserStore.login()` |
| T4-5 | `DashboardView.vue` (UC001 + UC002) | Filtros globais (unidade, especialidade, tipo, período) + 5 cards de KPI de tempo médio |
| T4-6 | `GargaloView.vue` (UC003) | Tabela ranking ordenada por tempo médio decrescente |
| T4-7 | Schemas Zod | `schemas/filter.ts`, `schemas/kpi.ts`, `schemas/gargalo.ts` mirrorando Pydantic do backend |
| T4-8 | Revisão A11y + guidelines | `fixing-accessibility` + `web-design-guidelines` antes do gate |

### Skills recomendadas

| Skill | Por quê |
|---|---|
| `frontend-design:frontend-design` | **Crítica.** Skill especializada em produzir UI distintiva, evitar slop genérico |
| `baseline-ui` | Enforce baseline visual para não cair em "AI-generated look" |
| `fixing-accessibility` | Pré-gate de qualidade — corrigir issues A11y |
| `web-design-guidelines` | Review final contra Web Interface Guidelines |
| `superpowers:test-driven-development` | Vitest para stores e componentes críticos |
| `verify` (built-in) | Subir frontend + backend e testar golden path no browser |

### Gate de saída

- [ ] `verify`: login → dashboard → filtro por unidade → KPIs atualizam → navegar para gargalos → ranking atualiza
- [ ] Refresh silencioso testado (deixar JWT expirar e confirmar nova chamada sem login)
- [ ] Zero chamadas HTTP fora de `src/services/api.ts` (verificado por grep)
- [ ] A11y review sem erros críticos
- [ ] Build de produção (`npm run build`) compila sem erros

---

## 8. Fase 5 — Cutover HC (Pós-MVP, gated)

**Objetivo:** quando o HC liberar VPN + AD, trocar `CsvResource → AghuResource` e `local_auth → ldap_auth` **sem alterar código de consumo** (apenas env).

**Pré-condições (gates externos):**
- [ ] HC-UFPE libera VPN + credencial de serviço com `GRANT SELECT` nas 7 views
- [ ] HC-UFPE confirma DSN Oracle e estrutura final das views
- [ ] HC-UFPE define ambiente de deploy

### Tasks

| ID | Descrição | Saída concreta |
|---|---|---|
| T5-1 | `AghuResource` real | Substituir stub por impl `python-oracledb` com pool de conexão; manter contrato `BaseResource` |
| T5-2 | Validar `.sql` de extração | Rodar contra views reais; ajustar nomes de colunas se divergirem |
| T5-3 | Validar volumes | `etl_runner` em produção → comparar `etl_log.rows_loaded` com `SELECT COUNT(*) FROM vw_*` direto |
| T5-4 | `ldap_auth.py` | `python-ldap` contra AD HC; substitui `local_auth` via env switch |
| T5-5 | Deploy + agendamento | Servidor único (FastAPI servindo Vue build); cron noturno para `etl_runner` |

### Skills recomendadas

| Skill | Por quê |
|---|---|
| `superpowers:systematic-debugging` | Integração real sempre quebra — debugar metodicamente |
| `superpowers:verification-before-completion` | Gate de deploy: validar tudo antes de cutover |
| `verify` (built-in) | Smoke test pós-deploy |
| `security-review` (built-in) | Review final pré-produção |
| `superpowers:requesting-code-review` | Review humano obrigatório |

### Gate de saída

- [ ] `RESOURCE_MODE=aghu` carrega dados reais sem alterar Providers/Controllers/Routers
- [ ] `LDAP_URI=ldap://ad.hc-ufpe.br` autentica usuários reais sem alterar Routers
- [ ] Volumes ETL batem com COUNT direto nas views (tolerância 0%)
- [ ] Cron noturno rodando; `etl_log` populado a cada execução
- [ ] `security-review` passa sem findings críticos

---

## 9. Catálogo de skills — referência rápida

### Sempre disponíveis e relevantes

| Skill | Categoria | Uso recomendado |
|---|---|---|
| `superpowers:using-superpowers` | Meta | Início de toda conversa |
| `superpowers:brainstorming` | Process | Antes de qualquer feature/decisão de design |
| `superpowers:writing-plans` | Process | Transformar tasks em plano executor-ready |
| `superpowers:executing-plans` | Process | Durante a execução |
| `superpowers:test-driven-development` | Rigid | ETL, KPIs, auth |
| `superpowers:systematic-debugging` | Rigid | Qualquer bug não-óbvio |
| `superpowers:verification-before-completion` | Rigid | Antes de marcar qualquer task done |
| `superpowers:requesting-code-review` | Process | Antes de PR |
| `frontend-design:frontend-design` | Implementation | Toda task de UI |
| `baseline-ui` | Implementation | UI scaffold/review |
| `fixing-accessibility` | Implementation | Gate de UI |
| `web-design-guidelines` | Review | Review final de UI |
| `pr-review-toolkit:code-reviewer` | Review | Antes de PR |
| `pr-review-toolkit:silent-failure-hunter` | Review | Em ETL e auth |
| `pr-review-toolkit:type-design-analyzer` | Review | Para Pydantic schemas e types complexos |
| `feature-dev:code-architect` | Implementation | Desenho do Resource adapter, abstrações novas |
| `feature-dev:code-explorer` | Discovery | Quando código crescer e precisar mapear |
| `commit-commands:commit` | Util | Commit local |
| `commit-commands:commit-push-pr` | Util | Commit + push + PR em uma operação |
| `verify` (built-in) | Validation | Subir app e validar manualmente |
| `security-review` (built-in) | Validation | Antes de fechar Fase 3 e Fase 5 |
| `init` (built-in) | Util | Popular `CLAUDE.md` após F0 |
| `review` (built-in) | Validation | Review de PR antes de merge |

### Não aplicáveis (descartadas para este projeto)

| Skill | Por que não |
|---|---|
| `claude-api` | Projeto não é app de IA |
| `vercel:*` | Deploy é no ambiente HC, não Vercel |
| `vercel:nextjs`, `vercel:react-best-practices` | Frontend é Vue 3, não React/Next |
| `vercel:shadcn` | Frontend usa Tailwind puro (sem shadcn) |
| `sentry:*` | Observabilidade fora do MVP |
| `vercel:ai-sdk`, `vercel:workflow`, `vercel:chat-sdk` | Não aplica |
| `superpowers:dispatching-parallel-agents` | Escopo pequeno; tasks sequenciais |
| `superpowers:using-git-worktrees` | 1–poucos devs, sem necessidade de isolar |

---

## 10. Definição de Pronto (DoD) — aplica a toda task

Uma task só é marcada como concluída quando:

1. ✅ Código implementado segue os guardrails do `SPEC.md §3-4` e `06-arquitetura.md §7`
2. ✅ Testes unitários (`test_*.py`) escritos e passando
3. ✅ Cobertura ≥ 80% nos arquivos novos/modificados
4. ✅ `pre-commit` (lint) passa sem erros
5. ✅ Sem secrets no código (`.env` only)
6. ✅ Sem `DELETE` físico (somente soft delete via `deleted_at`)
7. ✅ Sem dados pessoais diretos (só `paciente_id`)
8. ✅ Documentação atualizada se a task introduz convenção nova
9. ✅ Skill `superpowers:verification-before-completion` invocada
10. ✅ Commit message claro descrevendo a mudança

---

## 11. Gates de fase — checklist consolidado

| Gate | Critério único bloqueante |
|---|---|
| F0 | `GET /health` responde 200 em ambos backend e frontend |
| F1 | `etl_runner --sample 1000` carrega CSV sample sem duplicar em rerun |
| F2 | Todos os 5 KPIs e ranking de gargalos batem fixture com tolerância 0% |
| F3 | `security-review` passa + audit log grava toda requisição |
| F4 | Golden path funciona no browser via `verify` |
| F5 | Volumes ETL contra AGHU batem com COUNT direto nas views |

---

## 12. Riscos identificados e mitigações

| Risco | Mitigação adotada |
|---|---|
| CSVs do HC não chegam ou chegam atrasados | F1–F4 podem usar sample data sintético gerado em `tests/fixtures/` |
| Estrutura de CSVs diverge de `04-modelo-dados.md` | `CsvResource` normaliza no momento da leitura; `.sql` de extração ajustados sem mexer em providers |
| Framework auth HC nunca chega | Auth interim já é production-grade — só falta swap por LDAP (Fase 5) |
| KPIs reais divergem da fórmula spec | Fixture inicial permite validar fórmula; ajustes em SQL não afetam contrato HTTP |
| VPN HC nunca liberada | MVP completo já entrega valor com dados CSV; Fase 5 é gate adicional, não bloqueante do MVP |
| Equipe pequena, fases sequenciais | Aceitável; paralelismo prematuro adicionaria risco de integração |