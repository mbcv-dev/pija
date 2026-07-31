# Dashboard por áreas da jornada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar o Dashboard em seções por área da jornada do paciente (Entrada · Consultas · Exames · Internação · Cirurgias) com chips de atalho sticky + scroll-spy e cross-links "Ver gargalos" que abrem `/gargalos` com a métrica pré-selecionada.

**Architecture:** Frontend-only. Uma fonte única de metadados (`lib/areas.ts`) alimenta o `KpiGrid` (que passa de grid único a seções) e um novo componente `AreaNav.vue` (chips). O deep-link usa query param `?kpi=` lido pelo `GargaloList` via nova ação `setMetricas` do store. Zero mudança de backend, rotas ou sidebar.

**Tech Stack:** Vue 3 + TypeScript, Pinia, vue-router, Tailwind, vitest + @vue/test-utils (jsdom).

**Spec:** [docs/superpowers/specs/2026-07-30-dashboard-areas-jornada-design.md](../specs/2026-07-30-dashboard-areas-jornada-design.md)

---

## Contexto essencial do repo (leia antes da Task 1)

- **Branch de trabalho:** `feat/ciclicidade-jornada` (NÃO commitar em main; NÃO commitar `backend/data/`).
- **Testes/typecheck:** `cd frontend; npx vitest run` e `npm run type-check`. Ambiente jsdom; component tests montam com `createPinia()` (padrão em `frontend/src/components/ui/FilterBar.test.ts`).
- **`KPI_META`** vive em `frontend/src/types/api.types.ts` com os códigos: `KPI-01`, `KPI-03`, `KPI-05`, `KPI-06`, `KPI-07`, `KPI-07B` (07B é submétrica do 07, renderizada DENTRO do card do KPI-07 — não é card próprio).
- **`Icon.vue`** já tem os ícones: `prontuario`, `consulta`, `exame`, `internacao`, `cirurgia`, `gargalos`.
- **`useKpiStore`** expõe `kpis: KpiItem[]` (`kpi.codigo` identifica), `loading`, `error`, `fetchKpis()`, `initWatcher()`.
- **`useGargaloStore`** (em `frontend/src/stores/useGargaloStore.ts`) expõe `metricas = ref<KpiCode[]>(['KPI-03','KPI-05','KPI-06','KPI-07'])`, `toggleMetrica`, `fetchGargalos`, `initWatcher`.
- Commits: mensagem imperativa, corpo explica o porquê, sem `Co-Authored-By` de modelo.

---

### Task 1: `lib/areas.ts` — fonte única das áreas

**Files:**
- Create: `frontend/src/lib/areas.ts`
- Create: `frontend/src/lib/areas.test.ts`

- [ ] **Step 1: Write the failing test**

Criar `frontend/src/lib/areas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { AREAS_JORNADA } from './areas'
import type { KpiCode } from '@/types/api.types'

// METRIC_OPTIONS do GargaloList (KPIs que participam do ranking de gargalos).
const METRIC_OPTIONS: KpiCode[] = ['KPI-03', 'KPI-05', 'KPI-06', 'KPI-07']

describe('AREAS_JORNADA', () => {
  it('segue a ordem canônica da jornada', () => {
    expect(AREAS_JORNADA.map((a) => a.id)).toEqual([
      'entrada', 'consultas', 'exames', 'internacao', 'cirurgias',
    ])
  })

  it('todo KPI de card aparece em exatamente uma área (07B é submétrica, não entra)', () => {
    const todos = AREAS_JORNADA.flatMap((a) => a.kpis)
    expect([...todos].sort()).toEqual(['KPI-01', 'KPI-03', 'KPI-05', 'KPI-06', 'KPI-07'])
    expect(new Set(todos).size).toBe(todos.length)
  })

  it('cirurgias não tem KPI ainda (indicadores operacionais são outra frente)', () => {
    const cirurgias = AREAS_JORNADA.find((a) => a.id === 'cirurgias')!
    expect(cirurgias.kpis).toEqual([])
    expect(cirurgias.gargalosKpi).toBeUndefined()
  })

  it('todo gargalosKpi participa do ranking de gargalos', () => {
    for (const a of AREAS_JORNADA) {
      if (a.gargalosKpi) expect(METRIC_OPTIONS).toContain(a.gargalosKpi)
    }
  })

  it('toda área tem label, ícone e descrição preenchidos', () => {
    for (const a of AREAS_JORNADA) {
      expect(a.label.length).toBeGreaterThan(0)
      expect(a.icon.length).toBeGreaterThan(0)
      expect(a.descricao.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/lib/areas.test.ts`
