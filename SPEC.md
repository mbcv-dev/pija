# SPEC.md – Contrato de Desenvolvimento (SDD)
## PIJA – Plataforma Integrada da Jornada Assistencial

**Projeto:** HC-UFPE · CIn-UFPE | IESI 2026.1 | Time 2 – Perspectiva Assistencial
**Última atualização:** 2026-05-28

---

## 1. Visão Geral e Resultados Esperados

Este documento é a **ÚNICA fonte de verdade** para a orquestração do desenvolvimento da PIJA. O objetivo do **MVP** é entregar uma plataforma analítica enxuta, segura e em conformidade com a LGPD, que responda a um subconjunto-chave das **perguntas direcionadoras** da disciplina IESI 2026.1 a partir dos dados existentes no AGHU.

### Estratégia de dados em duas etapas

1. **MVP (Fases 0–4)** — desenvolvimento e validação contra **CSVs reais exportados das views do AGHU** (entregues pelo HC).
2. **Cutover (Fase 5)** — numa VM dentro da rede do HC (que alcança o AGHU), o adapter `Resource` troca de `CsvResource` para `AghuResource` (`psycopg`/`asyncpg` contra o **PostgreSQL** do AGHU) sem alterar Providers, Controllers ou Routers.

### Objetivos do MVP

- [ ] Pipeline ETL **CSV → SQLite** em streaming (chunked), idempotente, com `etl_log`
- [ ] Repositório analítico local com modelo `fato_eventos_jornada`
- [ ] **3 endpoints** essenciais (filtros, KPIs de tempo médio, ranking de gargalos)
- [ ] **2 telas** Vue 3: Dashboard (filtros + cards de KPI) e Gargalos (ranking)
- [ ] Auth interina **PyJWT + `users.yml`** seguindo o contrato Double Token do framework HC
- [ ] Trilha de auditoria imutável para toda consulta de usuário
- [ ] Adapter `Resource` plugável (`CsvResource` agora, `AghuResource` no cutover)

### Pós-MVP (fora desta entrega)

- Linha do tempo cronológica por paciente (`/jornada/{paciente_id}`)
- Painel de prontuários inertes (RF005)
- Fluxos predominantes (RF004)
- Integração LEC (Lista de Espera Cirúrgica)
- Taxa de não realização (faltas/cancelamentos)
- Proporções de tipos de encaminhamento
- KPIs adicionais além dos 5 de tempo médio

---

## 2. Contexto do Projeto (Documentação Imutável)

| Documento | Conteúdo |
|:---|:---|
| [01-visao.md](01-visao.md) | Problema, objetivos, escopo, critérios de sucesso |
| [02-requisitos.md](02-requisitos.md) | Requisitos (MVP marcado explicitamente) com padrão CARE |
| [03-casos-uso.md](03-casos-uso.md) | UC001–UC006 com Mermaid e CARE |
| [04-modelo-dados.md](04-modelo-dados.md) | Views AGHU, `fato_eventos_jornada`, JSON Schemas |
| [05-interfaces.md](05-interfaces.md) | API FastAPI, TypeScript interfaces, telas Vue 3 |
| [06-arquitetura.md](06-arquitetura.md) | Stack, fluxo obrigatório, guardrails, monorepo, adapter `Resource` |
| [07-glossario.md](07-glossario.md) | Glossário, acrônimos, referências |
| [docs/PLANO.md](docs/PLANO.md) | Plano de implementação por fase + skills Claude Code recomendadas |

---

## 3. Guardrails — Escopo Positivo (O que DEVE ser feito)

- Seguir o fluxo obrigatório: `.sql → Resources → Providers → Controllers → Routers`
- Usar **SQL nativo** (arquivos `.sql`) para consultas analíticas — vale tanto para `CsvResource` (staging local) quanto para `AghuResource` (PostgreSQL)
- Usar **SQLAlchemy 2.0 Async** apenas para tabelas internas (`fato_eventos_jornada`, `etl_log`, `audit_log`, `users` interim)
- Usar **SQLite** como banco local — nunca PostgreSQL local
- Isolar toda comunicação HTTP do frontend em `src/services/api.ts`
- Validar entrada e saída de todos os endpoints via **Pydantic v2**
- Usar `Depends()` do FastAPI para injeção de dependências (auth, conexão, `Resource`)
- Selecionar `Resource` via env `RESOURCE_MODE=csv|aghu` (default `csv` no MVP)
- Comentar funções complexas seguindo padrão **docstring Python** no backend e **JSDoc/TSDoc** no frontend
- Usar blocos `try/except` com logs de erro padronizados em todo o backend
- Criar arquivo de teste `test_*.py` para cada novo controller e provider
- ETL **streaming-first**: `pandas.read_csv(chunksize=...)` + upsert batched no SQLite

