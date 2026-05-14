# 03 – Casos de Uso

**Projeto:** PIJA – Plataforma Integrada da Jornada Assistencial  
**Referência:** Perspectiva Assistencial | HC-UFPE · CIn-UFPE | IESI 2026.1

---

## Atores

| Ator | Descrição |
|---|---|
| **Gestor Hospitalar** | Coordenador de unidade, diretoria assistencial ou operacional. Acessa painéis agregados e KPIs por unidade/especialidade/período. |
| **Profissional Assistencial** | Médico, enfermeiro ou técnico com acesso à linha do tempo de pacientes de sua unidade. |
| **Sistema ETL** | Processo automatizado responsável pela extração batch das views do AGHU e carga no repositório analítico. |
| **AGHU** | Sistema de Gestão Hospitalar Universitário – fonte primária de dados (leitura apenas). |

---

## UC001 – Consultar Linha do Tempo da Jornada de um Paciente

**Atores:** Profissional Assistencial, Gestor Hospitalar  
**Pré-condição:** O usuário está autenticado e possui permissão de acesso à unidade do paciente.

**Contexto:** O profissional precisa entender o percurso completo de um paciente no HC-UFPE.

**Fluxo principal:**
1. O usuário informa o `paciente_id` (nº do prontuário) no campo de busca.
2. O sistema consulta o repositório analítico e recupera todos os eventos do paciente.
3. O sistema ordena os eventos cronologicamente por timestamp.
4. O sistema exibe a linha do tempo com tipo de evento, data/hora, unidade/especialidade e status.

**Fluxos alternativos:**
- 1a. O `paciente_id` não existe no repositório: o sistema exibe mensagem informativa "Nenhum evento registrado para este paciente no período disponível."
- 4a. O paciente possui eventos em múltiplas especialidades: a linha do tempo agrupa visualmente por área (ambulatório, diagnóstico, internação, cirurgia).

**Pós-condição:** O usuário visualiza a jornada cronológica completa do paciente.

**Resultado:** Timeline visual com todos os eventos registrados nas 7 entidades.  
**Avaliação:** Todos os eventos do paciente nas views devem aparecer na timeline, sem omissões ou duplicidades.

---

## UC002 – Aplicar Filtros e Analisar Volume de Eventos

**Atores:** Gestor Hospitalar, Profissional Assistencial  
**Pré-condição:** O usuário está autenticado.

**Contexto:** O gestor deseja analisar o volume de atendimentos de uma especialidade em um período específico.

**Fluxo principal:**
1. O usuário seleciona os filtros: unidade, especialidade, tipo de evento, período (data inicial e final).
2. O sistema aplica os filtros ao repositório analítico.
3. O sistema exibe: volume total de eventos, distribuição por tipo de evento e gráfico temporal.
4. Os KPIs relevantes ao filtro são recalculados e atualizados no painel.

**Pós-condição:** O usuário visualiza os dados restritos ao recorte definido.  
**Avaliação:** O volume exibido deve ser consistente com a contagem direta nas views do AGHU para o mesmo filtro.

---

## UC003 – Consultar KPIs Assistenciais e Operacionais

**Atores:** Gestor Hospitalar  
**Pré-condição:** O usuário está autenticado com perfil de gestão.

**Contexto:** O gestor quer avaliar o desempenho de uma unidade em um período.

**Fluxo principal:**
1. O usuário seleciona a unidade e o período de análise.
2. O sistema calcula os KPIs configurados (conforme RF004) para o recorte.
3. O sistema exibe os KPIs em painel visual com valores numéricos, gráficos e indicação de tendência.

**Fluxos alternativos:**
- 3a. Dados insuficientes para cálculo de um KPI: o sistema exibe "Dados insuficientes para este indicador no período selecionado."

**Pós-condição:** O gestor dispõe de indicadores de desempenho atualizados para a unidade.  
**Avaliação:** Os valores dos KPIs devem coincidir com cálculos manuais sobre as views do AGHU (validação com DBA).

