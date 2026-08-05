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

### Resolvidas / decididas (2ª reunião HC — 2026-06-26)

> Detalhe completo e plano de execução em [docs/plans/2026-06-26-roadmap-pos-reuniao-hc.md](plans/2026-06-26-roadmap-pos-reuniao-hc.md).

| Tema | Decisão HC |
| --- | --- |
| **Exames são no mesmo dia** | Exame regulado é realizado no mesmo dia da solicitação (explica KPI-05 ≈ 0). KPI-05 mantém solicitação→realização, escopado por grupos executores; avaliar "tempo até o laudo" (`data_hora_liberacao`) como complementar. |
| **Alta médica × saída efetiva** | Confirmado que **existem as duas datas** (alta médica e saída efetiva do leito); o gap importa (obstetrícia — mãe segue no leito com o bebê). **Meta HC: 4h.** Vira sub-métrica do KPI-07. Achar a coluna real da alta médica em `vw_internacoes` (hoje `dthr_fim` é proxy das duas). |
| **Escopo dos KPIs por tipo de unidade** | KPI-01/03 só ambulatórios; KPI-05 só grupos executores de exame (+ filtro por unidade executora); KPI-06/07 só internação. |
| **Filtros** | Necessário filtrar por **grupo** e por **unidade executora**. |
| **Gargalos** | Pouco claro o que mede → adicionar **filtro por métrica**. |
| **KPIs sem número** | Por ora mostrar só a **descrição** do que cada KPI mede. |
| **Novos indicadores** | Lista de indicadores operacionais (contagens/percentuais) — ver roadmap seção B. |

### Resultados do spike de dados (Fase 0 — 2026-06-26)

| Item | Resultado | Veredito |
| --- | --- | --- |
| **Alta médica (2ª data)** | `vw_internacoes` só tem **`dthr_inicio` e `dthr_fim`** — **não há** uma 2ª coluna de timestamp para a alta médica. O tipo de alta é categórico (`descricao_tipo_alta_medica`: "ALTA MÉDICA", "ALTA DA MÃE - PUÉRPERA E PERMANÊNCIA DO RECÉM-NASCIDO" 7.417, "ALTA DA MÃE - PUÉRPERA E DO RECÉM-NASCIDO" 6.143…). | ❌ **KPI-07 sub-métrica (alta→saída, 4h) NÃO é computável** com este export — falta o timestamp da alta médica. **Re-solicitar ao HC** a coluna de data/hora da alta médica (ou pegar do AGHU na Fase 5). Dá pra **identificar** os casos de permanência obstétrica pela categoria de alta, mas não medir o gap em horas. |
| **Tipo de consulta** | `Condição do Atendimento` traz exatamente: **RETORNO** (121k), **INTERCONSULTA** (13k), **CONSULTA REGULADA** (4.4k), SESSÃO, TELEATENDIMENTO, PRIMEIRA CONSULTA… E **já está mapeado** no fato em `tipo_evento` (mapper de consulta). | ✅ Viável — % por tipo sai direto de `tipo_evento`. |
| **UTI** | Identificável por `unf_descricao` contendo "UTI": UTI CLINICA, UTI NEONATAL, UTI ADULTO (+ inativas). | ✅ Viável via `unidade`. |
| **Parto** | `vw_cirurgias.Procedimento Realizado` traz "OPERACAO CESARIANA…", "PARTO NORMAL…" (~7,6% da amostra). `Tipo do Procedimento` = CIRURGIA/PDT. | ✅ Viável — mas `Procedimento Realizado` **ainda não é mapeado** no fato; precisa mapear. |
| **`data_hora_liberacao`** (exames) | Preenchida em apenas **~38%** das linhas (realização = 100%). | ⚠️ Indicador "tempo até o laudo" viável, mas só cobre ~38% — documentar a limitação. |
| **`grupo` no DB real** | NULL em todas as linhas (ETL da F1 anterior à coluna). | ⚠️ **Popular** via `UNIDADE_PARA_GRUPO` (UPDATE ou re-ETL) — pré-requisito de Fase 1. |