## 4. Guardrails — Escopo Negativo (Anti-Patterns)

- **No Hard Deletes**: proibido `DELETE` SQL físico em tabelas internas. Usar coluna `deleted_at` (NULL = ativo; preenchido = excluído logicamente)
- **No Secrets in Code**: proibido salvar strings de conexão, senhas ou chaves JWT no código. Usar exclusivamente `.env`
- **No Refactoring Unasked**: proibido alterar arquivos de infraestrutura ou configuração global (`main.py`, `resources/`, `auth/`, `vite.config.ts`, `tailwind.config.js`) sem instrução explícita neste `SPEC.md`
- **No ORM on AGHU**: proibido usar SQLAlchemy para consultar o AGHU (apenas SQL nativo via `.sql`)
- **No Direct HTTP in Components**: proibido fazer chamadas HTTP dentro de componentes Vue (usar `src/services/api.ts`)
- **No Personal Data**: proibido armazenar nome, CPF, data de nascimento — apenas `paciente_id`
- **No Write on AGHU**: proibido qualquer operação de escrita no banco do AGHU
- **No In-Memory Full CSV Load**: proibido carregar CSVs do HC inteiros em memória; sempre streaming
- **No LDAP em Dev sem Mock**: o auth interim usa `users.yml`; substituição por LDAP real só na Fase 5

---

## 5. Task Breakdown — MVP Enxuto

Detalhamento por fase, gates e skills Claude Code: [`docs/PLANO.md`](docs/PLANO.md).

### Fase 0 — Scaffold (1–2 dias)

- [ ] **T0-1** Consolidar repositório (✓ feito 2026-05-28); arquivar templates HC
- [ ] **T0-2** Backend skeleton: `backend/`, `pyproject.toml`, FastAPI `/health`, estrutura conforme `06-arquitetura.md §5`
- [ ] **T0-3** Frontend skeleton: Vite + Vue 3 + TS + Tailwind + Pinia + Axios + Zod + Vee-Validate, página `/health`
- [ ] **T0-4** `.env.example` validado por Pydantic Settings (vars: `RESOURCE_MODE`, `SQLITE_PATH`, `JWT_SECRET`, `CSV_DIR`, `AGHU_DSN`, `LDAP_URI`)
- [ ] **T0-5** Estrutura de testes (`pytest` backend, `vitest` frontend); CI mínima (lint + test)

### Fase 1 — ETL CSV → SQLite (3–5 dias)

- [ ] **T1-1** Schema Alembic: `fato_eventos_jornada`, `dim_unidade`, `dim_especialidade`, `etl_log`, `audit_log`, `users`
- [ ] **T1-2** `BaseResource` Protocol + `CsvResource` (pandas chunked, streaming)
- [ ] **T1-3** `AghuResource` stub (mesma interface, `raise NotImplementedError`)
- [ ] **T1-4** `resource_factory.py` + `Depends()` (seleção por `RESOURCE_MODE`)
- [ ] **T1-5** `etl_runner.py`: itera 7 entidades, normaliza, upsert batched, modo `--sample N`, log
- [ ] **T1-6** 7 arquivos `.sql` de extração (rodam contra staging local no MVP)
- [ ] **T1-7** Testes ETL: idempotência (rerun não duplica), soft-fail (linha inválida), volumes batem

### Fase 2 — 3 Endpoints Essenciais (3–5 dias)

- [ ] **T2-1** `GET /api/v1/eventos` com filtros (unidade, especialidade, tipo_entidade, data_inicio, data_fim) — RF001 / UC001
- [ ] **T2-2** `GET /api/v1/kpis/tempos-medios` — RF002 subset:
  - `KPI-01`: prontuário → 1º evento
  - `KPI-03`: agendamento → realização (consulta)
  - `KPI-05`: solicitação → liberação (exame)
  - `KPI-06`: solicitação → internação
  - `KPI-07`: tempo médio de internação (admissão → alta administrativa)
