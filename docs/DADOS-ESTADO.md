# Estado dos Dados — CSVs anonimizados do AGHU

**Data:** 2026-06-01
**Origem:** CSVs entregues pelo HC-UFPE via WhatsApp (Daniel Turmina, 2026-06-02)
**Diretório local:** `CSV-aghu/` (não versionado — `.gitignore`)

Este documento descreve o estado **real** dos dados (não a spec idealizada) e registra as decisões de mapeamento para o ETL da Fase 1.

---

## 1. Visão geral dos arquivos

| Arquivo                          |    Tamanho | Linhas (incl. header) | Colunas | Entidades cobertas                                         |
| -------------------------------- | ---------: | --------------------: | ------: | ---------------------------------------------------------- |
| `vw_pacientes_anonimizado.csv`   |      53 MB |               357.346 |      21 | PRONTUARIO                                              |
| `vw_consultas_anonimizado.csv`   |     290 MB |               766.856 |      36 | CONSULTA + PROCEDIMENTO (split por coluna `tipo`)       |
| `vw_exames_anonimizado.csv`      |     275 MB |               980.853 |      23 | EXAME                                                   |
| `vw_internacoes_anonimizado.csv` |      47 MB |               162.183 |      30 | INTERNACAO + ALTA (derivada)                            |
| `vw_cirurgias_anonimizado.csv`   |      18 MB |                41.059 |      57 | CIRURGIA (PDT mantido como subtipo via `tipo_evento`)   |
| **TOTAL**                        | **685 MB** |            **~2.3 M** |       — | 7 entidades cobertas com 5 arquivos                     |

Mapeamento spec → realidade (confirmado com Daniel Turmina/HC na reunião de 29-05-2026):

- `vw_prontuarios_criados` da spec ⇒ **`vw_pacientes_anonimizado`**
- `vw_altas` da spec ⇒ **derivada de `vw_internacoes`** (`dthr_fim` + `descricao_tipo_alta_medica`) — Daniel confirmou que **a tabela de altas não existe nem é necessária**, dados estão diretamente em Internações
- `vw_procedimentos` da spec ⇒ **embutida em `vw_consultas`** (linhas com coluna `tipo = PROCEDIMENTO`, 79% das consultas no sample) — Daniel: "procedimentos estão pulverizados dentro das tabelas de Consultas. Extrair direto do histórico de consultas"

---

## 2. Formato e codificação

| Aspecto                  | Valor                                                                     |
| ------------------------ | ------------------------------------------------------------------------- |
| **Encoding**             | UTF-8 (sem BOM) — confirmado por inspeção byte-a-byte (`0xC3 0xA1` = `á`) |
| **Separador**            | `,` (vírgula)                                                             |
| **Quote character**      | `"` (padrão CSV)                                                          |
| **Newline**              | `\r\n` (Windows)                                                          |
| **Nulos**                | Célula vazia (sem `NULL`, `N/A`, `\N`)                                    |
| **Formato de data/hora** | `DD/M/YYYY, HH:MM` — formato BR, **NÃO** ISO 8601                         |
| **Formato numérico**     | Milhar com `.` (ex: `1.458.992`), decimal com `,` (ex: `0,01042`)         |

⚠️ Implicação para o ETL: o parser precisa converter datas e números BR antes de inserir no SQLite. Não dá pra usar `pd.read_csv(parse_dates=...)` direto.

---

## 3. Inconsistência de nomenclatura

Os mesmos conceitos têm nomes diferentes em cada view. Tabela canônica das colunas-chave:

