# Backlog — duplicação dos filtros nos controllers e da fixture `client` nos testes

> **Data:** 2026-08-03 · **Status:** registrado, não agendado
> **Origem:** review de qualidade da Task 2 do plano
> [2026-08-03-indicadores-graficos.md](2026-08-03-indicadores-graficos.md). Não bloqueia aquela
> entrega — os dois itens são padrões pré-existentes do repo que a Task 2 apenas estendeu.

## 1. Construção de `Filtros` duplicada em 5 controllers

`kpis_controller.get_kpis`, `kpis_controller.get_distribuicoes`, `ciclicidade_controller`,
`eventos_controller` e `gargalos_controller` repetem ~15 linhas idênticas: as declarações
`Query()` de `unidade`/`especialidade`/`grupo`/`data_inicio`/`data_fim` e a montagem do `Filtros`.

**Por que não corrigimos junto com a Task 2:** o FastAPI exige que cada endpoint declare seus
próprios `Query()` para o OpenAPI renderizar os parâmetros — uma função compartilhada ingênua não
resolve. A saída real é uma dependência injetada (`FiltrosQuery` com `Depends()`), que o FastAPI
ainda expõe no OpenAPI. Consertar só o `kpis_controller.py` deixaria os outros 3 inconsistentes,
o que é pior que a duplicação uniforme de hoje.

**Escopo quando for feito:** os 5 controllers de uma vez, com a suíte existente como rede.

## 2. Fixture `client` duplicada em 5 arquivos de teste

`test_kpis_distribuicoes.py`, `test_kpis_multiselect.py`, `test_gargalos_multiselect.py`,
`test_ciclicidade.py` e `test_integration_f2.py` carregam cópias quase idênticas da fixture do
client HTTP async (`app.state.session_factory = async_sessionmaker(...)` + `AsyncClient` sobre
`ASGITransport`). A única parte que é mesmo por-arquivo é receber `fixture_db_session` como
parâmetro para forçar a população do banco antes do uso; o corpo é copy-paste.

**Escopo quando for feito:** subir a fixture para `backend/tests/conftest.py` e remover as 5 cópias.

## 3. Requisições obsoletas não são canceladas (só descartadas)

Achado na review da Task 4. O `useKpiStore.fetchDistribuicoes` protege contra resposta atrasada com
um guarda de sequência: a resposta de um filtro antigo é descartada em vez de sobrescrever a mais
recente. Correto para a UI, mas **a requisição em si não é cancelada** — duas mudanças de filtro
seguidas custam duas varreduras completas no backend, e só uma é usada. O mesmo vale para os outros
stores da família.

**Escopo quando for feito:** `AbortController` nos fetches que reagem a filtro, na família de stores
inteira. Só vale a pena se a churn de filtros crescer ou se a varredura ficar cara com o dado real
do HC — hoje é custo aceitável.

## 4. Submétrica sem dados é reportada como "acima da meta"

Achado durante a verificação no browser da Task 7 (2026-08-05), mas **pré-existente** — vem do commit
`3c4a40e` (redesenho do card de KPI), bem antes desta branch.

Com um filtro que zera o KPI-07B, a submétrica renderiza "sem dados" e, ao lado, "meta: 4h · acima da
meta" em laranja: `subMeetsTarget` devolve `false` quando `media_global` é `null`, então **ausência de
dado vira meta perdida**. Ver `frontend/src/components/kpis/KpiCard.vue` (cálculo do
`subMeetsTarget` e o bloco que renderiza o rótulo da meta).

**Escopo quando for feito:** distinguir os três estados (dentro / acima / sem dado) em vez de dois, e
conferir se o card principal tem o mesmo problema. Não corrigido junto com os indicadores gráficos
por ser defeito de outra entrega — corrigir aqui misturaria as duas na mesma branch.

## 5. Invariantes estruturais da distribuição só são checadas no mock

Achado na review final da branch dos indicadores gráficos (2026-08-05).

`frontend/src/mocks/distribuicoes.mock.test.ts` garante que `teto === buckets[último].de` e que existe
exatamente uma cauda aberta, sempre por último. O componente `HistogramaTempos.vue` **depende** da
segunda. Mas o `DistribuicoesResponseSchema` (zod) não valida nenhuma das duas, então o caminho da
resposta **real** não tem a garantia que o mock tem.

