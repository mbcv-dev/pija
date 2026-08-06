# Spec — Simplificação: breakdown fixo e cor sem julgamento

> **Data:** 2026-08-05 · **Status:** aprovada pelo usuário (brainstorm nesta data)
> **Origem:** feedback direto do usuário em 2026-08-05, itens 3 e 4:
> *"remover esses botões de Por unidade e Por especialidade (não tô entendendo o que eles estão
> fazendo)"* e *"em gargalos, ajustar para não ter essa mudança de cores conforme o número de tempo
> maior, porque nem sempre isso é um gargalo, mas é também como o hospital funciona (alguns ficam
> mais tempo mesmo e isso é normal)"*.

Esta é a **Frente 2** de três aprovadas em 2026-08-05. As outras:
[endurecimento do backlog](2026-08-05-endurecimento-backlog-design.md) e
[KPI de Cirurgia](2026-08-05-kpi-cirurgia-design.md).

---

## 1. As duas mudanças têm a mesma raiz

Ambas são casos de a interface **afirmar mais do que sabe**. O toggle de agrupamento oferece uma
escolha cuja consequência não está explicada; a escala de cor afirma que tempo maior é pior. Nos
dois casos a correção é a interface dizer menos, não dizer melhor.

## 2. Breakdown fixo em unidade executora

### 2.1 Estado

`FilterBar.vue` expõe um par de botões (`Por unidade` / `Por especialidade`) que escreve
`groupBy` no `useFilterStore`, enviado como `group_by` para `/kpis/tempos-medios`. Ele muda a
**dimensão do breakdown** — o top-5 dentro de cada card de KPI e a lista completa no
`KpiDetailModal`. Não muda o valor principal do card, não muda os filtros, não muda a tela de
Gargalos.

O problema é que nada na tela diz isso. Os botões ficam ao lado dos filtros, o que sugere que
filtram algo; o efeito é a lista pequena lá embaixo trocar de conteúdo.

### 2.2 Decisão

**Remover o toggle. Breakdown sempre por unidade executora** — o default de hoje.

Racional: a alternativa considerada foi manter o controle com rótulo mais claro ("Detalhar por…") e
tooltip. Descartada porque o usuário não pediu clareza, pediu remoção — o controle não estava
resolvendo um problema dele. Uma pergunta a menos na tela vale mais que uma explicação a mais.

### 2.3 O que fica

- **O backend não muda.** `group_by` continua existindo em `/kpis/tempos-medios` como parâmetro
  com default `unidade`. A rota é pública e a distribuição já ignora `group_by`; remover o
  parâmetro seria quebra sem ganho.
- **`groupBy` sai do `useFilterStore`** (estado, setter e a chave em `activeFilters`). Se o front
  não oferece a escolha, não deve carregar o estado dela — estado sem consumidor é o que a review
  do `loadingDist` já discutiu, e ali havia justificativa; aqui não há.
- Como `activeFilters` perde `group_by`, o destructuring que hoje o **remove** em
  `useKpiStore.fetchDistribuicoes` e no `useCiclicidadeStore` deixa de ser necessário. Limpar os
  dois, senão sobra código que descarta um campo inexistente.

### 2.4 Verificação

O `KpiDetailModal` e o top-5 continuam funcionando, agora sempre por unidade. Testes existentes que
exercitam `setGroupBy` ou asseguram `group_by` em `activeFilters` precisam ser removidos ou
reescritos — **e a remoção deles não é perda de cobertura**, é remoção de comportamento.

## 3. Cor sem julgamento nas barras de ranking

### 3.1 Estado

`lib/intensity.ts` mapeia um valor normalizado para 5 níveis (`bg-intensity-0` … `bg-intensity-4`),
consumido em três lugares:

| Consumidor | O que a cor codifica hoje |
|---|---|
| `GargaloItem.vue` | tempo da dimensão, normalizado pelo maior tempo da lista |
| `KpiCard.vue` (top-5, via `KpiBreakdownBar`) | idem, dentro do card |
| `KpiDetailModal.vue` | idem, na lista completa |
| `KpiCard.vue` (barra de meta do KPI-07B) | distância até a meta de 4h — **removida por inteiro, ver §4** |

### 3.2 Decisão

**Barras de ranking passam a ter cor única neutra**, nos três primeiros consumidores. O
**comprimento** da barra continua codificando o tempo — a informação não se perde, só deixa de ser
dita duas vezes, e a segunda vez era a que embutia julgamento.

Racional (do usuário): tempo maior nem sempre é gargalo. Algumas unidades ficam mais tempo por
natureza do que fazem, e isso é o hospital funcionando, não um problema. Pintar a barra de
vermelho/laranja transforma uma observação em acusação — exatamente o tipo de leitura que o
histograma foi construído para evitar na entrega anterior.

### 3.3 Não há exceção

