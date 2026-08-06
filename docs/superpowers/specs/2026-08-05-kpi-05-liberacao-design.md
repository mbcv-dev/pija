# Spec — KPI-05 passa a medir solicitação → liberação

> **Data:** 2026-08-05 · **Status:** aprovada pelo usuário (brainstorm nesta data)
> **Origem:** pergunta do time do HC — *"não faz mais sentido ser da solicitação até a liberação
> (e não realização)?"* — trazida pelo usuário em 2026-08-05.

Frente independente das outras três aprovadas na mesma data
([endurecimento](2026-08-05-endurecimento-backlog-design.md),
[simplificação](2026-08-05-simplificacao-breakdown-e-cores-design.md),
[cirurgia](2026-08-05-kpi-cirurgia-design.md)). **Recomendada como primeira a executar:** é pequena
e corrige um número falso que está em produção agora.

---

## 1. O HC não sugeriu uma melhoria — apontou um indicador quebrado

Medido no banco de demonstração (2,26M eventos, mesmo dado que está em produção):

| | solicitação → **realização** (hoje) | solicitação → **liberação** (proposto) |
|---|---|---|
| pares com os dois timestamps | 979.847 | 440.855 |
| descartados pela guarda de ordem | **599.647 (61,2%)** | **0 (0,0%)** |
| `n` válido do KPI | 380.200 | **440.855** |
| mediana | **0,00 h** | 9,23 h |

> **Nota (2026-08-05, durante a execução):** os números acima foram medidos **sem** o
> `KPI_GRUPO_SCOPE` do KPI-05. Como o provider restringe a Análises Clínicas, Diagnóstico por
> Imagem e Anatomia Patológica, o número que o **dashboard realmente exibe** é
> **n = 422.080, mediana 9,62 h** (contra 361.837 e 0,00 h da medida antiga). A diferença de
> 18.775 linhas é exatamente Procedimental (10.638) + Ambulatorial (8.123) + Internação (14).
> A conclusão não muda; o número de referência, sim.

**Em 61,2% dos exames a "realização" é anterior à solicitação.** O exame estaria sendo feito antes
de ser pedido. O `.sql` do KPI-05 tem a guarda `JULIANDAY(realizacao) >= JULIANDAY(solicitacao)`,
então essas linhas são descartadas **em silêncio** — o card mostra `n = 380 mil` e não há nada na
tela indicando que 600 mil eventos foram removidos por inconsistência.

O que sobra tem mediana zero. O dashboard em produção exibe **"< 1 min"** para "Solicitação →
realização (exame)", afirmando que exame fica pronto no instante em que é pedido.

A medida proposta pelo HC não tem nenhum desses problemas: **zero linhas descartadas** pela guarda
de ordem, `n` maior que o do KPI atual, e mediana de 9,23 h — um tempo de resposta de laboratório
plausível.

### 1.1 Por que `timestamp_liberacao` é confiável

Correspondência exata com a situação do exame: **440.855 exames têm `timestamp_liberacao` e
440.855 têm `situacao = 'LIBERADO'`** — 1 para 1. Nenhuma outra situação (`A COLETAR`, `A EXECUTAR`,
`AGENDADO`, `CANCELADO`, `EM COLETA`, `COLETADO`) tem liberação preenchida. O campo significa
exatamente uma coisa: o resultado foi liberado.

### 1.2 Não há argumento de exame de imagem

A hipótese razoável contra a troca seria: "para imagem, *realização* é a medida certa". O dado
descarta:

- Exames não-laboratoriais: **557 de 979.847 (0,06%)**, num único `tipo_evento` chamado
  `Imagem / Outros`.
- E eles têm **a mesma inversão de 61,2%** — o problema do campo não é específico de laboratório.

A base de exames é, na prática, laboratório.

## 2. Decisão

**KPI-05 passa a medir `timestamp_liberacao − timestamp_solicitacao`. A medida antiga é aposentada**
— sai do dashboard, não vira submétrica.

Racional da aposentadoria (e não de manter as duas): um indicador com 61% de inversão e mediana zero
não mede tempo de processo nenhum. Mantê-lo como submétrica seria preservar um número falso na tela
com aparência de informação — exatamente o que esta entrega existe para corrigir.