| Conceito                | vw_pacientes          | vw_consultas                       | vw_exames                        | vw_internacoes               | vw_cirurgias         |
| ----------------------- | --------------------- | ---------------------------------- | -------------------------------- | ---------------------------- | -------------------- |
| Nº do prontuário (join) | `prontuario`          | `Prontuario`                       | `paciente_prontuario`            | `prontuario`                 | `Prontuário`         |
| ID interno do paciente  | `pac_codigo`          | `ID do Paciente`                   | `paciente_id`                    | `codigo_paciente`            | `Codigo do Paciente` |
| Atendimento             | —                     | —                                  | `atendimento_id`                 | `atendimento`                | `Atendimento`        |
| ID do evento            | —                     | `num_consulta`                     | `exame_id`                       | `id_internacao`              | `cirurgia_id`        |
| Unidade                 | —                     | `Unidade Funcional`                | `unidade_executora_nome`         | `unf_descricao`              | `Unidade Funcional`  |
| Especialidade           | —                     | `especialidade`                    | `especialidade_solicitante_nome` | `esp_nome_especialidade`     | `Especialidade`      |
| Status                  | `situacao_prontuario` | `Situação da Consulta` + `Retorno` | `situacao`                       | `descricao_tipo_alta_medica` | `situacao`           |

### Decisão: chave canônica = `prontuario`

Adotamos **o número do prontuário** (campo `prontuario` / `Prontuario` / `Prontuário` / `paciente_prontuario`) como `paciente_id` canônico no `fato_eventos_jornada`. O `pac_codigo` / `ID do Paciente` / `codigo_paciente` (versão curta) **não é consistente** entre views (verificado: em internacoes há relação `prontuario = codigo_paciente × 10 + dígito`, mas em exames essa relação não vale).

---

## 4. Mapeamento CSV → `fato_eventos_jornada`

A tabela fato tem colunas: `evento_id, paciente_id, tipo_entidade, entidade_id, timestamp_principal, timestamp_solicitacao, timestamp_agendamento, timestamp_realizacao, timestamp_liberacao, timestamp_alta_medica, timestamp_alta_administrativa, unidade, especialidade, tipo_evento, situacao, dt_carga, deleted_at`.

### 4.1 PRONTUARIO (de `vw_pacientes_anonimizado.csv`)

| Coluna fato                               | Origem CSV            | Observação                        |
| ----------------------------------------- | --------------------- | --------------------------------- |
| `evento_id`                               | `f"P-{prontuario}"`   | gerado                            |
| `paciente_id`                             | `prontuario`          | normalizado: remover `.` (milhar) |
| `tipo_entidade`                           | `"PRONTUARIO"`        | constante                         |
| `entidade_id`                             | `prontuario`          |                                   |
| `timestamp_principal`                     | `data_cadastro`       | parse `DD/M/YYYY` (sem hora)      |
| `situacao`                                | `situacao_prontuario` | "Ativo" \| "Recadastro"           |
| Outros timestamps                         | NULL                  | não aplicável                     |
| `unidade`, `especialidade`, `tipo_evento` | NULL                  | não aplicável                     |

🚫 **NÃO carregar PII**: `nome_iniciais`, `nome_social_iniciais`, `nome_mae_iniciais`, `nome_pai_iniciais`, `idade`, `sexo`, `estado_civil`, `cor`, `etnia`, `grau_instrucao`, `profissao`, `naturalidade`, `logradouro`, `bairro`, `cidade`, `uf`. Guardrail "No Personal Data" do SPEC.md.

### 4.2 CONSULTA / PROCEDIMENTO (de `vw_consultas_anonimizado.csv`)

Split por coluna `tipo`:
- `tipo = "CONSULTA"` → `tipo_entidade = "CONSULTA"` (~20% das linhas no sample)
- `tipo = "PROCEDIMENTO"` → `tipo_entidade = "PROCEDIMENTO"` (~80% — procedimentos ambulatoriais)

Prefixo do `evento_id` muda: `C-...` para CONSULTA, `PA-...` para PROCEDIMENTO (PROCEDIMENTO AMBULATORIAL). Demais colunas são iguais entre os dois — só o `tipo_entidade` e o prefixo do `evento_id` diferem.

