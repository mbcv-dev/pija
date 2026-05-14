# 04 – Modelo de Dados

**Projeto:** PIJA – Plataforma Integrada da Jornada Assistencial  
**Referência:** Perspectiva Assistencial | HC-UFPE · CIn-UFPE | IESI 2026.1

---

## 1. Visão Geral

O modelo de dados da PIJA é composto por duas camadas:

1. **Camada de Origem (AGHU):** 7 views SQL padronizadas, extraídas em modo read-only do banco do AGHU.
2. **Camada Analítica (Repositório Intermediário):** tabelas normalizadas no repositório analítico da PIJA, populadas via pipeline ETL batch.

---

## 2. Views de Origem – AGHU

Todas as views seguem as convenções:
- Uma linha por ocorrência (evento/gravação)
- `paciente_id` = número do prontuário (somente)
- Timestamps completos: data e hora (`TIMESTAMP`)
- Campos opcionais marcados com `(se existir)` — **a disponibilizar validar com o DBA do HC-UFPE**

### vw_prontuarios_criados

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| paciente_id | VARCHAR | ✓ | Número do prontuário |
| data_hora_abertura_prontuario | TIMESTAMP | ✓ | Momento de criação do prontuário |
| unidade_criadora | VARCHAR | ✓ | Unidade do usuário que criou |
| usuario_criador | VARCHAR | ✓ | Identificador do usuário criador |
| perfil_criador | VARCHAR | | Perfil do usuário criador (se existir) |

### vw_consultas

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| paciente_id | VARCHAR | ✓ | Número do prontuário |
| consulta_id | VARCHAR | ✓ | Identificador único da consulta |
| condicao_atendimento | VARCHAR | ✓ | Ex: Regulada, Retorno, Teletriagem, Interconsulta |
| grade | VARCHAR | | Grade de atendimento |
| especialidade | VARCHAR | ✓ | Especialidade médica |
| unidade | VARCHAR | ✓ | Unidade executora |
| data_hora_agendamento | TIMESTAMP | | Momento em que foi agendada |
| data_hora_agendado | TIMESTAMP | | Data/hora marcada para a consulta |
| data_hora_realizacao | TIMESTAMP | | Data/hora de realização (ou ausência = não realizada) |
| especialidade_solicitante | VARCHAR | | Para interconsultas (se houver) |
| situacao | VARCHAR | | Status da consulta (se existir) |

### vw_exames

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| paciente_id | VARCHAR | ✓ | Número do prontuário |
| exame_id | VARCHAR | ✓ | Identificador único do exame |
| tipo_exame | VARCHAR | ✓ | Categoria/tipo do exame |
| data_hora_solicitacao | TIMESTAMP | ✓ | Momento da solicitação |
| data_hora_agendamento | TIMESTAMP | | Momento do agendamento (se houver) |
| data_hora_coleta | TIMESTAMP | | Momento da coleta (quando aplicável) |
| data_hora_realizacao | TIMESTAMP | | Momento da realização |
| data_hora_liberacao | TIMESTAMP | | Momento da liberação do resultado |
| unidade_executora | VARCHAR | ✓ | Unidade que executa o exame |
| especialidade_solicitante | VARCHAR | | Especialidade que solicitou |
| grade | VARCHAR | | Grade do exame |
| condicao_exame | VARCHAR | | Ex: Regulado (se existir) |
| situacao | VARCHAR | ✓ | Ex: pendente / realizado / cancelado |

### vw_internacoes

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| paciente_id | VARCHAR | ✓ | Número do prontuário |
| internacao_id | VARCHAR | ✓ | Identificador único da internação |
| data_hora_solicitacao | TIMESTAMP | | Momento da solicitação (se existir) |
| data_hora_agendamento | TIMESTAMP | | Momento do agendamento (se existir) |
| data_hora_internacao | TIMESTAMP | ✓ | Momento da internação efetiva |
| especialidade_internacao | VARCHAR | ✓ | Especialidade responsável |
| unidade_internacao | VARCHAR | ✓ | Unidade de internação |
| CID_principal | VARCHAR | | CID da internação |
| situacao | VARCHAR | | Status (se existir) |

### vw_cirurgias

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| paciente_id | VARCHAR | ✓ | Número do prontuário |
| cirurgia_id | VARCHAR | ✓ | Identificador único da cirurgia |
| cirurgia_codigo | VARCHAR | ✓ | Código do procedimento cirúrgico |
| cirurgia_nome | VARCHAR | ✓ | Nome do procedimento cirúrgico |
| especialidade_cirurgica | VARCHAR | ✓ | Especialidade cirúrgica |
| sala | VARCHAR | | Sala cirúrgica |
| data_hora_insercao_lec_antigos | TIMESTAMP | | Inserção na LEC (pacientes antigos) |
| data_hora_insercao_lec_novos | TIMESTAMP | | Inserção na LEC (pacientes novos) |
| data_hora_lista_pre_op_agendado | TIMESTAMP | | Entrada na lista pré-op agendado |
| data_hora_lista_pre_op_realizado | TIMESTAMP | | Entrada na lista pré-op realizado |
| data_hora_mapa_cirurgico | TIMESTAMP | | Entrada no mapa cirúrgico |
| data_hora_inicio_anestesia | TIMESTAMP | | Início da anestesia (nota de consumo) |
| data_hora_fim_anestesia | TIMESTAMP | | Fim da anestesia (nota de consumo) |
| situacao | VARCHAR | | Status da cirurgia |

