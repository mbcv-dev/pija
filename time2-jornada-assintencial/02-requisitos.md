# 02 – Requisitos

**Projeto:** PIJA – Plataforma Integrada da Jornada Assistencial  
**Referência:** Perspectiva Assistencial | HC-UFPE · CIn-UFPE | IESI 2026.1

---

## 1. Requisitos Funcionais (RF)

### RF001 – Reconstrução Cronológica da Jornada

**Contexto:** O sistema extrai dados das 7 views do AGHU e os consolida em um repositório analítico.  
**Ação:** O sistema ordena cronologicamente todos os eventos de um paciente por `paciente_id` e `timestamp`, formando uma linha do tempo unificada.  
**Resultado:** Uma sequência de eventos cronológicos por paciente, cruzando todas as entidades (prontuário, consultas, exames, internações, cirurgias, procedimentos, altas).  
**Avaliação:** A jornada de um paciente com eventos em múltiplas entidades deve ser reconstituída sem lacunas ou duplicidades.

---

### RF002 – Visualização da Linha do Tempo por Paciente

**Contexto:** Um usuário com perfil assistencial ou de gestão acessa o dashboard e informa o `paciente_id`.  
**Ação:** O sistema exibe uma linha do tempo com todos os eventos registrados para aquele paciente, com tipo de evento, data/hora, unidade/especialidade, e status.  
**Resultado:** Timeline visual cronológica do percurso do paciente no HC-UFPE.  
**Avaliação:** Todos os eventos disponíveis nas views devem ser exibidos sem omissões.

---

### RF003 – Filtros Multidimensionais

**Contexto:** O usuário deseja analisar eventos de um recorte específico do hospital.  
**Ação:** O sistema permite filtragem por: unidade, especialidade, tipo de evento, período (data inicial e final), status/situação.  
**Resultado:** O conjunto de eventos exibido é restrito ao filtro aplicado, com atualização dos KPIs correspondentes.  
**Avaliação:** Cada combinação de filtros deve retornar resultados consistentes com os dados das views.

---

### RF004 – Painel de KPIs Assistenciais e Operacionais

**Contexto:** Um gestor acessa o painel de indicadores de uma unidade ou especialidade.  
**Ação:** O sistema calcula e exibe KPIs parametrizados pelo filtro ativo.  
**Resultado:** Conjunto de indicadores com valores numéricos e tendência (ex: tempo médio, volume, taxa de realização).  
**Avaliação:** Os valores calculados devem coincidir com consultas SQL manuais nas views originais do AGHU (validação com DBA).

**KPIs obrigatórios no MVP:**

| Código | Indicador | Entidade(s) | Fórmula Base |
|---|---|---|---|
| KPI-01 | Tempo médio prontuário → 1º evento | Prontuários + qualquer | `AVG(ts_1º_evento - ts_abertura_prontuario)` |
| KPI-02 | Taxa de prontuários inertes | Prontuários | `COUNT(sem_evento) / COUNT(total)` |
| KPI-03 | Tempo médio agendamento → realização (consulta) | Consultas | `AVG(ts_realizacao - ts_agendado)` |
| KPI-04 | Taxa de não realização (consultas) | Consultas | `COUNT(nao_realizado) / COUNT(total)` |
| KPI-05 | Tempo médio solicitação → realização (exame) | Exames | `AVG(ts_realizacao - ts_solicitacao)` |
| KPI-06 | Tempo médio de internação | Internações + Altas | `AVG(ts_alta_administrativa - ts_internacao)` |
| KPI-07 | Volume de eventos por período/unidade/especialidade | Todas | `COUNT(eventos) GROUP BY filtro` |
| KPI-08 | Tempo médio de permanência na LEC | Cirurgias | `AVG(ts_mapa_cirurgico - ts_insercao_lec)` |
| KPI-09 | Proporção de encaminhamentos por tipo | Consultas | `COUNT(por_tipo) / COUNT(total)` |
| KPI-10 | Gargalos recorrentes (ranking de tempo de espera) | Exames, Internações, LEC | `AVG(tempo_espera) DESC por categoria` |