| Coluna fato             | Origem CSV                                                                       |
| ----------------------- | -------------------------------------------------------------------------------- |
| `evento_id`             | `f"C-{num_consulta}"` ou `f"PA-{num_consulta}"` (por `tipo`)                     |
| `paciente_id`           | `Prontuario` (normalizado)                                                       |
| `tipo_entidade`         | `"CONSULTA"` ou `"PROCEDIMENTO"` por coluna `tipo`                               |
| `entidade_id`           | `num_consulta`                                                                   |
| `timestamp_principal`   | `Data/Hora da Consulta`                                                          |
| `timestamp_agendamento` | `Data/Hora da Consulta`                                                          |
| `timestamp_realizacao`  | `Data/Hora de Início` (só se `Retorno = PACIENTE ATENDIDO`)                      |
| `unidade`               | `Unidade Funcional`                                                              |
| `especialidade`         | `especialidade`                                                                  |
| `tipo_evento`           | `Condição do Atendimento` (RETORNO \| INTERCONSULTA \| CONSULTA REGULADA \| ...) |
| `situacao`              | `Retorno` (PACIENTE ATENDIDO \| PACIENTE FALTOU \| ...)                          |

⚠️ A coluna `Situação da Consulta` na amostra mostrou só "MARCADA" (estado do agendamento), **não é o estado de realização**. O estado real está em `Retorno`.

### 4.3 EXAME (de `vw_exames_anonimizado.csv`)

| Coluna fato             | Origem CSV                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `evento_id`             | `f"E-{exame_id}-{atendimento_id}-{i}"` (`exame_id` é o CÓDIGO do exame tipo "LDL", não é único — precisa de chave composta) |
| `paciente_id`           | `paciente_prontuario` (normalizado)                                                                                         |
| `tipo_entidade`         | `"EXAME"`                                                                                                                   |
| `entidade_id`           | `exame_id` (mantém código do tipo)                                                                                          |
| `timestamp_principal`   | `data_hora_solicitacao`                                                                                                     |
| `timestamp_solicitacao` | `data_hora_solicitacao`                                                                                                     |
| `timestamp_agendamento` | `data_hora_agendamento`                                                                                                     |
| `timestamp_realizacao`  | `data_hora_realizacao`                                                                                                      |
| `timestamp_liberacao`   | `data_hora_liberacao`                                                                                                       |
| `unidade`               | `unidade_executora_nome`                                                                                                    |
| `especialidade`         | `especialidade_solicitante_nome`                                                                                            |
| `tipo_evento`           | `tipo_exame` (Laboratorial SANGUE \| Laboratorial URINA \| ...)                                                             |
| `situacao`              | `situacao` (A COLETAR \| LIBERADO \| ...)                                                                                   |

### 4.4 INTERNACAO (de `vw_internacoes_anonimizado.csv`)

| Coluna fato                     | Origem CSV                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `evento_id`                     | `f"I-{id_internacao}"`                                                               |
| `paciente_id`                   | `prontuario`                                                                         |
| `tipo_entidade`                 | `"INTERNACAO"`                                                                       |
| `entidade_id`                   | `id_internacao`                                                                      |
| `timestamp_principal`           | `dthr_inicio`                                                                        |
| `timestamp_alta_administrativa` | `dthr_fim` (saída física do leito)                                                   |
| `timestamp_alta_medica`         | `dthr_fim` (proxy — **não há campo separado nas 30 colunas verificadas**)            |
| `unidade`                       | `unf_descricao`                                                                      |
| `especialidade`                 | `esp_nome_especialidade`                                                             |
| `tipo_evento`                   | `descricao_origem_evento` (AMBULATORIO \| EMERGENCIA OBSTETRICA \| REGULAÇÃO \| ...) |
| `situacao`                      | `descricao_tipo_alta_medica` (ALTA MÉDICA \| OBITO \| TRANSFERÊNCIA \| ...)          |

> ⚠️ **Limitação obstetrícia (alertada por Daniel):** existem duas métricas distintas — alta médica (médico libera) vs saída física (leito liberado). Em obstetrícia, mãe recebe alta médica em ~24h mas leito é ocupado por ~48h aguardando alta do recém-nascido. **As 30 colunas verificadas não trazem timestamp separado de alta médica** — só temos `dthr_fim` (saída física). KPI-07 mede tempo de permanência no leito, **não** tempo até alta médica. Surface essa interpretação nas explicações de KPI da UI.

### 4.5 ALTA (derivada de `vw_internacoes_anonimizado.csv`)

