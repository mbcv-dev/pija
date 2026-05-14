# 02 – Requisitos

**Projeto:** PIJA – Plataforma Integrada da Jornada Assistencial  
**Referência:** Perspectiva Assistencial | HC-UFPE · CIn-UFPE | IESI 2026.1

---

## 1. Requisitos Funcionais (RF)

| ID | Título | Descrição | Prioridade |
|:---|:---|:---|:---|
| RF001 | Reconstrução Cronológica da Jornada | Consolidar e ordenar temporalmente todos os eventos de um paciente por `paciente_id` | Essencial |
| RF002 | Linha do Tempo por Paciente | Exibir timeline cronológica com todos os eventos registrados para um `paciente_id` | Essencial |
| RF003 | Filtros Multidimensionais | Filtragem por unidade, especialidade, tipo de evento, período e status | Essencial |
| RF004 | Painel de KPIs | Calcular e exibir os 10 KPIs assistenciais e operacionais parametrizados por filtro | Essencial |
| RF005 | Identificação de Gargalos | Ranquear etapas da jornada por tempo médio de espera e destacar as críticas | Alta |
| RF006 | Análise de Fluxos Predominantes | Agrupar e exibir sequências de eventos por frequência e proporção | Alta |
| RF007 | Painel de Prontuários Inertes | Identificar prontuários sem eventos subsequentes e exibir volume e percentual | Alta |
| RF008 | Pipeline de Extração de Dados | Processo automatizado de extração das 7 views do AGHU e carga no banco local | Essencial |

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

### [CARE-RF001] Reconstrução Cronológica da Jornada

- **Context**: Pipeline ETL (Extrair, Transformar e Carregar) executou com sucesso; banco SQLite local contém registros das 7 entidades com `paciente_id` e `timestamp_principal` preenchidos.
- **Action**: Implementar provider `jornada_provider.py` que executa `sql/jornada_cronologica.sql` com `paciente_id` como parâmetro, retornando todos os eventos ordenados por `timestamp_principal ASC`.
- **Result**: Lista de dicionários com eventos cronológicos do paciente, cruzando todas as entidades, sem lacunas ou duplicidades.
- **Evaluation**: `pytest tests/test_jornada_provider.py` — validar que para um `paciente_id` com eventos em 3 entidades distintas a ordenação temporal está correta e nenhum evento é omitido.

---

### [CARE-RF002] Linha do Tempo por Paciente

- **Context**: Usuário autenticado com perfil assistencial ou gestão acessa o dashboard e informa um `paciente_id` válido.
- **Action**: Implementar endpoint `GET /api/v1/jornada/{paciente_id}` no router e controller formata os eventos em cards com tipo, data/hora, unidade, especialidade e status.
- **Result**: Response JSON com lista de eventos ordenados e frontend renderiza timeline com agrupamento visual por área (ambulatório, diagnóstico, internação, cirurgia).
- **Evaluation**: `pytest tests/test_router_jornada.py` — testar `paciente_id` válido, inválido e sem permissão.

---

### [CARE-RF003] Filtros Multidimensionais

- **Context**: Usuário acessa painel de análise e seleciona combinação de filtros (unidade, especialidade, tipo de evento, período, status).
- **Action**: Implementar endpoint `GET /api/v1/eventos` com query params validados por schema Pydantic; provider executa `sql/eventos_filtrados.sql` com substituição de placeholders pelos filtros.
- **Result**: Conjunto de eventos restrito ao filtro ativo; KPIs recalculados automaticamente com base na seleção.
- **Evaluation**: `pytest tests/test_filtros.py` — validar que filtro por `unidade=UTI` retorna apenas eventos dessa unidade e que filtro de período exclui eventos fora da janela.

---

### [CARE-RF004] Painel de KPIs

- **Context**: Usuário com perfil de gestão seleciona unidade e período no dashboard.
- **Action**: Implementar endpoint `GET /api/v1/kpis` com parâmetros `unidade`, `especialidade`, `data_inicio`, `data_fim`, `kpi_codes[]`; controller `kpi_controller.py` aplica as fórmulas definidas abaixo sobre os dados retornados pelo provider.
- **Result**: JSON com objeto contendo os KPIs solicitados com valores numéricos e metadados do período.
- **Evaluation**: `pytest tests/test_kpi_controller.py` — para cada KPI, validar o valor calculado contra resultado de query manual no banco de teste.