### Pendências remanescentes
1. **Timestamp da alta médica** — ✅ **RESOLVIDO (2026-06-26).** O HC entregou novo export com `dthr_alta_medica` e `dt_saida_paciente` (preenchidos em 99,9%). Arquivo: `CSV-aghu/vw_pacientes_anonimizado_v2.csv` — **atenção: o nome diz "pacientes", mas o conteúdo é `vw_internacoes` v2** (mesmo schema de internações + as 2 colunas novas). Spike: 17,3% das internações têm gap saída−alta > 0 (gap médio 2,44h) → **sub-métrica do KPI-07 (alta→saída, meta 4h) agora viável**. Pendente: apontar o ETL de internações para este arquivo, remapear (`dthr_alta_medica`→`timestamp_alta_medica`, `dt_saida_paciente`→`timestamp_alta_administrativa`), re-rodar e implementar a sub-métrica.
2. **Cancelamentos** (sugestão NIR): ⚠️ confirmar o estado de cancelamento de **consultas** (amostra só trouxe "MARCADA"); exames (`CANCELADO`) e cirurgias (`cancelada=1`/`CANC`) já confirmados.
3. **Consistência de prontuário em escala** — confirmar após carga completa.

> Decisão (2026-06-26): o bucket de unidades de apoio não classificadas chama-se **"Serviços de Apoio"** (antes "Outros").

---

## 8. Observações operacionais (Task 17 — smoke real CSVs)

Smoke test contra os 5 CSVs reais com `--sample 1000` por view, segunda execução idempotente (commit `35cffd2`):

- ✅ Pipeline completo: 7 `tipo_entidade` (PRONTUARIO, CONSULTA, PROCEDIMENTO, EXAME, INTERNACAO, ALTA, CIRURGIA)
- ✅ Idempotência: rerun NÃO duplica registros
- ✅ 0 rejeições no top-1000 de cada view
- ⚠️ **Dedup via upsert observada**:
  - `vw_cirurgias`: read=1000, loaded=1000, mas apenas **648 distintos em `fato_eventos_jornada`** → ~35% dos `cirurgia_id` aparecem mais de uma vez nas primeiras 1000 linhas. Hipótese: múltiplos registros por cirurgia no AGHU (entrada/saída sala, anestesia, etc.) — o upsert por `evento_id = "X-{cirurgia_id}"` mantém o último. Em produção isso pode mascarar histórico/atualização — investigar antes de KPIs cirúrgicos na F2.
  - `vw_consultas`: read=1000, loaded=1000, mas **956 distintos** (44 colisões em `num_consulta`). Mesma natureza.
- 💡 Implicação para F2 (KPIs): a interpretação de "1 evento = 1 linha no fato" pode estar OK, mas precisamos confirmar com HC se as duplicatas representam (a) o mesmo evento atualizado várias vezes, (b) eventos distintos com mesmo ID, ou (c) outro artefato de exportação.

## 9. Volumes finais (Task 18 — ETL completo)

ETL completo executado contra os 685 MB em **~10 minutos** (commit `eeb25ee`). Total carregado: **2.261.659 eventos** sobre **389.736 pacientes distintos**.

| `tipo_entidade` | Volume final | View origem | rows_read | rejected (%) | Observação |
|---|---:|---|---:|---:|---|
| EXAME | 979.847 | vw_exames | 980.852 | 0,10% | OK |
| PROCEDIMENTO | 407.805 | vw_consultas (tipo=PROC) | (parte de 766.855) | — | combinada com CONSULTA |
| PRONTUARIO | 354.790 | vw_pacientes | 357.345 | 0,72% | maior rejection rate (~2.5k linhas) |
| CONSULTA | 167.578 | vw_consultas (tipo=CONS) | (parte de 766.855) | 0,06% | menor que PROCEDIMENTO no dataset |
| INTERNACAO | 162.078 | vw_internacoes | 162.182 | 0,06% | OK |
| ALTA | 161.816 | vw_internacoes (derivada) | — | — | < INTERNACAO ✓ (algumas em curso) |
| CIRURGIA | 27.745 | vw_cirurgias | 40.954 | 0,05% | dedup pesado (32% colidem por cirurgia_id) |