### vw_procedimentos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| paciente_id | VARCHAR | ✓ | Número do prontuário |
| procedimento_id | VARCHAR | ✓ | Identificador único |
| procedimento_codigo | VARCHAR | ✓ | Código do procedimento |
| procedimento_nome | VARCHAR | ✓ | Nome do procedimento |
| especialidade | VARCHAR | ✓ | Especialidade |
| sala | VARCHAR | | Sala |
| data_hora_insercao_lec_antigos | TIMESTAMP | | Inserção na LEC (antigos) |
| data_hora_insercao_lec_novos | TIMESTAMP | | Inserção na LEC (novos) |
| data_hora_lista_pre_op_agendado | TIMESTAMP | | Lista pré-op agendado |
| data_hora_lista_pre_op_realizado | TIMESTAMP | | Lista pré-op realizado |
| data_hora_mapa | TIMESTAMP | | Entrada no mapa |
| data_hora_inicio_anestesia | TIMESTAMP | | Início anestesia (se houver) |
| data_hora_fim_anestesia | TIMESTAMP | | Fim anestesia (se houver) |
| situacao | VARCHAR | | Status |

### vw_altas

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| paciente_id | VARCHAR | ✓ | Número do prontuário |
| internacao_id | VARCHAR | ✓ | Internação correspondente |
| grade | VARCHAR | | Grade |
| especialidade | VARCHAR | ✓ | Especialidade |
| unidade | VARCHAR | ✓ | Unidade |
| data_hora_alta_medica | TIMESTAMP | ✓ | Alta médica (sumário; leito ainda contabilizado) |
| data_hora_alta_administrativa | TIMESTAMP | ✓ | Alta administrativa (leito efetivamente liberado) |
| tipo_alta | VARCHAR | ✓ | Ex: alta clínica, transferência, óbito |

---

## 3. Tabela Consolidada – Repositório Analítico

A tabela central do repositório analítico é a `fato_eventos_jornada`, que unifica todos os eventos das 7 entidades em uma estrutura flat:

### fato_eventos_jornada

| Campo | Tipo | Descrição |
|---|---|---|
| evento_id | VARCHAR (PK) | Identificador único do evento (gerado internamente) |
| paciente_id | VARCHAR | Número do prontuário |
| tipo_entidade | VARCHAR | Enum: PRONTUARIO, CONSULTA, EXAME, INTERNACAO, CIRURGIA, PROCEDIMENTO, ALTA |
| entidade_id | VARCHAR | ID de origem na view (consulta_id, exame_id, etc.) |
| timestamp_principal | TIMESTAMP | Timestamp de referência para ordenação cronológica |
| timestamp_solicitacao | TIMESTAMP | Quando aplicável (exames, internações) |
| timestamp_agendamento | TIMESTAMP | Quando aplicável |
| timestamp_realizacao | TIMESTAMP | Quando aplicável |
| timestamp_liberacao | TIMESTAMP | Para exames |
| timestamp_alta_medica | TIMESTAMP | Para altas |
| timestamp_alta_administrativa | TIMESTAMP | Para altas |
| unidade | VARCHAR | Unidade executora/criadora |
| especialidade | VARCHAR | Especialidade |
| tipo_evento | VARCHAR | Subtipo (ex: regulada, retorno, interconsulta, pré-op) |
| situacao | VARCHAR | Status do evento |
| dt_carga | TIMESTAMP | Data/hora da carga no repositório (ETL) |

### dim_unidade

| Campo | Tipo | Descrição |
|---|---|---|
| unidade_id | VARCHAR (PK) | Código da unidade |
| nome_unidade | VARCHAR | Nome da unidade |
| area | VARCHAR | Área: Ambulatório, Diagnóstico, Internação, Centro Cirúrgico |

### dim_especialidade

| Campo | Tipo | Descrição |
|---|---|---|
| especialidade_id | VARCHAR (PK) | Código da especialidade |
| nome_especialidade | VARCHAR | Nome da especialidade |
| tipo | VARCHAR | Clínica, Cirúrgica, Diagnóstico |

---

## 4. Regras de Integridade

1. Todo registro em `fato_eventos_jornada` deve ter `paciente_id` não nulo.
2. O `timestamp_principal` nunca pode ser nulo — quando o timestamp principal de uma entidade não existe, o registro não deve ser carregado (registrar como erro no log ETL).
3. Registros duplicados (mesmo `entidade_id` + `tipo_entidade`) devem ser rejeitados na carga.
4. Soft delete: registros cancelados ou inválidos recebem flag `situacao = 'CANCELADO'` — não são excluídos fisicamente.
5. O campo `dt_carga` permite rastrear a janela de extração de cada registro.

---

## 5. Campos a Validar com o DBA do HC-UFPE

> ⚠️ Os itens abaixo são críticos e podem impactar KPIs. Devem ser confirmados antes do desenvolvimento da pipeline ETL.

- Disponibilidade de `situacao/status` em vw_consultas, vw_exames, vw_internacoes
- Disponibilidade de `data_hora_agendamento` em vw_consultas e vw_exames
- Disponibilidade de `data_hora_solicitacao` em vw_internacoes
- Consistência do `paciente_id` entre módulos do AGHU (mesmo nº de prontuário em todas as views)
- Disponibilidade e estrutura dos campos da LEC em vw_cirurgias
- Campos `perfil_criador` em vw_prontuarios_criados
- Campos `especialidade_solicitante` em vw_consultas e vw_exames