Cada linha de internação com `dthr_fim` preenchido gera **também** um evento de tipo ALTA:

| Coluna fato                     | Origem CSV                                                |
| ------------------------------- | --------------------------------------------------------- |
| `evento_id`                     | `f"A-{id_internacao}"`                                    |
| `paciente_id`                   | `prontuario`                                              |
| `tipo_entidade`                 | `"ALTA"`                                                  |
| `entidade_id`                   | `id_internacao`                                           |
| `timestamp_principal`           | `dthr_fim`                                                |
| `timestamp_alta_administrativa` | `dthr_fim`                                                |
| `unidade`                       | `unf_descricao`                                           |
| `especialidade`                 | `esp_nome_especialidade`                                  |
| `tipo_evento`                   | `descricao_tipo_alta_medica` (categoria do desfecho)      |
| `situacao`                      | `descricao_tipo_alta_medica` (espelho simétrico com INTERNACAO — facilita filtros de UI por status) |

Decisão: gerar evento ALTA **só se `dthr_fim` não-nulo**.

### 4.6 CIRURGIA (de `vw_cirurgias_anonimizado.csv`)

**Todas** as linhas de `vw_cirurgias` viram `tipo_entidade = CIRURGIA`. O valor de `Tipo do Procedimento` (CIRURGIA ou PDT) é preservado como **subtipo** no campo `tipo_evento` junto com a Natureza, para diferenciar a natureza cirúrgica (cirurgia eletiva, urgência, PDT diagnóstico-terapêutico, etc.) sem inflar o vocabulário de `tipo_entidade`.

> **Por que mudou:** Daniel (HC) confirmou que **procedimentos ambulatoriais** estão em `vw_consultas` (coluna `tipo=PROCEDIMENTO`), não em `vw_cirurgias`. O `PDT` que aparece em cirurgias é "Procedimento Diagnóstico-Terapêutico" feito no ambiente cirúrgico — diferente conceito.

| Coluna fato             | Origem CSV                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `evento_id`             | `f"X-{cirurgia_id}"`                                                                                |
| `paciente_id`           | `Prontuário`                                                                                        |
| `tipo_entidade`         | `"CIRURGIA"` (constante)                                                                            |
| `entidade_id`           | `cirurgia_id`                                                                                       |
| `timestamp_principal`   | `data_inicio_cirurgia`                                                                              |
| `timestamp_agendamento` | `Entrada na Sala`                                                                                   |
| `timestamp_realizacao`  | `data_fim_cirurgia`                                                                                 |
| `unidade`               | `Unidade Funcional`                                                                                 |
| `especialidade`         | `Especialidade`                                                                                     |
| `tipo_evento`           | `f"{Tipo do Procedimento}/{Natureza do Agendamento}"` (ex.: `CIRURGIA/ELETIVA`, `PDT/URGÊNCIA`) |
| `situacao`              | `situacao` (RZDA \| CANC \| AGND \| ...)                                                            |

---

## 5. Impacto nos 5 KPIs do MVP

| KPI                                            | Computável?        | Fórmula real                                                                                                                                                                                                                                         |
| ---------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **KPI-01** prontuário → 1º evento              | ✅ Sim             | `MIN(timestamp_principal de outras entidades para paciente) - data_cadastro` (cross-table)                                                                                                                                                           |
| **KPI-03** agendamento → realização (consulta) | ✅ Sim             | `(Data/Hora de Início) - (Data/Hora da Consulta)` em consultas com `Retorno = PACIENTE ATENDIDO`                                                                                                                                                     |
| **KPI-05** solicitação → realização (exame)    | ✅ Sim             | `data_hora_realizacao - data_hora_solicitacao` em exames com `data_hora_realizacao` não-nulo                                                                                                                                                         |
| **KPI-06** última consulta → internação        | ✅ Sim (cross-table) | **Reformulado pela equipe:** para cada `INTERNACAO` do paciente `p` com `dthr_inicio = ti`, achar `MAX(timestamp_realizacao)` de `CONSULTA` do mesmo `p` com `timestamp_realizacao < ti`. KPI = média de `(ti - última_consulta)` para internações que têm consulta prévia |
| **KPI-07** tempo de permanência no leito       | ✅ Sim (com ressalva) | `dthr_fim - dthr_inicio` — representa **saída física**, não alta médica. Documentar na UI: "Inclui tempo entre alta médica e liberação do leito (relevante na obstetrícia)". |

