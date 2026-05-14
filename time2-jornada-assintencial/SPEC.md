# SPEC.md – Contrato de Desenvolvimento (SDD)
## PIJA – Plataforma Integrada da Jornada Assistencial

**Projeto:** HC-UFPE · CIn-UFPE | IESI 2026.1 | Time 2 – Perspectiva Assistencial

---

## 1. Visão Geral e Resultados Esperados

Este documento é a **ÚNICA fonte de verdade** para a orquestração do desenvolvimento da PIJA. O objetivo é construir uma plataforma analítica segura, em conformidade com a LGPD, que integre e visualize a jornada assistencial do paciente no HC-UFPE a partir dos dados existentes no AGHU.

### Objetivos de Alto Nível

- [ ] Implementar pipeline ETL com extração das 7 views do AGHU para banco SQLite local
- [ ] Construir repositório analítico com modelo `fato_eventos_jornada`
- [ ] Implementar motor de cálculo dos 10 KPIs prioritários (RF004)
- [ ] Disponibilizar API FastAPI com RBAC e autenticação Double Token via AD/LDAP
- [ ] Entregar dashboards Vue 3 funcionais: linha do tempo, KPIs, gargalos, fluxos, prontuários inertes
- [ ] Garantir trilhas de auditoria imutáveis para todas as consultas de usuários

---

## 2. Contexto do Projeto (Documentação Imutável)

| Documento | Conteúdo |
|:---|:---|
| [01-visao.md](01-visao.md) | Problema, objetivos, escopo, critérios de sucesso |
| [02-requisitos.md](02-requisitos.md) | RF001–RF008 e RNF001–RNF006 com padrão CARE |
| [03-casos-uso.md](03-casos-uso.md) | UC001–UC007 com Mermaid e CARE |
| [04-modelo-dados.md](04-modelo-dados.md) | Views AGHU, `fato_eventos_jornada`, JSON Schemas |
| [05-interfaces.md](05-interfaces.md) | API FastAPI, TypeScript interfaces, telas Vue 3 |
| [06-arquitetura.md](06-arquitetura.md) | Stack, fluxo obrigatório, guardrails, monorepo |
| [07-glossario.md](07-glossario.md) | Glossário, acrônimos, referências |

---

## 3. Guardrails — Escopo Positivo (O que DEVE ser feito)

- Seguir o fluxo obrigatório: `.sql → Resources → Providers → Controllers → Routers`
- Usar **SQL nativo** (arquivos `.sql`) para todas as consultas ao AGHU
- Usar **SQLAlchemy** apenas para tabelas internas (tokens, configs, audit log, etl_log)
- Usar **SQLite** como banco local — nunca PostgreSQL local
- Isolar toda comunicação HTTP do frontend em `src/services/api.ts`
- Validar entrada e saída de todos os endpoints via **Pydantic v2**
- Usar `Depends()` do FastAPI para injeção de dependências (auth, conexão)
- Comentar funções complexas seguindo padrão **docstring Python** no backend e **JSDoc/TSDoc** no frontend
- Usar blocos `try/except` com logs de erro padronizados em todo o backend
- Criar arquivo de teste `test_*.py` para cada novo controller e provider

## 4. Guardrails — Escopo Negativo (O que NÃO DEVE ser feito — Anti-Patterns)

- **No Hard Deletes**: proibido `DELETE` SQL físico. Usar coluna `deleted_at` (NULL = ativo; preenchido = excluído logicamente)
- **No Secrets in Code**: proibido salvar strings de conexão, senhas ou chaves JWT no código. Usar exclusivamente `.env`
- **No Refactoring Unasked**: proibido alterar arquivos de infraestrutura ou configuração global (`main.py`, `resources/`, `auth/`, `vite.config.ts`, `tailwind.config.js`) sem instrução explícita neste `SPEC.md`
- **No ORM on AGHU**: proibido usar SQLAlchemy para consultar o AGHU (apenas SQL nativo via `.sql`)
- **No Direct HTTP in Components**: proibido fazer chamadas HTTP dentro de componentes Vue (usar `src/services/api.ts`)
- **No Personal Data**: proibido armazenar nome, CPF, data de nascimento — apenas `paciente_id`
- **No Write on AGHU**: proibido qualquer operação de escrita no banco do AGHU

---

## 5. Task Breakdown (Plano de Implementação)

### Fase 1 – Infraestrutura e Dados

- [ ] **TASK-001** Validar disponibilidade das 7 views com o DBA do HC-UFPE
- [ ] **TASK-002** Confirmar campos opcionais disponíveis por view (situacao, timestamps)
- [ ] **TASK-003** Configurar `.env` com variáveis de conexão AGHU, JWT secret e SQLite path
- [ ] **TASK-004** Criar schema SQLite via Alembic (`fato_eventos_jornada`, `dim_unidade`, `dim_especialidade`, `etl_log`)
- [ ] **TASK-005** Implementar pipeline ETL batch para as 7 views (RF008 / UC007)

### Fase 2 – Motor Analítico

- [ ] **TASK-006** Implementar `sql/jornada_cronologica.sql` e `jornada_provider.py` (RF001)
- [ ] **TASK-007** Implementar `sql/kpis/` e `kpi_controller.py` com os 10 KPIs (RF004)
- [ ] **TASK-008** Implementar `sql/gargalos.sql` e `gargalo_controller.py` (RF005)
- [ ] **TASK-009** Implementar `sql/fluxos_predominantes.sql` e `fluxo_provider.py` (RF006)
- [ ] **TASK-010** Implementar `sql/prontuarios_inertes.sql` e método em `prontuario_controller.py` (RF007)

### Fase 3 – API e Autenticação

- [ ] **TASK-011** Implementar routers FastAPI com Pydantic v2 para todos os endpoints de `05-interfaces.md`
- [ ] **TASK-012** Validar integração com Double Token e RBAC já implementados no framework

### Fase 4 – Frontend Vue 3

- [ ] **TASK-013** Configurar Pinia stores: `useFilterStore`, `useUserStore`, `useKpiStore`
- [ ] **TASK-014** Implementar `TimelineView.vue` (UC001)
- [ ] **TASK-015** Implementar `DashboardView.vue` com filtros e KPIs (UC002 + UC003)
- [ ] **TASK-016** Implementar `GargaloView.vue` com drill-down (UC004)
- [ ] **TASK-017** Implementar `FluxoView.vue` (UC005)
- [ ] **TASK-018** Implementar `InertesView.vue` (UC006)

---

## 6. Critérios de Verificação Global

- [ ] Todos os KPIs calculados validados contra queries manuais no banco de teste
- [ ] Zero dados pessoais diretos armazenados fora do campo `paciente_id`
- [ ] Log de auditoria operacional para todas as consultas de usuário
- [ ] RBAC validado: perfil assistencial não acessa dados de outras unidades
- [ ] `deleted_at` em uso — zero `DELETE` físico em qualquer tabela interna
- [ ] Zero secrets no código — tudo via `.env`
- [ ] Arquivo `test_*.py` presente para cada controller e provider
- [ ] Toda comunicação HTTP do frontend centralizada em `src/services/api.ts`