**Escopo quando for feito:** um `.superRefine` no `KpiDistribuicaoSchema` estendendo as duas
invariantes ao dado de produção. Custo quase zero.

## 6. O parse da distribuição é tudo-ou-nada

Mesma review. Um `codigo` ou `unidade_tempo` desconhecido vindo do backend faz o
`DistribuicoesResponseSchema.parse` falhar e **derruba os seis histogramas de uma vez**
(`frontend/src/services/api.ts`, no `getDistribuicoes`). Hoje os enums batem exatamente com o
backend, então é latente — mas é um acoplamento para saber antes de adicionar um KPI-08.

**Escopo quando for feito:** decidir se vale degradar por KPI em vez de por resposta. Só faz sentido
se o conjunto de códigos passar a variar entre backend e frontend.

## 7. O halo da linha da mediana repinta a barra por cima (bug de desenho)

Achado na verificação no browser do KPI-05 (2026-08-05), com dado real.

A linha da mediana no `HistogramaTempos.vue` tem um halo de `stroke-width="3.5"` na cor da
superfície, desenhado **depois** — e portanto por cima — das barras. Quando a mediana cai perto da
origem, o halo cobre parte da primeira barra e a repinta com a cor de fundo.

No KPI-05 é o pior caso: mediana em `x = 1,655` de um eixo de 259,76 unidades (**0,64%**), halo
cobrindo `x ∈ [-0,1; 3,4]` contra uma barra que ocupa `[0; 14,735]` — **23% da largura da barra
mais alta é repintada de fundo**. A barra que concentra 66,75% dos casos renderiza visivelmente
mais estreita e com um entalhe, nos dois temas. É geometria sendo lida como dado.

Pré-existente e mais brando em KPI-01 e KPI-07B (~12%), onde metade do halo cai fora do viewBox.

**Escopo quando for feito:** recortar o halo contra a barra, ou suprimi-lo quando a mediana cai
dentro do primeiro balde. É bug de desenho, não decisão de spec — não confundir com o item 8.

## 8. O histograma não sustenta a mediana quando a assimetria é extrema

Mesmo achado, mas é **decisão de produto, não bug**. No KPI-05, `p95/p50 = 157×`: a mediana de
9,6 h fica a 1,9 px da origem num eixo que vai até 62,9 dias. O gráfico comunica bem a cauda
("21 mil exames levaram mais de 2 meses") e o decaimento — a escala raiz é o que salva isso —,
mas **não dá nenhum apoio geométrico ao número grande do card**. O leitor não chega em 9,6 h
olhando o desenho.

Vale para KPI-01 e KPI-07B também, em grau menor. A saída seria eixo X logarítmico ou uma visão
ampliada do primeiro balde — mudança de componente que afeta todos os KPIs de uma vez, com
tradeoff próprio (log no eixo do tempo é difícil de ler para quem não é técnico).

**Escopo quando for feito:** frente própria, com brainstorm — não emendar num plano existente.

## 9. `fetchKpis` continua sem cancelamento

Achado durante a execução da frente de endurecimento (2026-08-05/06), Task 5.

A Task 5 do plano de [endurecimento](2026-08-05-endurecimento-backlog.md) mandou `getKpis` aceitar
`opts.signal` (Step 3), mas os Steps 4-5 só mandaram ligar o `AbortController` em
`fetchDistribuicoes`, `useGargaloStore`, `useCiclicidadeStore` e `useDimensoesStore`. O parâmetro
existe em `getKpis` e **ninguém passa** — é superfície morta hoje.

`fetchKpis` é a query mais cara do dashboard (seis KPIs com breakdown), então é justamente onde o
cancelamento economizaria mais. Não foi ligado porque ampliar o escopo no meio da execução é o tipo
de decisão que o plano existe para evitar.

**Escopo quando for feito:** os mesmos quatro elementos do Step 4 daquele plano. Atenção: `fetchKpis`
**seta `error`** e **não tem guarda de sequência**, então cai na mesma armadilha que
`useGargaloStore`/`useCiclicidadeStore` — o guarda `if (!controller.signal.aborted)` precisa
envolver tanto a atribuição de `error` quanto o `finally` que baixa o `loading`, senão toda troca
rápida de filtro pinta um ErrorState ou faz o skeleton piscar.