---

## 6. Decisões de normalização

1. **Encoding UTF-8** — `pandas.read_csv(encoding="utf-8")`
2. **Datas BR**: parser custom — `pd.to_datetime(s, format="%d/%m/%Y, %H:%M", errors="coerce")` para timestamps com hora; `format="%d/%m/%Y"` para `data_cadastro`. Linhas com `errors="coerce"` viram `NaT` e são rejeitadas se o campo é obrigatório.
3. **IDs numéricos com `.`**: remover separador de milhar antes de armazenar como string ou int. `s.str.replace(".", "", regex=False)` para `prontuario`, `cirurgia_id`, etc.
4. **Strings vazias** → `None` no banco
5. **PII de `vw_pacientes`** → não carregar
6. **Chunked streaming**: `pd.read_csv(..., chunksize=50_000)` para todas as views, especialmente `vw_exames` (981k linhas) e `vw_consultas` (767k linhas)

---

## 7. Pendências resolvidas e novas

### Resolvidas (reunião 29-05-2026 + verificação empírica)

| Pendência original                                       | Status        | Resolução                                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KPI-06 sem `data_hora_solicitacao`                       | ✅ Resolvido  | Reformulado para "tempo médio entre **última consulta** do paciente e internação subsequente" (cross-table). Decisão da equipe.                                                                                                                                  |
| `prontuario` cruza views?                                | ✅ Verificado | Empírico: amostras pequenas (50k × 30k) mostraram 172+ interseções com vw_pacientes em todas as outras views — joins funcionam. Cobertura total será confirmada quando ETL rodar full data. Não bloqueia F1.                                                     |
| `vw_consultas.tipo=PROCEDIMENTO` são procedimentos?      | ✅ Resolvido  | Daniel confirmou: "procedimentos estão pulverizados dentro das consultas". → `tipo=PROCEDIMENTO` vira `tipo_entidade=PROCEDIMENTO`; `tipo=CONSULTA` vira `tipo_entidade=CONSULTA`.                                                                              |
| Procedimentos em `vw_cirurgias` (PDT)?                   | ✅ Resolvido  | PDT em cirurgias **NÃO** é equivalente aos procedimentos ambulatoriais — fica como subtipo cirúrgico via `tipo_evento`. Toda linha de cirurgias vira `tipo_entidade=CIRURGIA`.                                                                                  |
| Tabela de Altas separada?                                | ✅ Resolvido  | Daniel: "essa tabela não existe nem se faz necessária". Dados de alta médica e saída física estão em Internações. Mantemos ALTA derivada.                                                                                                                       |
| Histórico/corte de retenção?                             | ✅ Decisão    | Usuário: "são views fiéis ao banco do AGHU, é com isso que devamos trabalhar". Sem corte; processamos toda a janela (2015–2026).                                                                                                                                |

### Novas pendências para reunião futura

1. **Timestamp de alta médica separado**: as 30 colunas de `vw_internacoes` **não trazem** campo de timestamp para alta médica (só `dthr_fim` = saída física e `descricao_tipo_alta_medica` = categoria). Sem esse campo, **não é possível medir o gap obstetrícia** (24h alta médica vs 48h saída). Pedir ao HC inclusão na próxima exportação OU acesso direto à coluna no AGHU na Fase 5.
2. **Consistência de prontuário em escala**: confirmar empiricamente após carga completa que `prontuario` cruza 100% das views sem duplicatas. Documentar discrepâncias (se houver) em novo MD.

---

## 8. Próximos passos

1. Executar Fase 0 (Scaffold) e Fase 1 (ETL CSV → SQLite) conforme [docs/plans/2026-05-29-fase-0-1-implementation.md](plans/2026-05-29-fase-0-1-implementation.md)
2. Levar pendências do §7 para a reunião do dia
3. Iterar mapeamento se HC trouxer correções
