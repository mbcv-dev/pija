# 02 – Requisitos

**Projeto:** PIJA – Plataforma Integrada da Jornada Assistencial  
**Referência:** Perspectiva Assistencial | HC-UFPE · CIn-UFPE | IESI 2026.1

---

## 1. Requisitos Funcionais (RF)

> **Escopo MVP:** RF001, RF002 (subset de 5 KPIs de tempo médio), RF003 e RF006 (CSV → SQLite).
> **Pós-MVP:** RF004, RF005, RF007, RF008 e KPIs operacionais adicionais.

| ID | Título | Descrição | Prioridade | MVP? |
|:---|:---|:---|:---|:---|
| RF001 | Filtros Multidimensionais | Filtragem por unidade, especialidade, tipo de evento e período | Essencial | ✅ MVP |
| RF002 | Painel de KPIs de Tempo Médio | **MVP:** 5 KPIs de tempo médio entre eventos (KPI-01, KPI-03, KPI-05, KPI-06, KPI-07). **Pós-MVP:** KPIs operacionais (taxas, proporções, encaminhamentos). | Essencial | ✅ MVP (subset) |
| RF003 | Identificação de Gargalos | Ranquear etapas da jornada por tempo médio de espera | Essencial | ✅ MVP |
| RF004 | Análise de Fluxos Predominantes | Agrupar e exibir sequências de eventos por frequência e proporção | Alta | ⏸ Pós-MVP |
| RF005 | Painel de Prontuários Inertes | Identificar prontuários sem eventos subsequentes | Alta | ⏸ Pós-MVP |
| RF006 | Pipeline de Extração de Dados | **MVP:** ETL **CSV → SQLite** via `CsvResource` (streaming chunked). **Pós-MVP (Fase 5):** ETL **AGHU views → SQLite** via `AghuResource` (`psycopg`/`asyncpg` contra o PostgreSQL do AGHU, VM na rede do HC). | Essencial | ✅ MVP (CSV) |
| RF007 | Linha do Tempo Cronológica por Paciente | Endpoint `/api/v1/jornada/{paciente_id}` e tela com a linha do tempo do paciente | Média | ⏸ Pós-MVP |
| RF008 | Integração LEC | Indicadores da Lista de Espera Cirúrgica (volume, permanência por especialidade) | Média | ⏸ Pós-MVP |

---

## 2. Requisitos Não Funcionais (RNF)

| ID | Categoria | Descrição |
|:---|:---|:---|
| RNF001 | Segurança | Autenticação via Double Token (JWT + HttpOnly Cookie) com Active Directory/LDAP |
| RNF002 | LGPD | Auditoria imutável de todos os acessos a dados; uso exclusivo de `paciente_id` sem dados pessoais diretos |
| RNF003 | Desempenho | Consultas com filtros simples devem retornar em até 5 segundos |
| RNF004 | Disponibilidade | Sistema disponível no horário operacional do HC-UFPE (7h–22h, dias úteis) |
| RNF005 | Manutenibilidade | Novas entidades e KPIs adicionáveis sem redesenho da arquitetura base |
| RNF006 | Rastreabilidade | IDs de origem preservados em cada registro; regras de KPI documentadas e versionadas |

---

## 3. Detalhamento SDD (CARE)

### [CARE-RF001] Filtros Multidimensionais

- **Context**: Usuário autenticado acessa o painel e seleciona combinação de filtros (unidade, especialidade, tipo de evento, período, status).
- **Action**: Implementar endpoint `GET /api/v1/eventos` com query params validados por schema Pydantic; provider executa `sql/eventos_filtrados.sql` com substituição de placeholders pelos filtros.
- **Result**: Conjunto de eventos restrito ao filtro ativo; KPIs recalculados automaticamente com base na seleção.
- **Evaluation**: `pytest tests/test_filtros.py` — validar que filtro por `unidade=UTI` retorna apenas eventos dessa unidade e que filtro de período exclui eventos fora da janela.

---

### [CARE-RF002] Painel de KPIs de Tempo Médio

- **Context**: Usuário com perfil de gestão seleciona unidade e período no dashboard.
- **Action**: Implementar endpoint `GET /api/v1/kpis/tempos-medios` com parâmetros `unidade`, `especialidade`, `data_inicio`, `data_fim`, `kpi_codes[]`; controller `kpi_controller.py` aplica as fórmulas abaixo sobre os dados retornados pelo provider.
- **Result**: JSON com objeto contendo os KPIs solicitados (valores numéricos + metadados do período).
- **Evaluation**: `pytest tests/test_kpi_controller.py` — para cada KPI MVP, validar o valor contra fixture SQLite com valores calculados na mão (tolerância 0%).

**KPIs no MVP (apenas tempo médio entre eventos):**