---

## UC004 – Identificar Gargalos no Fluxo Assistencial

**Atores:** Gestor Hospitalar  
**Pré-condição:** O repositório analítico contém dados de pelo menos um mês de operação.

**Contexto:** O gestor quer identificar quais etapas da jornada concentram os maiores tempos de espera.

**Fluxo principal:**
1. O usuário acessa o painel de gargalos.
2. O sistema calcula o tempo médio de espera para cada transição de evento (ex: solicitação → agendamento → realização de exame).
3. O sistema exibe um ranking das etapas com maior tempo médio, segmentado por tipo de evento, unidade e especialidade.
4. O usuário pode clicar em um gargalo para detalhar os eventos que o compõem.

**Pós-condição:** O gestor identifica as etapas prioritárias para intervenção operacional.

---

## UC005 – Visualizar Fluxos Predominantes da Jornada

**Atores:** Gestor Hospitalar  
**Pré-condição:** O repositório analítico está populado com dados históricos.

**Contexto:** O gestor deseja entender os caminhos mais frequentes percorridos pelos pacientes.

**Fluxo principal:**
1. O usuário acessa o painel de análise de fluxos.
2. O sistema agrupa sequências de eventos por padrão (ex: prontuário → consulta → exame → internação → alta).
3. O sistema exibe os fluxos ordenados por frequência, com volume e proporção.

**Avaliação:** Os fluxos devem derivar dos dados reais das views, sem inferência ou imputação.

---

## UC006 – Monitorar Prontuários Inertes

**Atores:** Gestor Hospitalar, Perfil de Regulação  
**Pré-condição:** O repositório contém dados de prontuários e das demais entidades.

**Contexto:** A gestão da regulação interna precisa identificar prontuários abertos sem continuidade assistencial.

**Fluxo principal:**
1. O usuário acessa o painel de prontuários inertes.
2. O sistema identifica prontuários sem nenhum evento registrado nas demais views após a abertura.
3. O sistema exibe volume absoluto, percentual e distribuição por período e unidade criadora.

**Avaliação:** Um prontuário é inerte se `COUNT(eventos_posteriores) = 0` nas demais views após `data_hora_abertura_prontuario`.

---

## UC007 – Executar Pipeline ETL Batch (Sistema)

**Atores:** Sistema ETL  
**Pré-condição:** O AGHU está disponível e a conexão read-only está ativa.

**Contexto:** Atualização diária automática do repositório analítico.

**Fluxo principal:**
1. O Sistema ETL inicia o processo conforme agendamento (ex: 02h00).
2. Para cada uma das 7 views, o sistema extrai os registros novos ou modificados desde a última extração.
3. Os dados são normalizados (tipagem, timestamp, tratamento de nulos) e carregados no repositório analítico.
4. Os KPIs pré-calculados são atualizados.
5. O sistema registra log de execução (início, fim, volumes, erros).

**Fluxos alternativos:**
- 2a. View indisponível ou com erro: o sistema registra o erro, pula a view afetada e continua com as demais. O administrador é notificado.

**Pós-condição:** O repositório analítico reflete os dados do último dia de operação.

---

## Diagrama de Casos de Uso (Resumo)

```
[Profissional Assistencial] ──► UC001: Consultar Linha do Tempo
[Profissional Assistencial] ──► UC002: Aplicar Filtros e Analisar Volume

[Gestor Hospitalar] ──────────► UC002: Aplicar Filtros e Analisar Volume
[Gestor Hospitalar] ──────────► UC003: Consultar KPIs
[Gestor Hospitalar] ──────────► UC004: Identificar Gargalos
[Gestor Hospitalar] ──────────► UC005: Visualizar Fluxos Predominantes
[Gestor Hospitalar] ──────────► UC006: Monitorar Prontuários Inertes

[Sistema ETL] ────────────────► UC007: Executar Pipeline Batch
[AGHU] ◄──────────────────────── UC007: fonte de dados (read-only)
```