- [ ] **T2-3** `GET /api/v1/gargalos` ranking — RF003 / UC003
- [ ] **T2-4** Fixture dataset SQLite com valores conhecidos para validação determinística
- [ ] **T2-5** Testes contra fixture (tolerância 0%)

### Fase 3 — Auth Interim (1–2 dias)

- [ ] **T3-1** `auth/local_auth.py`: `users.yml` (3 perfis: `gestor`, `assistencial`, `etl`) + bcrypt
- [ ] **T3-2** `auth/jwt_service.py`: PyJWT (access curto + refresh em HttpOnly cookie)
- [ ] **T3-3** `auth/dependencies.py`: `get_current_user`, `require_role(...)` via `Depends()` (mesmo contrato que o framework HC vai entregar)
- [ ] **T3-4** Middleware `audit_log`: registra `user, endpoint, params, ts` em toda requisição
- [ ] **T3-5** Testes integração: login OK, refresh silencioso, RBAC nega, audit grava

### Fase 4 — Frontend (2 telas, 4–6 dias)

- [ ] **T4-1** `src/services/api.ts`: Axios + interceptor 401 + refresh silencioso (Passo 3 da arquitetura)
- [ ] **T4-2** Pinia stores: `useFilterStore`, `useUserStore`, `useKpiStore`
- [ ] **T4-3** Layout base + roteamento + auth guards
- [ ] **T4-4** `LoginView.vue` (Double Token client side)
- [ ] **T4-5** `DashboardView.vue`: filtros globais + 5 cards de KPI de tempo médio
- [ ] **T4-6** `GargaloView.vue`: ranking de etapas por tempo de espera
- [ ] **T4-7** Schemas Zod + Vee-Validate em formulários de filtro
- [ ] **T4-8** Revisão de acessibilidade + guidelines de UI

### Fase 5 — Cutover HC (Pós-MVP, gated externamente)

- [ ] **T5-1** Implementar `AghuResource` real (`psycopg`/`asyncpg`, pool) — substitui o stub
- [ ] **T5-2** Validar `.sql` da Fase 1 contra as 7 views reais; ajustar se necessário
- [ ] **T5-3** Validar volumes ETL contra `SELECT COUNT(*)` direto nas views
- [ ] **T5-4** Substituir `local_auth` por `ldap_auth` (`python-ldap` contra AD HC) — env-only swap
- [ ] **T5-5** Deploy no ambiente HC; configurar agendamento batch (cron noturno)

---

## 6. Critérios de Verificação Global

- [ ] Todos os KPIs validados contra fixture SQLite com tolerância 0%
- [ ] Zero dados pessoais diretos armazenados fora do campo `paciente_id`
- [ ] Log de auditoria operacional para toda consulta de usuário
- [ ] RBAC validado: perfil assistencial bloqueado de dados fora da sua unidade
- [ ] `deleted_at` em uso — zero `DELETE` físico em qualquer tabela interna
- [ ] Zero secrets no código — tudo via `.env`
- [ ] Arquivo `test_*.py` presente para cada controller e provider
- [ ] Toda comunicação HTTP do frontend centralizada em `src/services/api.ts`
- [ ] ETL idempotente: `etl_runner` reexecutado não duplica nem altera contagens
- [ ] Adapter `Resource` selecionável por env — Fase 5 troca código zero (só `RESOURCE_MODE`)

---

## 7. Pendências Críticas (Validar com HC-UFPE)

- [ ] Recebimento dos CSVs exportados das 7 views (formato, volume, frequência de atualização)
- [ ] Disponibilidade e estrutura das 7 views no AGHU (para a Fase 5)
- [ ] Campos opcionais (`situacao`, `data_hora_agendamento`, `data_hora_solicitacao`) presentes nos exports
- [ ] Consistência do `paciente_id` entre módulos
- [ ] Liberação de VPN + acesso read-only ao AGHU (gate da Fase 5)
- [ ] Política de retenção de dados e regras LGPD aplicáveis
- [x] ~~Confirmação do driver e DSN~~ — **Resolvido (2026-07-24): AGHU é PostgreSQL**, driver `psycopg`/`asyncpg` (ver [docs/superpowers/plans/2026-07-24-aghu-integracao-referencia.md](docs/superpowers/plans/2026-07-24-aghu-integracao-referencia.md))