# Simplificação: breakdown fixo, cor sem julgamento, barra de meta fora — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`) para tracking.

**Goal:** Tirar da interface três afirmações que ela não sustenta — a escolha de agrupamento sem consequência explicada, a cor que declara "tempo maior = pior", e a meta de 4h exibida num único KPI.

**Architecture:** Frontend-only. Três remoções independentes, cada uma levando junto o estado, o helper e os testes que só existiam para ela. Nenhuma mudança de backend: `group_by` continua existindo na rota (default `unidade`), o front apenas para de variá-lo.

**Tech Stack:** Vue 3 + TS + Pinia + Tailwind + vitest.

**Spec:** [docs/superpowers/specs/2026-08-05-simplificacao-breakdown-e-cores-design.md](../specs/2026-08-05-simplificacao-breakdown-e-cores-design.md) — decisões travadas, NÃO re-perguntar.

---

## Contexto essencial do repo (leia antes da Task 1)

- **Branch:** `feat/endurecimento-e-cirurgia`.
- **Testes:** `cd frontend; npx vitest run` (**189 hoje**) · `npm run type-check`.
- **A contagem de testes vai CAIR.** São três remoções de comportamento; os testes que fixavam o
  comportamento removido saem junto. Queda é esperada — o que não pode haver é **falha**. Registre a
  contagem final no relatório.
- Comentários em português explicando o porquê. Commits: imperativa, sem `Co-Authored-By`, **sem
  acentos na mensagem**.
- **Sem deploy de backend nesta frente** — só a Vercel, automática no merge para `main`.

### Levantamento já feito (não repita)

Consumidores de `lib/intensity.ts`, verificados no código:

| Arquivo | Uso |
|---|---|
| `components/gargalos/GargaloItem.vue:11` | cor da barra do ranking |
| `components/kpis/KpiDetailModal.vue:45` | cor das barras da lista completa |
| `components/kpis/KpiCard.vue:39-40` | cor da barra de meta do KPI-07B |

**O top-5 dentro do card NÃO usa intensidade.** `KpiBreakdownBar.vue` renderiza `BarRow` sem
`barClass` — já é neutro hoje. A spec dizia "top-5 dos cards e modal"; na prática só o modal e o
ranking de Gargalos precisam mudar. Não procure código que não existe.

Depois das Tasks 2 e 3, `lib/intensity.ts` fica **sem nenhum consumidor** — daí a deleção.

---

### Task 1: Remover o toggle "Por unidade / Por especialidade"