---

### RF005 – Identificação de Gargalos

**Contexto:** O sistema detecta automaticamente etapas da jornada com tempos de espera acima de limiares pré-definidos.  
**Ação:** O sistema classifica etapas da jornada por tempo médio de espera e destaca as com maior impacto.  
**Resultado:** Ranking de gargalos por tipo de evento, unidade e especialidade.  
**Avaliação:** Os gargalos identificados devem corresponder às etapas com maior `AVG(tempo_espera)` nos dados.

---

### RF006 – Análise de Fluxos Predominantes

**Contexto:** Um gestor deseja entender quais caminhos da jornada são mais frequentes.  
**Ação:** O sistema agrupa sequências de eventos em padrões de jornada (ex: prontuário → consulta → exame → internação → alta).  
**Resultado:** Visualização dos fluxos mais frequentes com volume e proporção.  
**Avaliação:** Os fluxos exibidos devem ser derivados dos dados reais das views.

---

### RF007 – Painel de Prontuários Inertes

**Contexto:** Gestores da regulação interna precisam identificar prontuários criados sem eventos subsequentes.  
**Ação:** O sistema filtra prontuários sem nenhum evento registrado nas demais views após a abertura.  
**Resultado:** Lista e indicador de volume/percentual de prontuários inertes por período.  
**Avaliação:** Um prontuário é considerado inerte se não há registro em nenhuma outra view após sua criação.

---

### RF008 – Extração e Atualização Batch dos Dados

**Contexto:** O sistema precisa manter os dados analíticos atualizados diariamente.  
**Ação:** Um processo automatizado extrai os dados das 7 views do AGHU e os carrega no repositório analítico.  
**Resultado:** Repositório analítico atualizado com os eventos do dia anterior.  
**Avaliação:** A extração deve ser concluída sem erros e o repositório deve refletir a última janela temporal.

---

## 2. Requisitos Não Funcionais (RNF)

### RNF001 – Desempenho

- Consultas a dashboards com filtros simples (por unidade/período) devem retornar em até **5 segundos**.
- A pipeline ETL batch deve ser concluída em até **4 horas** após a janela de extração.

### RNF002 – Disponibilidade

- O sistema deve estar disponível durante o horário operacional do HC-UFPE (7h–22h, dias úteis).
- A manutenção da pipeline batch deve ocorrer fora do horário de pico.

### RNF003 – Segurança e Conformidade LGPD

- O sistema utiliza exclusivamente `paciente_id` (nº do prontuário) como identificador, sem exposição de nome, CPF ou dados pessoais diretos.
- O acesso ao banco do AGHU é **read-only**, via conexão controlada e autenticada.
- Todas as consultas realizadas por usuários devem ser registradas em **log de auditoria imutável**.
- Controle de acesso por perfil (RBAC): perfil assistencial e perfil de gestão com permissões distintas.

### RNF004 – Manutenibilidade

- As views do AGHU são a única interface de integração; mudanças no banco do AGHU devem impactar apenas a camada de ETL.
- O modelo de dados analítico deve ser documentado e versionado.
- Novos KPIs devem ser adicionados sem alteração da arquitetura base.

### RNF005 – Rastreabilidade

- Cada registro no repositório analítico deve preservar os IDs de origem (`paciente_id`, `consulta_id`, `exame_id`, etc.) para rastreabilidade até a fonte.
- Os KPIs calculados devem ter suas regras de cálculo documentadas e versionadas.

### RNF006 – Escalabilidade

- A arquitetura deve suportar a adição de novas entidades e views sem redesenho da solução.
- O repositório analítico deve suportar crescimento de volume de dados por pelo menos 3 anos.