Expected: FAIL — `Cannot find module './areas'` (ou equivalente).

- [ ] **Step 3: Write minimal implementation**

Criar `frontend/src/lib/areas.ts`:

```ts
import type { KpiCode } from '@/types/api.types'

/**
 * Áreas da jornada do paciente — fonte única do agrupamento do Dashboard.
 *
 * Ordem = ordem canônica da jornada (mesma do grafo de ciclicidade:
 * consulta antes de exame), não a ordem de citação do doc de feedback.
 * KPI-06 mora em Internação: a âncora do indicador é a internação.
 * KPI-07B não aparece aqui — é submétrica renderizada dentro do card do KPI-07.
 */
export interface AreaJornada {
  id: string
  label: string
  /** Nome de ícone existente em Icon.vue. */
  icon: string
  descricao: string
  /** KPIs exibidos na seção, em ordem. Vazio = área sem indicadores ainda. */
  kpis: KpiCode[]
  /** KPI pré-selecionado no cross-link para /gargalos. Ausente = sem link. */
  gargalosKpi?: KpiCode
}

export const AREAS_JORNADA: AreaJornada[] = [
  {
    id: 'entrada', label: 'Entrada', icon: 'prontuario',
    descricao: 'Do prontuário ao primeiro contato assistencial',
    kpis: ['KPI-01'],
  },
  {
    id: 'consultas', label: 'Consultas', icon: 'consulta',
    descricao: 'Agendamento e realização de consultas',
    kpis: ['KPI-03'], gargalosKpi: 'KPI-03',
  },
  {
    id: 'exames', label: 'Exames', icon: 'exame',
    descricao: 'Solicitação e realização de exames',
    kpis: ['KPI-05'], gargalosKpi: 'KPI-05',
  },
  {
    id: 'internacao', label: 'Internação', icon: 'internacao',
    descricao: 'Da chegada ao leito até a saída',
    kpis: ['KPI-06', 'KPI-07'], gargalosKpi: 'KPI-07',
  },
  {
    id: 'cirurgias', label: 'Cirurgias', icon: 'cirurgia',
    descricao: 'Procedimentos cirúrgicos — indicadores em desenvolvimento',
    kpis: [],
  },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npx vitest run src/lib/areas.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/areas.ts frontend/src/lib/areas.test.ts
git commit -m "feat(dashboard): fonte unica das areas da jornada (lib/areas)" -m "Item 4 do feedback do Demo Day: organizar o dashboard pela otica do usuario assistencial. AREAS_JORNADA define ordem canonica, mapeamento KPI->area (KPI-06 em Internacao, ancora e a internacao), cirurgias vazia (indicadores operacionais sao outra frente) e o KPI do cross-link de gargalos. Ver spec 2026-07-30-dashboard-areas-jornada-design.md."
```

---

### Task 2: `useGargaloStore.setMetricas` — pré-seleção programática

**Files:**
- Modify: `frontend/src/stores/useGargaloStore.ts`
- Create: `frontend/src/stores/useGargaloStore.test.ts`

- [ ] **Step 1: Write the failing test**

Criar `frontend/src/stores/useGargaloStore.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({
  getGargalos: vi.fn(async () => ({ items: [] })),
}))

import { useGargaloStore } from './useGargaloStore'

describe('useGargaloStore.setMetricas', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('substitui a seleção de métricas', () => {
    const store = useGargaloStore()
    store.setMetricas(['KPI-05'])
    expect(store.metricas).toEqual(['KPI-05'])
  })

  it('ignora lista vazia (mantém ao menos uma métrica)', () => {
    const store = useGargaloStore()
    const antes = [...store.metricas]
    store.setMetricas([])
    expect(store.metricas).toEqual(antes)
  })
})
```