**Files:**
- Modify: `frontend/src/components/ui/FilterBar.vue`
- Modify: `frontend/src/stores/useFilterStore.ts`
- Modify: `frontend/src/stores/useKpiStore.ts`
- Modify: `frontend/src/stores/useCiclicidadeStore.ts`
- Modify: `frontend/src/stores/useFilterStore.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Em `frontend/src/stores/useFilterStore.test.ts`, adicionar:

```ts
  it('activeFilters nao carrega group_by', () => {
    // O breakdown e fixo em unidade executora: sem escolha na tela, o store nao
    // deve carregar o estado dela. O backend mantem o parametro com default.
    const store = useFilterStore()
    expect('group_by' in store.activeFilters).toBe(false)
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend; npx vitest run src/stores/useFilterStore.test.ts`
Expected: FAIL — `group_by` ainda está em `activeFilters`.

- [ ] **Step 3: Tirar `groupBy` do `useFilterStore`**

Em `frontend/src/stores/useFilterStore.ts`:

- Apagar a linha `const groupBy = ref<GroupBy>('unidade')`.
- Apagar `group_by: groupBy.value,` do objeto `activeFilters`.
- Apagar a função `setGroupBy`.
- Apagar `groupBy` e `setGroupBy` do `return`.
- Em `reset()`, apagar o comentário `// groupBy mantém a preferência do usuário`.
- Remover o import de `GroupBy` se ficar órfão.

- [ ] **Step 4: Tirar o controle do `FilterBar.vue`**

Em `frontend/src/components/ui/FilterBar.vue`:

- Apagar a constante `groupByOptions` (linhas ~64-67).
- No template, apagar o bloco `<SegmentedControl ... />` (linhas ~114-117), deixando a `<div class="ml-auto flex items-center gap-3">` com apenas o `<BaseButton>` de limpar filtros.
- Remover o import de `SegmentedControl` se ficar órfão. **Conferir antes se outro componente usa
  `SegmentedControl`** — se ninguém mais usar, deixe o arquivo do componente onde está (é UI
  genérica reutilizável, não código morto desta feature) e apenas remova o import daqui.

- [ ] **Step 5: Limpar o destructuring que ficou sem sentido**

`useKpiStore.ts` e `useCiclicidadeStore.ts` removem `group_by` de `activeFilters` antes de chamar o
service. Com o campo fora do store, esse descarte não tem mais o que descartar.

Em `frontend/src/stores/useKpiStore.ts`, dentro de `fetchDistribuicoes`, trocar:

```ts
      // Mesmos filtros dos KPIs; `group_by` não se aplica (sem breakdown aqui).
      const { group_by: _semBreakdown, ...params } = filterStore.activeFilters
      const response = await getDistribuicoes(params)
```

por:

```ts
      const response = await getDistribuicoes(filterStore.activeFilters)
```

Em `frontend/src/stores/useCiclicidadeStore.ts`, localizar o destructuring equivalente (usa `_gb`) e
fazer a mesma simplificação.

- [ ] **Step 6: Rodar**

Run: `cd frontend; npx vitest run` e `npm run type-check`
Expected: verde. Testes que chamavam `setGroupBy` ou afirmavam `group_by` em `activeFilters` vão
falhar — **remova-os**, é remoção de comportamento, não perda de cobertura. Registre quantos saíram.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ui/FilterBar.vue frontend/src/stores/
git commit -m "feat(front): breakdown fixo em unidade executora" -m "O par de botoes Por unidade/Por especialidade ficava ao lado dos filtros, sugerindo que filtrava algo, mas o efeito era a lista pequena do card trocar de conteudo -- e nada na tela dizia isso. Uma pergunta a menos vale mais que uma explicacao a mais. O backend mantem group_by com default unidade; o front so para de variar."
```

---

### Task 2: Ranking com cor única

**Files:**
- Modify: `frontend/src/components/gargalos/GargaloItem.vue`
- Modify: `frontend/src/components/kpis/KpiDetailModal.vue`

- [ ] **Step 1: Escrever o teste que falha**

Criar/estender o teste do `GargaloItem`. Se não houver arquivo, criar
`frontend/src/components/gargalos/GargaloItem.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GargaloItem from './GargaloItem.vue'
import type { GargaloItem as Item } from '@/types/api.types'

const item = (media: number): Item => ({
  dimensao_tipo: 'unidade', dimensao: 'UAC: BIOQUIMICA',
  transicao: 'KPI-05', media, n: 100,
})

describe('GargaloItem — cor sem julgamento', () => {
  it('barras de tempos muito diferentes usam a MESMA cor', () => {
    // Tempo maior nem sempre e gargalo: parte das unidades demora mais pela
    // natureza do que faz. O comprimento codifica o tempo; a cor nao opina.
    const curto = mount(GargaloItem, { props: { item: item(1), position: 1, maxMedia: 100 } })
    const longo = mount(GargaloItem, { props: { item: item(100), position: 2, maxMedia: 100 } })

    const classe = (w: ReturnType<typeof mount>) =>
      w.find('[data-barra]').attributes('class') ?? ''

    expect(classe(curto)).toBe(classe(longo))
    expect(classe(curto)).not.toMatch(/intensity/)
  })

  it('o comprimento continua codificando o tempo', () => {
    const curto = mount(GargaloItem, { props: { item: item(25), position: 1, maxMedia: 100 } })
    const longo = mount(GargaloItem, { props: { item: item(100), position: 2, maxMedia: 100 } })
    const largura = (w: ReturnType<typeof mount>) =>
      parseFloat((w.find('[data-barra]').attributes('style') ?? '').replace(/[^\d.]/g, ''))
    expect(largura(longo)).toBeGreaterThan(largura(curto))
  })
})
```

> O seletor `[data-barra]` **ainda não existe** — o Step 3 o adiciona ao `RankBar.vue`. Sem um
> gancho estável, o teste dependeria da estrutura de `div`s aninhadas, que é frágil.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend; npx vitest run src/components/gargalos/GargaloItem.test.ts`
Expected: FAIL — `[data-barra]` não existe.

- [ ] **Step 3: Gancho no `RankBar.vue`**

Em `frontend/src/components/ui/RankBar.vue`, adicionar `data-barra` ao `<div>` interno que já recebe
`:class="barClass"` e `:style` de largura (linha ~29):

```html
        <div
          data-barra
          class="h-full rounded-full transition-all duration-500"
          :class="barClass"
          :style="{ width: `${Math.max(2, Math.min(100, ratio * 100)).toFixed(1)}%` }"
        />
```

(Manter as classes que já estiverem lá; só acrescentar o atributo.)

- [ ] **Step 4: `GargaloItem` para de calcular intensidade**

Substituir o `<script setup>` de `frontend/src/components/gargalos/GargaloItem.vue` por:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import RankBar from '@/components/ui/RankBar.vue'
import { formatDuration, formatCasos } from '@/lib/format'
import { KPI_META } from '@/types/api.types'
import type { GargaloItem as GargaloItemType } from '@/types/api.types'

const props = defineProps<{ item: GargaloItemType; position: number; maxMedia: number }>()

/**
 * Cor única, de propósito. A escala por magnitude que existia aqui afirmava
 * "tempo maior = pior", e isso nem sempre é verdade: parte das unidades leva
 * mais tempo pela natureza do que faz, e isso é o hospital funcionando. O
 * comprimento da barra continua codificando o tempo — a informação não se
 * perde, só deixa de vir com julgamento embutido.
 */
const BARRA = 'bg-primary dark:bg-accent'

const transicaoLabel = computed(() => KPI_META[props.item.transicao]?.label ?? props.item.transicao)
</script>

<template>
  <RankBar
    :position="position"
    :label="item.dimensao"
    :value="formatDuration(item.media, 'dias')"
    :ratio="maxMedia > 0 ? item.media / maxMedia : 0"
    :bar-class="BARRA"
    :caption="`${transicaoLabel} · ${formatCasos(item.n)}`"
  />
</template>
```

- [ ] **Step 5: `KpiDetailModal` idem**

Em `frontend/src/components/kpis/KpiDetailModal.vue`:

- Apagar o import `import { intensityLevel, intensityBarClass } from '@/lib/intensity'`.
- Substituir a função `barClass` (linha ~44-46) por uma constante:

```ts
/**
 * Cor única — mesma razão do ranking de Gargalos: a escala por magnitude
 * afirmava "tempo maior = pior", e nem todo tempo maior é problema. O
 * comprimento da barra segue proporcional à média.
 */
const BARRA = 'bg-primary dark:bg-accent'
```

- No template, trocar `:bar-class="barClass(item.media)"` (ou equivalente) por `:bar-class="BARRA"`.
  **Ler o template antes** — se `barClass` for usado em mais de um lugar, trocar em todos.
- Se `maxMedia` ficar sem uso após a troca, **não apague**: ele ainda alimenta o `ratio` (a escala
  comum entre páginas do modal, que é o que torna as barras comparáveis). Conferir.

- [ ] **Step 6: Rodar**

Run: `cd frontend; npx vitest run` e `npm run type-check`
Expected: os testes novos passam; o resto verde.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/gargalos/ frontend/src/components/kpis/KpiDetailModal.vue frontend/src/components/ui/RankBar.vue
git commit -m "feat(front): barras de ranking com cor unica" -m "A escala de cor por magnitude afirmava que tempo maior e pior. Nem sempre e: parte das unidades demora mais pela natureza do que faz, e isso e o hospital funcionando, nao um problema. O comprimento da barra continua codificando o tempo -- a informacao fica, o julgamento sai."
```

---

### Task 3: Remover a barra de meta de 4h

**Files:**
- Modify: `frontend/src/components/kpis/KpiCard.vue`
- Modify: `frontend/src/types/api.types.ts`
- Delete: `frontend/src/lib/intensity.ts`
- Delete: `frontend/src/lib/intensity.test.ts`
- Modify: `frontend/src/components/kpis/KpiGrid.test.ts` (se houver asserção sobre a meta)

- [ ] **Step 1: Escrever o teste que falha**

Em `frontend/src/components/kpis/KpiGrid.test.ts`, adicionar ao bloco de testes da submétrica:

```ts
  it('o bloco da submetrica nao fala mais em meta', async () => {
    const w = await montar()
    const bloco = w.find('[data-submetrica]')
    expect(bloco.exists()).toBe(true)
    expect(bloco.text()).not.toMatch(/meta/i)
  })

  it('mas o resto do bloco da submetrica continua inteiro', async () => {
    // A remocao nao pode levar junto o valor nem o histograma do KPI-07B --
    // o caso-ancora da feature de graficos mora exatamente ali.
    const w = await montar()
    const bloco = w.find('[data-submetrica]')
    await vi.waitFor(() => expect(bloco.find('[data-balde]').exists()).toBe(true))
    expect(bloco.text()).toMatch(/\d/)  // o valor da submetrica segue renderizado
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend; npx vitest run src/components/kpis/KpiGrid.test.ts`
Expected: FAIL no primeiro teste — o texto "meta: 4h · …" ainda está lá.

- [ ] **Step 3: Tirar a barra do `KpiCard.vue`**

Em `frontend/src/components/kpis/KpiCard.vue`:

**No `<script setup>`**, apagar:
- o import `import { intensityLevel, intensityBarClass } from '@/lib/intensity'`
- os computeds `subBarClass`, `subBarRatio` e `subMeetsTarget` (linhas ~36-49) e o comentário
  `// Indicador de meta do KPI-07B (≤4h = ok)...` acima deles

**No template**, dentro do bloco `<div v-if="submetric" data-submetrica ...>`, apagar:
- a `<div class="mt-1.5 h-2 rounded-full bg-surface-offset ...">` inteira (a barra)
- o `<p class="mt-1 text-[11px]" :class="subMeetsTarget ? ...">meta: {{ subMeta?.metaHoras }}h · …</p>`

**Manter** o cabeçalho da submétrica (descrição + valor), o histograma e o botão de detalhe.

Ajustar o espaçamento: o histograma hoje vem com `class="mt-2"` depois da legenda de meta. Com a
legenda fora, conferir no browser se `mt-2` ainda é o respiro certo em relação ao valor logo acima —
o bloco usa margens explícitas (`mt-1.5`/`mt-1`/`mt-2`), não `gap`.

- [ ] **Step 4: Tirar `metaHoras` do tipo**

Em `frontend/src/types/api.types.ts`:
- Na interface `KpiMeta`, apagar o campo `metaHoras?: number` e o comentário `/** meta em horas (só KPI-07B) */`.
- Na entrada `KPI_META['KPI-07B']`, apagar a propriedade `metaHoras: 4` (ou o valor que estiver lá).
- Rodar `grep -rn "metaHoras" frontend/src` e garantir que não sobrou referência.

- [ ] **Step 5: Apagar `lib/intensity.ts`**

```bash
rm frontend/src/lib/intensity.ts frontend/src/lib/intensity.test.ts
```

Confirmar que ninguém mais importa:

```bash
grep -rn "lib/intensity\|intensityLevel\|intensityBarClass" frontend/src
```
Expected: nenhum resultado.

Sobre os tokens `bg-intensity-*` em `tailwind.config.js`: conferir com
`grep -rn "intensity-" frontend/src`. **Se não houver nenhum uso**, remover o bloco `intensity` do
config. Se algum componente fora deste escopo ainda usar, deixar e registrar no relatório.

- [ ] **Step 6: Rodar**

Run: `cd frontend; npx vitest run` e `npm run type-check`
Expected: verde. Testes que afirmavam "dentro da meta"/"acima da meta" devem ser **removidos** —
comportamento removido. Registre quantos.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src
git commit -m "feat(front): remove a barra de meta de 4h do KPI-07B" -m "Uma meta unica exibida num unico KPI cria assimetria sem explicacao na tela, e a legenda em laranja afirmava 'acima da meta' com a mesma forca visual que o ranking usava para dizer 'isto e um gargalo'. Com a barra fora, o 07B e lido como os outros: valor, distribuicao, e o julgamento fica com quem le. Leva junto o ultimo consumidor de lib/intensity, que some por inteiro."
```

---

### Task 4: A ressalva na tela de Gargalos

**Files:**
- Modify: `frontend/src/views/GargalosView.vue`

A preocupação que originou a Task 2 precisa ficar **na tela**, não só no código.

- [ ] **Step 1: Escrever o teste que falha**

Em `frontend/src/components/gargalos/GargaloList.test.ts` (ou no teste da view, se existir):

```ts
  it('a tela avisa que tempo maior nem sempre e gargalo', async () => {
    const w = await montar({})
    expect(w.text()).toMatch(/nem sempre|natureza/i)
  })
```

Ajustar o `montar` ao helper que o arquivo já usa.

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Adicionar o texto**

Em `frontend/src/views/GargalosView.vue`, abaixo do título/subtítulo da página, adicionar:

```html
      <p class="text-xs text-text-muted dark:text-text-dark-muted max-w-prose">
        Ordenado por tempo médio. Tempo maior não significa necessariamente gargalo — parte das
        unidades leva mais tempo pela natureza do que faz.
      </p>
```

Ajustar as classes ao que a view já usa em textos auxiliares (ler o arquivo antes; não inventar
tokens).

- [ ] **Step 4: Rodar + commit**

```bash
git add frontend/src/views/GargalosView.vue frontend/src/components/gargalos/GargaloList.test.ts
git commit -m "feat(front): gargalos avisa que tempo maior nem sempre e gargalo" -m "A ressalva que motivou a neutralizacao da cor precisa estar na tela, nao so no codigo -- quem le o ranking e quem precisa dela."
```

---

### Task 5: Verificação no browser

**Files:** nenhum código. Registrar em "Registro de execução".

- [ ] **Step 1:** Subir backend e frontend (comandos na Task 6 do plano do KPI-05).

- [ ] **Step 2: Checklist, nos DOIS temas**

- A barra de filtros não tem mais o par de botões, e **não sobrou buraco** onde eles estavam
  (o `ml-auto` empurrava o grupo para a direita — conferir se o botão "Limpar" ficou bem posicionado).
- Ranking de Gargalos: todas as barras na mesma cor. **Conferir contraste** contra o fundo do card
  em claro e escuro — a escala de intensidade garantia legibilidade por construção; uma cor fixa não
  garante, é preciso olhar.
- A ressalva aparece na tela de Gargalos.
- Modal de detalhe de um KPI: barras na mesma cor, comprimentos ainda comparáveis entre páginas.
- Card do KPI-07: bloco da submétrica **sem** barra de meta e sem a legenda, mas **com** descrição,
  valor e histograma. Sem espaçamento órfão.
- Breakdown dos cards continua por unidade executora.

- [ ] **Step 3:** Encerrar servidores, registrar achados e commitar o registro.

Sem deploy de backend nesta frente.

---

## Registro de execução

_(preencher durante a execução — incluir a contagem final de testes e quantos foram removidos)_

## Self-review (do plano, já aplicado)

- Spec §2 (breakdown) → Task 1 · §3 (cor) → Task 2 · §3.4 (deletar intensity) → Task 3 Step 5 ·
  §3.5 (texto) → Task 4 · §4 (barra de meta) → Task 3 · §5 (verificação) → Task 5.
- **Correção da spec aplicada no plano:** a spec dizia que o top-5 dos cards usava a escala de
  intensidade. Não usa — `KpiBreakdownBar` renderiza `BarRow` sem `barClass`. Só o modal e o ranking
  de Gargalos mudam. Documentado no contexto para o implementador não caçar código inexistente.
- A deleção de `lib/intensity.ts` (Task 3) depende das Tasks 2 e 3 terem removido os três
  consumidores — por isso está na última das três, não na Task 2.
- Nomes conferidos contra o código real: `intensityLevel`, `intensityBarClass`, `RankBar`,
  `BarRow`, `KpiBreakdownBar`, `SegmentedControl`, `groupByOptions`, `setGroupBy`, `activeFilters`,
  `subBarClass`, `subBarRatio`, `subMeetsTarget`, `metaHoras`, `data-submetrica`, `data-balde`.

## Fora de escopo

Mudar o que o ranking ordena ou `METRIC_OPTIONS` · comparação contra baseline/pares (feature nova,
registrada na spec) · qualquer mudança no `HistogramaTempos.vue` · backend.
