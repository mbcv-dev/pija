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
| `KpiCard.vue` (barra de meta do KPI-07B) | **distância até a meta de 4h** — outra coisa |

### 3.2 Decisão

**Barras de ranking passam a ter cor única neutra**, nos três primeiros consumidores. O
**comprimento** da barra continua codificando o tempo — a informação não se perde, só deixa de ser
dita duas vezes, e a segunda vez era a que embutia julgamento.

Racional (do usuário): tempo maior nem sempre é gargalo. Algumas unidades ficam mais tempo por
natureza do que fazem, e isso é o hospital funcionando, não um problema. Pintar a barra de
vermelho/laranja transforma uma observação em acusação — exatamente o tipo de leitura que o
histograma foi construído para evitar na entrega anterior.

### 3.3 A exceção, explícita

**A barra de meta do KPI-07B mantém a cor.** Ali a cor não codifica magnitude: codifica distância
até uma meta de 4 horas **acordada com o HC**. Existe um alvo pactuado, então dizer "acima" é
reportar um fato combinado, não emitir julgamento sobre volume.

Registro explícito para que a diferença não pareça esquecimento em revisão futura: neutralizamos
cor-por-magnitude, preservamos cor-por-meta.

### 3.4 Destino do `lib/intensity.ts`

Continua existindo, com um consumidor (a barra de meta) — mas **o teste e o doc do módulo devem
dizer para que ele serve agora**, senão o próximo leitor reintroduz a escala de cor no ranking
achando que é o uso pretendido. Comentário no módulo nomeando a distinção do §3.3.

Se após a mudança sobrar API não usada em `intensity.ts` (ex.: níveis que só o ranking usava),
remover — a decisão do `loadingDist` (manter estado sem consumidor por ser observável de teste)
não se aplica aqui: não há teste que dependa disso.

### 3.5 O texto que acompanha

A tela de Gargalos passa a ter uma linha explicando o que o ranking é e o que não é — algo na linha
de *"ordenado por tempo médio. Tempo maior não significa necessariamente gargalo: parte das
unidades leva mais tempo pela natureza do que faz."* Texto final a definir na implementação; o
requisito é que a ressalva do usuário fique na tela, não só no código.

## 4. Verificação

- Suítes atuais: backend **186**, frontend **189**, `vue-tsc` limpo. Esta frente é frontend-only.
- Verificar no browser, **nos dois temas**: barras de ranking legíveis com cor única (contraste
  contra o fundo do card em claro e escuro), barra de meta do 07B ainda colorida, e a barra de
  filtros sem o par de botões e sem buraco de layout onde eles estavam.
- Não precisa de deploy de backend — só a Vercel, que é automática no merge para `main`.

## 5. Fora de escopo

- Mudar o que o ranking de Gargalos ordena ou quais KPIs participam (`METRIC_OPTIONS`).
- Comparação contra baseline/pares (o "é normal essa unidade demorar" tratado quantitativamente) —
  é a resposta completa para a preocupação do usuário, mas é feature nova, com definição estatística
  própria. Registrado aqui como candidato a frente futura, não implementado agora.
- Qualquer mudança no `HistogramaTempos.vue`, que tem escala de cor própria e já justificada (a
  cauda em `warning` codifica "extremo lento do mesmo eixo", com rótulo, não só cor).