> Se o mock de `@/services/api` conflitar com o shape real (conferir `getGargalos` no arquivo
> `frontend/src/services/api.ts`), ajustar o retorno mockado ao shape usado pelo store
> (`response.items` — ver `fetchGargalos`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/stores/useGargaloStore.test.ts`
Expected: FAIL — `store.setMetricas is not a function`.

- [ ] **Step 3: Write minimal implementation**

Em `frontend/src/stores/useGargaloStore.ts`, adicionar após `toggleMetrica` (linha ~52):

```ts
  /** Substitui a seleção de métricas (usado pelo deep-link ?kpi= do dashboard). */
  function setMetricas(codes: KpiCode[]): void {
    if (codes.length === 0) return // mantém ao menos uma métrica
    metricas.value = [...codes]
  }
```

E incluir `setMetricas` no objeto retornado pelo store (linha ~64):

```ts
  return { items, loading, error, limit, metricas, fetchGargalos, setLimit, toggleMetrica, setMetricas, initWatcher }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npx vitest run src/stores/useGargaloStore.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/useGargaloStore.ts frontend/src/stores/useGargaloStore.test.ts
git commit -m "feat(gargalos): acao setMetricas no store" -m "Pre-selecao programatica de metricas, usada pelo deep-link ?kpi= das secoes do dashboard. Lista vazia e ignorada (invariante: ao menos uma metrica)."
```

---

### Task 3: `GargaloList` lê `?kpi=` da rota

**Files:**
- Modify: `frontend/src/components/gargalos/GargaloList.vue`
- Create: `frontend/src/components/gargalos/GargaloList.test.ts`

- [ ] **Step 1: Write the failing test**

Criar `frontend/src/components/gargalos/GargaloList.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia, type Pinia } from 'pinia'

vi.mock('@/services/api', () => ({
  getGargalos: vi.fn(async () => ({ items: [] })),
}))

// useRoute é mockado por teste para simular a query string.
const rota = { query: {} as Record<string, string> }
vi.mock('vue-router', () => ({
  useRoute: () => rota,
}))

import GargaloList from './GargaloList.vue'
import { useGargaloStore } from '@/stores/useGargaloStore'

let pinia: Pinia

async function montar(query: Record<string, string>) {
  rota.query = query
  const w = mount(GargaloList, { global: { plugins: [pinia] } })
  await flushPromises()
  return w
}