O **código `KPI-05` é reaproveitado**, não aposentado: é o mesmo conceito ("quanto tempo o paciente
espera pelo exame"), medido no ponto certo. Evita renumerar, evita quebrar `METRIC_OPTIONS`,
`areas.ts`, URLs de cross-link e o que mais referencia o código.

## 3. A ressalva que precisa aparecer na tela

**55% dos exames nunca foram liberados** e portanto não entram no KPI: de 979.847 eventos EXAME,
440.855 (45,0%) têm resultado liberado e **538.992 (55,0%) não** — 446.377 em `A COLETAR`, mais
`A EXECUTAR`, `AGENDADO`, `CANCELADO` e outros. Isso **não é perda de dado** — é o denominador
correto para um tempo de resposta: só faz sentido medir a duração de algo que terminou.

> **Correção (2026-08-05, durante a execução):** a primeira versão desta spec dizia "45% nunca
> foram liberados". Estava invertido — 45% é a fatia **liberada**. O número veio de
> 446.377 `A COLETAR` / 979.847 = 45,6%, mas a frase somava outras quatro situações **por cima**
> desse número, contradizendo a si mesma. Como esta frase vai literalmente para as regras do card,
> o erro subestimaria o viés justamente para quem precisa dele.

Mas gera **viés de sobrevivência**, e um indicador hospitalar não pode escondê-lo: um exame parado
em `A COLETAR` há dois anos contribui com **zero** para o KPI. O indicador responde *"dos exames
liberados, quanto tempo levou"*, e é cego para a fila parada.

**Decisão:** a ressalva vai para as `regras` do card (`KPI_META` no frontend) e para a página de
Metodologia, com esse teor. Sem código novo.

**Registrado como candidato à Fase B**, não implementado agora: taxa de exames não liberados e idade
da fila parada. É uma taxa, então pertence ao mesmo grupo de KPI-02/04/09 (ver
[spec de cirurgia](2026-08-05-kpi-cirurgia-design.md) §1).

## 4. Implementação

### Backend

- `backend/src/pija/sql/kpis/kpi_05.sql`: trocar `timestamp_realizacao` por `timestamp_liberacao`
  nas três ocorrências (projeção do `valor`, guarda de nulo, guarda de ordem). Nenhuma outra
  mudança — as guardas de `unidade NOT LIKE '%INATIVO%'`, os `{filtros}`, `{grupo_scope}` e as
  guardas de data continuam iguais.
- `KPI_META` (provider): a descrição passa a ser `"Solicitação → liberação (exame)"`.
- **Unidade de tempo: continua `dias`** (o `.sql` segue produzindo diferença de `JULIANDAY`). O
  `formatDuration` do frontend já auto-escala para exibição — é assim que o KPI-01, também em dias,
  aparece como "15,8 horas". Nenhuma conversão para horas.
- `KPI_GRUPO_SCOPE` do KPI-05 fica como está.

### Frontend

- `KPI_META` (`api.types.ts`): `label`, `ancora` e `regras` do KPI-05. As `regras` precisam dizer
  (a) que só exames com resultado liberado entram, (b) a ressalva do §3.
- `MetodologiaView.vue`: mesma ressalva, na linguagem da página.
- Mocks (`kpis.mock.ts`, `distribuicoes.mock.ts`): rótulos coerentes. Os números do mock não
  precisam replicar produção, mas não devem contradizer a nova definição.

### Documentos canônicos

- `02-requisitos.md`: a linha do KPI-05 muda de fórmula.
- `CLAUDE.md` §KPIs do MVP: a descrição do KPI-05 muda.
- `docs/DADOS-ESTADO.md`: **o achado do §1 entra como seção própria** — a inversão de 61,2% em
  `data_hora_realizacao` é um fato sobre o dado do HC que sobrevive a esta entrega e precisa estar
  onde a próxima pessoa procura.

## 5. O que levar de volta ao HC

Não é tarefa de código, mas é resultado desta investigação e não deve se perder: **`data_hora_realizacao`
está invertido em relação a `data_hora_solicitacao` em 61,2% das linhas de `vw_exames`.** Ou o campo
não significa "quando o exame foi realizado", ou há um problema de carga na view. Vale confirmar com
o Daniel — a resposta pode importar para outros indicadores que venham a usar esse campo.

## 6. Verificação

- Suítes: backend **186**, frontend **189**, `vue-tsc` limpo. Sem regressão.
- Teste de provider para o KPI-05 novo: guarda de nulo, guarda de ordem, filtro restringindo, KPI
  sem dado no recorte. **Incluir um caso com `situacao ≠ LIBERADO`** garantindo que ele não entra.
- **Browser contra o backend real.** O card deve deixar de exibir "< 1 min". Atenção à forma da
  distribuição: mediana 9,23 h com p95 de 1.505 h (62 dias) é assimetria de três ordens de
  grandeza — a linha da mediana vai ficar praticamente colada na origem do eixo. É o caso mais
  extremo que o histograma vai enfrentar até agora; conferir se a escala raiz dá conta ou se o
  gráfico fica ilegível. Se ficar, isso é achado novo e vira MD, não conserto improvisado.
- Frente de backend → termina com `railway up --no-gitignore` a partir de `backend/`.

## 7. Fora de escopo

Taxa de exames não liberados e idade da fila (Fase B) · investigar/corrigir `data_hora_realizacao`
no ETL · mudanças em outros KPIs · mudanças no `HistogramaTempos.vue`.