**KPIs obrigatórios no MVP:**

| Código | Indicador | Fórmula Base | Entidade(s) |
|:---|:---|:---|:---|
| KPI-01 | Tempo médio prontuário → 1º evento | `AVG(ts_1º_evento - ts_abertura_prontuario)` | Prontuários + todas |
| KPI-02 | Taxa de prontuários inertes | `COUNT(sem_evento) / COUNT(total)` | Prontuários |
| KPI-03 | Tempo médio agendamento → realização (consulta) | `AVG(ts_realizacao - ts_agendado)` | Consultas |
| KPI-04 | Taxa de não realização (consultas) | `COUNT(nao_realizado) / COUNT(total)` | Consultas |
| KPI-05 | Tempo médio solicitação → realização (exame) | `AVG(ts_realizacao - ts_solicitacao)` | Exames |
| KPI-06 | Tempo médio de internação | `AVG(ts_alta_administrativa - ts_internacao)` | Internações + Altas |
| KPI-07 | Volume de eventos por período/unidade/especialidade | `COUNT(eventos) GROUP BY filtro` | Todas |
| KPI-08 | Tempo médio de permanência na LEC | `AVG(ts_mapa_cirurgico - ts_insercao_lec)` | Cirurgias |
| KPI-09 | Proporção de encaminhamentos por tipo | `COUNT(por_tipo) / COUNT(total)` | Consultas |
| KPI-10 | Ranking de gargalos por tempo de espera | `AVG(tempo_espera) DESC por categoria` | Exames, Internações, LEC |

---

### [CARE-RF005] Identificação de Gargalos

- **Context**: Banco local contém dados de pelo menos um mês de operação.
- **Action**: Implementar `gargalo_controller.py` que calcula `AVG(tempo_espera)` por transição de evento via `sql/gargalos.sql`; controller ordena por tempo decrescente e aplica limiar configurável.
- **Result**: Ranking de etapas com maior tempo médio, segmentado por tipo de evento, unidade e especialidade; drill-down disponível por item do ranking.
- **Evaluation**: `pytest tests/test_gargalo_controller.py` — validar ordenação e que etapas com tempo zero não aparecem no ranking.

---

### [CARE-RF006] Análise de Fluxos Predominantes

- **Context**: Banco local populado com dados históricos de jornadas completas.
- **Action**: Implementar `fluxo_provider.py` que executa `sql/fluxos_predominantes.sql`, agrupando sequências de `tipo_entidade` por `paciente_id` em janela temporal.
- **Result**: Lista de sequências de eventos ordenadas por frequência, com volume absoluto e proporção percentual.
- **Evaluation**: `pytest tests/test_fluxo_provider.py` — validar que o fluxo mais frequente no dataset de teste é retornado em primeiro lugar.

---

### [CARE-RF007] Painel de Prontuários Inertes

- **Context**: Banco local contém registros de `vw_prontuarios_criados` e das demais entidades.
- **Action**: Implementar `prontuario_controller.py` com método `get_inertes()` que executa `sql/prontuarios_inertes.sql`; um prontuário é inerte se `COUNT(eventos_posteriores) = 0` em todas as outras entidades após `ts_abertura_prontuario`.
- **Result**: Volume absoluto, percentual e distribuição por período e unidade criadora.
- **Evaluation**: `pytest tests/test_prontuario_controller.py` — inserir prontuário sem eventos no banco de teste e validar que aparece como inerte; inserir com evento e validar que não aparece.

---

### [CARE-RF008] Pipeline de Extração de Dados

- **Context**: AGHU disponível com conexão read-only ativa; banco SQLite local inicializado com schema via Alembic.
- **Action**: Implementar `etl_runner.py` que itera pelas 7 views, executa os `.sql` de extração via `resources/aghu_resource.py`, transforma (tipagem, nulos, geração de `evento_id`) e carrega no SQLite local via SQLAlchemy.
- **Result**: Banco SQLite atualizado com eventos novos/modificados desde a última extração; log de execução registrado com início, fim, volume por view e erros.
- **Evaluation**: `pytest tests/test_etl_runner.py` — executar pipeline com banco de teste e validar que o volume carregado corresponde ao retornado pelas queries de extração.