describe('GargaloList — deep-link ?kpi=', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('?kpi=KPI-05 pré-seleciona só essa métrica', async () => {
    await montar({ kpi: 'KPI-05' })
    expect(useGargaloStore().metricas).toEqual(['KPI-05'])
  })

  it('?kpi= inválido mantém o default', async () => {
    await montar({ kpi: 'KPI-99' })
    expect(useGargaloStore().metricas).toEqual(['KPI-03', 'KPI-05', 'KPI-06', 'KPI-07'])
  })

  it('sem query mantém o default', async () => {
    await montar({})
    expect(useGargaloStore().metricas).toEqual(['KPI-03', 'KPI-05', 'KPI-06', 'KPI-07'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/components/gargalos/GargaloList.test.ts`
Expected: FAIL no primeiro caso — `metricas` continua com as 4 default (o componente ainda não lê a query).

- [ ] **Step 3: Write minimal implementation**

Em `frontend/src/components/gargalos/GargaloList.vue`, no `<script setup>`:

Adicionar o import (junto aos existentes):

```ts
import { useRoute } from 'vue-router'
```

E trocar o `onMounted` atual por:

```ts
const route = useRoute()

onMounted(() => {
  // Deep-link das seções do dashboard: /gargalos?kpi=KPI-05 pré-seleciona a métrica.
  const kpi = route.query.kpi
  if (typeof kpi === 'string' && (METRIC_OPTIONS as string[]).includes(kpi)) {
    store.setMetricas([kpi as KpiCode])
  }
  store.initWatcher()
  void store.fetchGargalos()
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npx vitest run src/components/gargalos/GargaloList.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite (regressão)**

Run: `cd frontend; npx vitest run`
Expected: todos os arquivos PASS (o GargaloList agora usa `useRoute`; nenhum teste existente monta GargaloList, então nada mais deve quebrar).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/gargalos/GargaloList.vue frontend/src/components/gargalos/GargaloList.test.ts
git commit -m "feat(gargalos): deep-link ?kpi= pre-seleciona a metrica" -m "Permite que as secoes do dashboard abram /gargalos ja na metrica da area. Valor invalido ou ausente mantem o comportamento atual (4 metricas)."
```

---

### Task 4: `KpiGrid` — de grid único para seções por área

**Files:**
- Modify: `frontend/src/components/kpis/KpiGrid.vue`
- Create: `frontend/src/components/kpis/KpiGrid.test.ts`

- [ ] **Step 1: Write the failing test**

Criar `frontend/src/components/kpis/KpiGrid.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia, type Pinia } from 'pinia'
import type { KpiItem } from '@/types/api.types'

const K = (codigo: KpiItem['codigo']): KpiItem => ({
  codigo, descricao: '', unidade_tempo: 'dias', media_global: 1.5, n_global: 10, breakdown: [],
})

vi.mock('@/services/api', () => ({
  getKpis: vi.fn(async () => ({
    kpis: [K('KPI-01'), K('KPI-03'), K('KPI-05'), K('KPI-06'), K('KPI-07'), K('KPI-07B')],
  })),
}))

import KpiGrid from './KpiGrid.vue'
import KpiCard from './KpiCard.vue'

let pinia: Pinia

async function montar() {
  const w = mount(KpiGrid, {
    global: {
      plugins: [pinia],
      // Cross-links usam RouterLink; stub evita precisar de router real.
      stubs: { RouterLink: { template: '<a data-gargalos-link><slot /></a>' } },
    },
  })
  await flushPromises()
  return w
}

describe('KpiGrid — seções por área da jornada', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('renderiza as 5 seções na ordem canônica', async () => {
    const w = await montar()
    const ids = w.findAll('[data-area]').map((s) => s.attributes('data-area'))
    expect(ids).toEqual(['entrada', 'consultas', 'exames', 'internacao', 'cirurgias'])
  })

  it('cada seção mostra os cards da sua área (07B não é card próprio)', async () => {
    const w = await montar()
    const codigosPorSecao = w.findAll('[data-area]').map((s) =>
      s.findAllComponents(KpiCard).map((c) => (c.props('kpi') as KpiItem).codigo),
    )
    expect(codigosPorSecao).toEqual([
      ['KPI-01'], ['KPI-03'], ['KPI-05'], ['KPI-06', 'KPI-07'], [],
    ])
  })

  it('KPI-07 recebe a submétrica KPI-07B', async () => {
    const w = await montar()
    const card07 = w.findAllComponents(KpiCard).find((c) => (c.props('kpi') as KpiItem).codigo === 'KPI-07')!
    expect((card07.props('submetric') as KpiItem).codigo).toBe('KPI-07B')
  })

  it('Cirurgias mostra estado vazio honesto', async () => {
    const w = await montar()
    const cirurgias = w.findAll('[data-area]').find((s) => s.attributes('data-area') === 'cirurgias')!
    expect(cirurgias.text()).toContain('Sem indicadores nesta área ainda')
  })

  it('cross-link de gargalos só nas áreas com gargalosKpi', async () => {
    const w = await montar()
    const comLink = w.findAll('[data-area]')
      .filter((s) => s.find('[data-gargalos-link]').exists())
      .map((s) => s.attributes('data-area'))
    expect(comLink).toEqual(['consultas', 'exames', 'internacao'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/components/kpis/KpiGrid.test.ts`
Expected: FAIL — não existem `[data-area]` (grid único atual).

- [ ] **Step 3: Rewrite `KpiGrid.vue`**

Substituir o conteúdo de `frontend/src/components/kpis/KpiGrid.vue` por:

```vue
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useKpiStore } from '@/stores/useKpiStore'
import { AREAS_JORNADA } from '@/lib/areas'
import KpiCard from './KpiCard.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Icon from '@/components/ui/Icon.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const store = useKpiStore()

const porCodigo = computed(() => new Map(store.kpis.map((k) => [k.codigo, k])))
const submetric = computed(() => porCodigo.value.get('KPI-07B'))

// Cards de uma área = KPIs mapeados que vieram na resposta (ausentes são pulados).
function cardsDaArea(kpis: readonly string[]) {
  return kpis.map((c) => porCodigo.value.get(c as never)).filter((k) => k !== undefined)
}

const nenhumKpi = computed(() => AREAS_JORNADA.every((a) => cardsDaArea(a.kpis).length === 0))

onMounted(() => {
  store.initWatcher()
  void store.fetchKpis()
})
</script>

<template>
  <div>
    <div v-if="store.loading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <BaseCard v-for="n in 6" :key="n" class="flex flex-col gap-4">
        <Skeleton height="h-9" rounded="rounded-xl" />
        <Skeleton height="h-8" />
        <Skeleton height="h-16" />
      </BaseCard>
    </div>
    <ErrorState v-else-if="store.error" :message="store.error" @retry="store.fetchKpis()" />
    <EmptyState v-else-if="nenhumKpi" title="Sem KPIs no recorte" description="Ajuste os filtros para ver os indicadores." />

    <div v-else class="flex flex-col gap-8">
      <section
        v-for="area in AREAS_JORNADA" :key="area.id"
        :id="`area-${area.id}`" :data-area="area.id"
        class="flex flex-col gap-3 scroll-mt-24"
      >
        <header class="flex items-start gap-3">
          <span class="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon :name="area.icon" :size="18" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="text-base font-bold text-text dark:text-text-dark leading-snug">{{ area.label }}</h2>
            <p class="text-xs text-text-muted dark:text-text-dark-muted">{{ area.descricao }}</p>
          </div>
          <RouterLink
            v-if="area.gargalosKpi"
            :to="{ path: '/gargalos', query: { kpi: area.gargalosKpi } }"
            class="shrink-0 text-xs font-medium text-primary dark:text-accent hover:underline whitespace-nowrap"
          >
            Ver gargalos →
          </RouterLink>
        </header>

        <div v-if="cardsDaArea(area.kpis).length > 0" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            v-for="kpi in cardsDaArea(area.kpis)" :key="kpi.codigo" :kpi="kpi"
            :submetric="kpi.codigo === 'KPI-07' ? submetric : undefined"
          />
        </div>
        <BaseCard v-else>
          <EmptyState
            :icon="area.icon"
            title="Sem indicadores nesta área ainda"
            description="Os indicadores operacionais (cirurgias/partos, cancelamentos…) estão no roadmap — implementação futura."
          />
        </BaseCard>
      </section>
    </div>
  </div>
</template>
```

Notas para o implementador:
- `scroll-mt-24` compensa a barra de chips sticky da Task 5 ao usar `scrollIntoView`.
- O `EmptyState` "Sem KPIs no recorte" global permanece: se a API não devolver nenhum KPI mapeado, nada de seções soltas.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npx vitest run src/components/kpis/KpiGrid.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run full suite + type-check**

Run: `cd frontend; npx vitest run; npm run type-check`
Expected: tudo PASS, type-check limpo.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/kpis/KpiGrid.vue frontend/src/components/kpis/KpiGrid.test.ts
git commit -m "feat(dashboard): KpiGrid em secoes por area da jornada" -m "Cada area (Entrada, Consultas, Exames, Internacao, Cirurgias) vira uma secao com cabecalho, seus KPIs e cross-link 'Ver gargalos' quando a metrica participa do ranking. Cirurgias mostra estado vazio honesto apontando o roadmap. Skeleton/erro/vazio globais preservados (uma busca so)."
```

---

### Task 5: `AreaNav.vue` — chips de atalho sticky com scroll-spy

**Files:**
- Create: `frontend/src/components/kpis/AreaNav.vue`
- Create: `frontend/src/components/kpis/AreaNav.test.ts`
- Modify: `frontend/src/views/DashboardView.vue`

- [ ] **Step 1: Write the failing test**

Criar `frontend/src/components/kpis/AreaNav.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AreaNav from './AreaNav.vue'

// jsdom não tem IntersectionObserver nem scrollIntoView — o componente precisa
// degradar sem quebrar (feature-detect) e o clique usa scrollIntoView se existir.

describe('AreaNav', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="area-exames"></div>'
  })

  it('renderiza um chip por área, na ordem', () => {
    const w = mount(AreaNav)
    const labels = w.findAll('[data-chip-area]').map((c) => c.text())
    expect(labels).toEqual(['Entrada', 'Consultas', 'Exames', 'Internação', 'Cirurgias'])
  })

  it('clicar num chip rola até a seção correspondente', async () => {
    const alvo = document.getElementById('area-exames')!
    const spy = vi.fn()
    ;(alvo as unknown as { scrollIntoView: typeof spy }).scrollIntoView = spy
    const w = mount(AreaNav, { attachTo: document.body })
    await w.findAll('[data-chip-area]')[2].trigger('click')
    expect(spy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    w.unmount()
  })

  it('monta sem IntersectionObserver (jsdom) sem lançar erro', () => {
    expect(() => mount(AreaNav)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/components/kpis/AreaNav.test.ts`
Expected: FAIL — `Cannot find module './AreaNav.vue'`.

- [ ] **Step 3: Create `AreaNav.vue`**

Criar `frontend/src/components/kpis/AreaNav.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { AREAS_JORNADA } from '@/lib/areas'
import Icon from '@/components/ui/Icon.vue'

/**
 * Chips de atalho para as seções do dashboard (uma por área da jornada).
 * Clique rola até a seção; scroll-spy destaca a seção visível.
 * Sticky: fica à mão enquanto a página (que cresce com os gráficos) rola.
 */
const ativa = ref<string>(AREAS_JORNADA[0]!.id)
let observer: IntersectionObserver | null = null

function irPara(id: string): void {
  ativa.value = id
  document.getElementById(`area-${id}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  // jsdom/browsers antigos: sem IntersectionObserver o spy degrada (chips seguem clicáveis).
  if (typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (entries) => {
      // A seção visível mais alta vira a ativa.
      const visiveis = entries.filter((e) => e.isIntersecting)
      if (visiveis.length === 0) return
      const topo = visiveis.reduce((a, b) =>
        a.boundingClientRect.top <= b.boundingClientRect.top ? a : b)
      ativa.value = topo.target.id.replace('area-', '')
    },
    { rootMargin: '-96px 0px -60% 0px' },
  )
  for (const a of AREAS_JORNADA) {
    const el = document.getElementById(`area-${a.id}`)
    if (el) observer.observe(el)
  }
})
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <nav
    aria-label="Áreas da jornada"
    class="sticky top-0 z-20 -mx-1 px-1 py-2 bg-surface/95 dark:bg-surface-dark/95 backdrop-blur
           flex gap-1.5 overflow-x-auto"
  >
    <button
      v-for="area in AREAS_JORNADA" :key="area.id" type="button" :data-chip-area="area.id"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
      :class="ativa === area.id
        ? 'bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent'
        : 'text-text-muted dark:text-text-dark-muted hover:bg-surface-offset dark:hover:bg-surface-dark-offset'"
      @click="irPara(area.id)"
    >
      <Icon :name="area.icon" :size="14" />
      {{ area.label }}
    </button>
  </nav>
</template>
```

- [ ] **Step 4: Wire no `DashboardView.vue`**

Substituir o conteúdo de `frontend/src/views/DashboardView.vue` por:

```vue
<script setup lang="ts">
import FilterBar from '@/components/ui/FilterBar.vue'
import AreaNav from '@/components/kpis/AreaNav.vue'
import KpiGrid from '@/components/kpis/KpiGrid.vue'
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-text dark:text-text-dark tracking-tight">Dashboard</h1>
      <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">
        Tempos da jornada assistencial por área · HC-UFPE
      </p>
    </div>
    <FilterBar />
    <AreaNav />
    <KpiGrid />
  </div>
</template>
```

- [ ] **Step 5: Run tests + type-check**

Run: `cd frontend; npx vitest run; npm run type-check`
Expected: tudo PASS (incluindo os 3 novos do AreaNav), type-check limpo.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/kpis/AreaNav.vue frontend/src/components/kpis/AreaNav.test.ts frontend/src/views/DashboardView.vue
git commit -m "feat(dashboard): chips de atalho sticky com scroll-spy por area" -m "AreaNav rola ate a secao da area e destaca a visivel (IntersectionObserver com feature-detect p/ jsdom). Sticky porque a pagina cresce quando os indicadores graficos chegarem."
```

---

### Task 6: Verificação no browser (backend real, dois temas)

**Files:** nenhum (verificação manual via Playwright/browser).

- [ ] **Step 1: Subir os servidores**

```powershell
# Backend (porta 8000)
cd backend; $env:SQLITE_PATH="./data/pija_demo.db"; $env:JWT_SECRET="dev-secret-not-for-production-min-32-chars"; $env:CORS_ORIGINS="http://localhost:5173,http://localhost:5174"; .\venv\Scripts\python.exe -m uvicorn pija.main:app --app-dir src --host 127.0.0.1 --port 8000
# Frontend (porta 5173)
cd frontend; $env:VITE_USE_MOCK="false"; $env:VITE_API_BASE_URL="http://127.0.0.1:8000"; npm run dev
```

- [ ] **Step 2: Checklist em `http://localhost:5173/dashboard`**

- 5 seções na ordem Entrada → Consultas → Exames → Internação → Cirurgias, cada uma com cabeçalho (ícone, label, descrição).
- Internação tem 2 cards (KPI-06 e KPI-07 com a submétrica 07B dentro).
- Cirurgias mostra o estado vazio honesto.
- Chips sticky: rolar a página mantém os chips visíveis; o chip da seção visível fica destacado.
- Clicar em "Internação" rola suavemente até a seção (sem ficar escondida sob os chips — `scroll-mt-24`).
- Aplicar um filtro (ex.: Especialidade REUMATOLOGIA) atualiza os cards de TODAS as seções.
- "Ver gargalos →" na seção Exames abre `/gargalos?kpi=KPI-05` com **apenas** "Solicitação → realização do exame" selecionada.
- Repetir o essencial no tema claro e no escuro.
- Mobile (viewport estreito): chips rolam horizontalmente; seções empilham.

- [ ] **Step 3: Encerrar os servidores** (portas 8000/5173).

- [ ] **Step 4: Registrar execução no plano** (seção "Registro de execução" ao final deste arquivo, conforme convenção do repo) e commit:

```bash
git add docs/superpowers/plans/2026-07-30-dashboard-areas-jornada.md
git commit -m "docs(plan): registro de execucao do dashboard por areas"
```

---

## Self-review (do plano, já aplicado)

- Spec §3.1→Task 1, §3.4→Tasks 2–3, §3.2→Task 4, §3.3→Task 5, §4 browser→Task 6. Sem lacunas.
- Tipos: `setMetricas(codes: KpiCode[])` consistente entre Task 2 (definição) e Task 3 (uso);
  `AREAS_JORNADA`/`AreaJornada` consistentes entre Tasks 1, 4 e 5; ids `area-<id>` idênticos
  entre KpiGrid (Task 4) e AreaNav (Task 5).
- Sem placeholders: todo step de código tem o código completo.

## Fora de escopo (reafirmado)

KPIs novos (cirurgia/operacionais), gráficos por indicador, mudanças de sidebar/rotas/backend.