### Achados que afetam o trabalho da Fase 2 (KPIs)

1. **Dedup pesado de `vw_consultas` (~25%)**: 766.855 linhas no CSV → 575.383 distintos em `fato`. Confirma o achado da Task 17. Investigar se `num_consulta` é único por linha no AGHU ou se duplicatas legítimas (atendimento + procedimento linkados).

2. **Dedup pesado de `vw_cirurgias` (~32%)**: 40.934 linhas carregadas → 27.745 distintos. Hipótese: múltiplos registros por cirurgia (entrada/saída sala, anestesia). Decidir antes de KPI cirúrgicos: manter última linha (atual) ou agregar.

3. **EXAME cobre só ~5 meses (jan-mai 2026) — INVESTIGADO 2026-06-12: corte de exportação, NÃO é bug.** Varredura streaming do CSV bruto `vw_exames_anonimizado.csv` (980.852 linhas) confirmou que **100% dos `data_hora_solicitacao` estão em 2026** (jan–mai), com **zero valores vazios**. O mapper lê a coluna correta (`data_hora_solicitacao` → `timestamp_principal`) e não descarta linhas por data nula. A diferença CSV 980.852 → fato 979.847 (~1.005 linhas, 0,10%) vem dos outros guards (`paciente_prontuario`/`exame_id`/`atendimento_id` ausentes), não de filtro temporal.
   - **Implicação para KPI-05:** NÃO está bloqueado — `data_hora_realizacao` também é 100% preenchida em 2026, então solicitação→realização é calculável. **Caveat único:** janela de apenas ~4,5 meses (sem cross-year, sem sazonalidade). Documentar essa limitação no card do KPI-05 e na UI.
   - **Ação HC:** confirmar se o export futuro pode incluir anos anteriores de exames (continua como pendência §7, mas não bloqueia F2).

4. **23.673 CONSULTAs com timestamp futuro** (≥ 2026-07-01 até 2027-05-25): agendamentos não realizados. KPI-03 (agendamento → realização) deve filtrar `timestamp_realizacao IS NOT NULL`.

5. **Índices recomendados antes de F2**: `(paciente_id, timestamp_principal)` para KPI-01 e KPI-06 (cross-patient temporal queries). Já temos `paciente_id` indexado isoladamente e o composto `ix_fato_filtros` — pode ser suficiente; medir antes de adicionar.

## 10. Bugs detectados durante implementação

Registro de bugs encontrados pelos testes de integração (Task 16) e corrigidos no commit `1b978a4`:

1. **Idempotência do EXAME mapper**: O closure `_make_exame_mapper()` era instanciado uma única vez em escopo de módulo (na constante `VIEWS`). Em execuções subsequentes de `run_etl()`, o counter persistia do estado anterior — produzindo `evento_id`s diferentes para as mesmas linhas (ex.: `E-LDL-2450336-4` em vez de `E-LDL-2450336-1`). Resultado: rerun duplicava registros. **Correção:** `VIEWS` agora é construída por invocação via `_build_views()`, garantindo counter zerado a cada `run_etl()`.

2. **Upsert com dicts heterogêneos**: `sqlite_insert(FatoEvento).values(batch)` exige que todos os dicts no batch tenham o mesmo conjunto de chaves. Mas INTERNACAO inclui `timestamp_alta_medica` e ALTA omite — quando ambos estavam no mesmo batch, SQLAlchemy levantava `CompileError`, abortando a view inteira. **Correção:** `_upsert_batch` agora normaliza cada dict para o conjunto completo de colunas de `FatoEvento` (preenchendo ausentes com `None`).

Ambos os bugs ficaram silenciosos até o pipeline rodar end-to-end com dados representando todas as entidades — exatamente o que os testes de integração precisavam exercitar.

## 11. Semântica dos números da Ciclicidade (investigação 2026-07-30, pós-reunião HC)

Investigação na base real (`pija_demo.db`, 2.264.504 eventos) para responder "o que significam os números do grafo":