Uma versão anterior desta spec preservava a cor da barra de meta do KPI-07B, por ela codificar meta
pactuada e não magnitude. **A barra de meta foi removida** (§4), então a exceção deixou de existir:
nenhum lugar da aplicação colore por tempo depois desta frente.

### 3.4 Destino do `lib/intensity.ts`

Com o ranking neutralizado (§3.2) e a barra de meta removida (§4), o módulo fica **sem nenhum
consumidor**. **Apagar** `lib/intensity.ts` e `lib/intensity.test.ts`, junto com os tokens
`bg-intensity-*` do `tailwind.config.js` se nenhum outro componente os usar — conferir antes.

Isto é remoção de código morto de verdade, não o caso do `loadingDist` (estado sem consumidor de
UI, preservado por ser observável de teste): aqui não sobra nem teste nem uso.

### 3.5 O texto que acompanha

A tela de Gargalos passa a ter uma linha explicando o que o ranking é e o que não é — algo na linha
de *"ordenado por tempo médio. Tempo maior não significa necessariamente gargalo: parte das
unidades leva mais tempo pela natureza do que faz."* Texto final a definir na implementação; o
requisito é que a ressalva do usuário fique na tela, não só no código.

## 4. Remoção da barra de meta de 4h (KPI-07B)

**Decisão do usuário em 2026-08-05:** *"vamos tirar essa barra de 4h como meta"*.

O bloco da submétrica KPI-07B renderiza hoje, abaixo do valor: uma barra de progresso proporcional a
`media_global / (4h × 2)` e a legenda `meta: 4h · dentro da meta | acima da meta`. Tudo isso sai. O
bloco da submétrica **permanece** — descrição, valor, histograma e o botão de detalhe continuam como
estão; some apenas o par barra-de-meta + legenda.

**O que a remoção arrasta junto** (todos em `KpiCard.vue` salvo indicação):

- `subBarClass`, `subBarRatio`, `subMeetsTarget` — os três computeds existem só para a barra.
- `metaHoras` em `KpiMeta` (`api.types.ts`) e o valor na entrada do KPI-07B — a única meta pactuada
  do sistema. Se sair do tipo, conferir que nada mais lê o campo.
- O último consumidor de `lib/intensity.ts`, o que permite apagar o módulo (§3.4).
- **O item 2.4 da [Frente 1](2026-08-05-endurecimento-backlog-design.md)**, que planejava um terceiro
  estado ("sem dado") para a legenda da meta. Sem legenda, não há defeito — o item foi retirado
  daquela frente, riscado em vez de apagado.

**Racional:** os 4h eram uma meta acordada com o HC, mas uma meta única exibida num único KPI,
sem que os demais tenham alvo, cria assimetria sem explicação na tela — e a legenda em laranja
afirmava "acima da meta" com a mesma força visual que o ranking usava para afirmar "isto é um
gargalo", que é exatamente o tipo de afirmação que esta frente está reduzindo. Com a barra fora, o
KPI-07B passa a ser lido como os outros: valor, distribuição, e o julgamento fica com quem lê.

**Teste:** o caso que hoje assegura a legenda da meta deve ser **removido**, não adaptado — é
remoção de comportamento. Um teste novo garantindo que o bloco da submétrica continua íntegro (valor
+ histograma) fixa que a remoção não levou o resto junto.

## 5. Verificação

- Suítes atuais: backend **186**, frontend **189**, `vue-tsc` limpo. Esta frente é frontend-only.
  A contagem do frontend **cai** — três remoções de comportamento (toggle, escala de intensidade,
  barra de meta) levam seus testes junto. Queda esperada; o que não pode haver é falha.
- Verificar no browser, **nos dois temas**: barras de ranking legíveis com a cor única (conferir
  contraste contra o fundo do card em claro e escuro — a escala de intensidade garantia isso por
  construção, uma cor fixa não garante); a barra de filtros sem o par de botões e sem buraco de
  layout onde eles estavam; e o bloco da submétrica do KPI-07B íntegro sem a barra de meta —
  descrição, valor e histograma no lugar, sem espaçamento órfão onde a barra estava.
- Não precisa de deploy de backend — só a Vercel, que é automática no merge para `main`.

## 6. Fora de escopo

- Mudar o que o ranking de Gargalos ordena ou quais KPIs participam (`METRIC_OPTIONS`).
- Comparação contra baseline/pares (o "é normal essa unidade demorar" tratado quantitativamente) —
  é a resposta completa para a preocupação do usuário, mas é feature nova, com definição estatística
  própria. Registrado aqui como candidato a frente futura, não implementado agora.
- Qualquer mudança no `HistogramaTempos.vue`, que tem escala de cor própria e já justificada (a
  cauda em `warning` codifica "extremo lento do mesmo eixo", com rótulo, não só cor).