| Código | Indicador | Fórmula Base | Entidade(s) | MVP? |
|:---|:---|:---|:---|:---|
| KPI-01 | Tempo médio prontuário → 1º evento | `AVG(ts_1º_evento - ts_abertura_prontuario)` | Prontuários + todas | ✅ |
| KPI-02 | Taxa de prontuários inertes | `COUNT(sem_evento) / COUNT(total)` | Prontuários | ⏸ Pós-MVP |
| KPI-03 | Tempo médio agendamento → realização (consulta) | `AVG(ts_realizacao - ts_agendado)` | Consultas | ✅ |
| KPI-04 | Taxa de não realização (consultas) | `COUNT(nao_realizado) / COUNT(total)` | Consultas | ⏸ Pós-MVP |
| KPI-05 | Tempo médio solicitação → realização (exame) | `AVG(ts_realizacao - ts_solicitacao)` | Exames | ✅ |
| KPI-06 | Tempo médio solicitação → internação | `AVG(ts_internacao - ts_solicitacao)` | Internações | ✅ |
| KPI-07 | Tempo médio de internação | `AVG(ts_alta_administrativa - ts_internacao)` | Internações + Altas | ✅ |
| KPI-08 | Volume de eventos por período/unidade/especialidade | `COUNT(eventos) GROUP BY filtro` | Todas | ⏸ Pós-MVP |
| KPI-09 | Proporção de encaminhamentos por tipo | `COUNT(por_tipo) / COUNT(total)` | Consultas | ⏸ Pós-MVP |

---

### [CARE-RF003] Identificação de Gargalos

- **Context**: Banco local contém dados de pelo menos um mês de operação.
- **Action**: Implementar `gargalo_controller.py` que calcula `AVG(tempo_espera)` por transição de evento via `sql/gargalos.sql`; controller ordena por tempo decrescente e aplica limiar configurável.
- **Result**: Ranking de etapas com maior tempo médio, segmentado por tipo de evento, unidade e especialidade.
- **MVP**: ranking simples (sem drill-down). Drill-down fica para Pós-MVP.
- **Evaluation**: `pytest tests/test_gargalo_controller.py` — validar ordenação e que etapas com tempo zero não aparecem no ranking.

---

### [CARE-RF004] Análise de Fluxos Predominantes — ⏸ Pós-MVP

- **Context**: Banco local populado com dados históricos de jornadas completas.
- **Action**: Implementar `fluxo_provider.py` que executa `sql/fluxos_predominantes.sql`, agrupando sequências de `tipo_entidade` por `paciente_id` em janela temporal.
- **Result**: Lista de sequências de eventos ordenadas por frequência, com volume absoluto e proporção percentual.
- **Evaluation**: `pytest tests/test_fluxo_provider.py` — validar que o fluxo mais frequente no dataset de teste é retornado em primeiro lugar.

---

### [CARE-RF005] Painel de Prontuários Inertes — ⏸ Pós-MVP

- **Context**: Banco local contém registros de `vw_prontuarios_criados` e das demais entidades.
- **Action**: Implementar `prontuario_controller.py` com método `get_inertes()` que executa `sql/prontuarios_inertes.sql`; um prontuário é inerte se `COUNT(eventos_posteriores) = 0` em todas as outras entidades após `ts_abertura_prontuario`.
- **Result**: Volume absoluto, percentual e distribuição por período e unidade criadora.
- **Evaluation**: `pytest tests/test_prontuario_controller.py` — inserir prontuário sem eventos no banco de teste e validar que aparece como inerte; inserir com evento e validar que não aparece.

---

### [CARE-RF006] Pipeline de Extração de Dados — CSV-first

- **Context (MVP)**: HC-UFPE entrega CSVs grandes exportados das 7 views; banco SQLite local inicializado com schema via Alembic.
- **Action (MVP)**: Implementar `etl_runner.py` que itera pelas 7 entidades, lê CSVs via `CsvResource` (`pandas.read_csv(chunksize=50_000)`), transforma (tipagem, nulos, geração de `evento_id`), valida cada linha com Pydantic v2 (linhas inválidas → soft-fail no log) e faz **upsert batched** no SQLite via SQLAlchemy por `(entidade_id, tipo_entidade)`.
- **Result (MVP)**: SQLite atualizado, idempotente; log de execução em `etl_log` com `started_at`, `finished_at`, `view_name`, `rows_read`, `rows_loaded`, `rows_rejected`, `errors`.
- **Cutover (Fase 5 — Pós-MVP)**: trocar `CsvResource` por `AghuResource` (`psycopg`/`asyncpg`, pool) via env `RESOURCE_MODE=aghu`. Providers e `.sql` não mudam.
- **Evaluation**: `pytest tests/test_etl_runner.py` — sample CSV de teste; validar contagens, idempotência (rerun não duplica) e soft-fail (linha inválida não trava o pipeline).