1. **1 linha em `fato_eventos_jornada` = 1 evento.** Por `tipo_entidade`: EXAME 979.847 · PROCEDIMENTO 407.805 ·
   PRONTUARIO 354.790 · CONSULTA 167.578 · INTERNACAO 163.484 · ALTA 163.255 · CIRURGIA 27.745.
2. **Para EXAME, 1 linha = 1 *item* de exame** — o ETL usa `exame_id` = código do exame (ex.: LDL), não um id único
   por linha. Um painel laboratorial (hemograma + glicose + LDL…) solicitado de uma vez vira várias linhas com o
   mesmo horário de solicitação.
3. **O número na aresta do grafo = nº de TRANSIÇÕES** (pares evento→próximo-evento consecutivos por paciente),
   não o total de eventos.
4. **EXAME→EXAME = ~926k com tempo médio ~1h é em boa parte artefato do item 2**: itens do mesmo pedido, minutos
   entre si, contam cada um como uma transição.

**Decisão (travada com o usuário em 2026-07-30):** manter o comportamento e **explicar** na UI (Metodologia +
nota na tela de Ciclicidade). Não colapsar itens de exame no ETL por ora.

---

## 12. `data_hora_realizacao` de `vw_exames` é inconsistente (investigação 2026-08-05)

Investigação motivada por uma pergunta do time do HC — *"não faz mais sentido ser da solicitação
até a liberação (e não realização)?"*. Medido no `pija_demo.db` (2,26M eventos, mesmo dado que está
em produção):

| Medida | solicitação → **realização** | solicitação → **liberação** |
|---|---|---|
| pares com os dois timestamps | 979.847 | 440.855 |
| descartados pela guarda `fim >= início` | **599.647 (61,2%)** | **0 (0,0%)** |
| `n` válido | 380.200 | 440.855 |
| mediana | **0,00 h** | 9,23 h |

**Em 61,2% das linhas, `data_hora_realizacao` é anterior a `data_hora_solicitacao`** — o exame
apareceria como realizado antes de ser pedido. Não é ruído de borda: é a maioria. A guarda do
`.sql` do KPI-05 descartava essas linhas **em silêncio**, e a mediana do que sobrava era zero — o
dashboard exibia "< 1 min" para o tempo de exame.

A inversão **não é específica de laboratório**: os 557 exames não-laboratoriais (0,06% do total,
todos sob o `tipo_evento` `Imagem / Outros`) têm exatamente a mesma taxa de 61,2%.

Por contraste, `data_hora_liberacao` é confiável: preenchido em correspondência **1 para 1** com
`situacao = 'LIBERADO'` (440.855 = 440.855), e nenhuma outra situação (`A COLETAR`, `A EXECUTAR`,
`AGENDADO`, `CANCELADO`, `EM COLETA`, `COLETADO`) tem liberação preenchida.

**Consequência:** o KPI-05 passou a medir solicitação → liberação — ver
[spec 2026-08-05-kpi-05-liberacao-design.md](superpowers/specs/2026-08-05-kpi-05-liberacao-design.md).

**Em aberto, para levar ao HC:** o que `data_hora_realizacao` realmente contém? Ou o campo não
significa "quando o exame foi realizado", ou há problema na carga da view. Importa para qualquer
indicador futuro que pense em usar esse campo.

**Nota de cobertura:** 45% dos exames nunca foram liberados (446.377 em `A COLETAR`, mais
`A EXECUTAR`, `AGENDADO`, `CANCELADO`). É o denominador correto para tempo de resposta — só se mede
duração do que terminou — mas gera viés de sobrevivência: um exame parado há dois anos contribui
com zero para o KPI.

## 9. Próximos passos

1. Executar Fase 0 (Scaffold) e Fase 1 (ETL CSV → SQLite) conforme [docs/plans/2026-05-29-fase-0-1-implementation.md](plans/2026-05-29-fase-0-1-implementation.md)
2. Levar pendências do §7 para a reunião do dia
3. Iterar mapeamento se HC trouxer correções
