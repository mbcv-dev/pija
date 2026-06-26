# Fase 7 — Repaginação do Frontend PIJA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repaginar toda a camada visual do frontend do PIJA (3 telas: Dashboard, Gargalos, Jornada) com um design system consistente, claro+escuro, mantendo intacta a camada de dados (services/stores/schemas/mocks).

**Architecture:** "Design system primeiro" — tokens no `tailwind.config` + primitivos de UI puros (Tailwind/CSS/SVG, zero dependência nova de runtime), e então reescrever as 3 views como composição dos primitivos. Helpers de lógica pura (formatação, intensidade, timeline) com TDD em Vitest (devDependency). A Jornada substitui a tela de Eventos e roda sobre mock (dependência de backend `paciente_id` anotada).

**Tech Stack:** Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS + Zod + Axios (travado). Vitest dev-only só para testar helpers.

**Spec:** `docs/superpowers/specs/2026-06-26-fase-7-frontend-redesign-design.md`

---

## Mapa de arquivos

**Tooling/tokens**
- Modify: `frontend/package.json` (devDep vitest + scripts), `frontend/vite.config.ts` (bloco test)
- Modify: `frontend/tailwind.config.js` (escala de intensidade), `frontend/src/style.css` (var. timeline)

**Helpers de lógica (novo `src/lib/`)**
- Create: `frontend/src/lib/format.ts` + `frontend/src/lib/format.test.ts`
- Create: `frontend/src/lib/intensity.ts` + `frontend/src/lib/intensity.test.ts`
- Create: `frontend/src/lib/timeline.ts` + `frontend/src/lib/timeline.test.ts`

**Camada de dados (modificar)**
- Modify: `frontend/src/types/api.types.ts` (KPI-07B, `horas`, `grupo`, GRUPOS, KPI_META)
- Modify: `frontend/src/schemas/api.schemas.ts` (KPI-07B, `horas`)
- Modify: `frontend/src/stores/useFilterStore.ts` (`grupo`)
- Modify: `frontend/src/mocks/kpis.mock.ts` (KPI-07B em horas)
- Create: `frontend/src/mocks/jornada.mock.ts`
- Modify: `frontend/src/services/api.ts` (`getJornada`)
- Create: `frontend/src/stores/useJornadaStore.ts`
- Modify: `frontend/src/stores/useGargaloStore.ts` (filtro de métrica `kpi_codes`)

**Primitivos (novo, `src/components/ui/`)**
- Create: `Icon.vue`, `BaseCard.vue`, `Badge.vue`, `BaseButton.vue`, `Tooltip.vue`, `Stat.vue`, `BarRow.vue`, `RankBar.vue`, `SegmentedControl.vue`, `FilterSelect.vue`, `Skeleton.vue`, `EmptyState.vue` (modify existente), `ErrorState.vue` (modify existente), `ThemeToggle.vue`, `TimelineItem.vue`, `TimelineConnector.vue`

**Shell**
- Create: `frontend/src/stores/useThemeStore.ts`
- Modify: `App.vue`, `components/ui/AppHeader.vue`, `components/ui/AppSidebar.vue`, `components/ui/BottomNav.vue`, `components/ui/FilterBar.vue`

**Views**
- Modify: `components/kpis/KpiCard.vue`, `components/kpis/KpiGrid.vue`, `components/kpis/KpiBreakdownBar.vue`
- Modify: `views/DashboardView.vue`
- Modify: `components/gargalos/GargaloList.vue`, `components/gargalos/GargaloItem.vue`, `views/GargalosView.vue`
- Create: `views/JornadaView.vue`
- Modify: `router/index.ts` (`/jornada`, redirect `/eventos`)

**Limpeza**
- Delete: `views/EventosView.vue`, `components/eventos/*`, `components/ui/UnitSelector.vue`, `components/ui/SkeletonCard.vue` (substituído por `Skeleton.vue`)

**Docs**
- Modify: `docs/GUIA-FRONTEND.md`, `docs/HANDOFF.md`

---

## Phase 0 — Tooling

### Task 1: Adicionar Vitest (dev-only) + smoke test

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Test: `frontend/src/lib/smoke.test.ts` (temporário)

- [ ] **Step 1: Instalar Vitest como devDependency**

Run (no diretório `frontend/`):
```bash
cd frontend && npm install -D vitest@^2.0.0
```
Expected: `package.json` ganha `"vitest"` em `devDependencies`; `package-lock.json` atualizado.

- [ ] **Step 2: Adicionar scripts de teste ao `package.json`**

Em `frontend/package.json`, no bloco `"scripts"`, adicionar:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```
(deixar `dev`, `build`, `preview`, `type-check` como estão).

- [ ] **Step 3: Configurar o bloco `test` no `vite.config.ts`**

Em `frontend/vite.config.ts`, adicionar a referência de tipos na 1ª linha e o bloco `test`:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Escrever um smoke test temporário**

Create `frontend/src/lib/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('vitest smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Rodar e verificar que passa**

Run: `cd frontend && npm run test`
Expected: PASS (1 test passed).

- [ ] **Step 6: Remover o smoke test e commitar**

```bash
rm frontend/src/lib/smoke.test.ts
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts
git commit -m "chore(front): add vitest for pure-logic helpers (dev-only)"
```

---

## Phase 1 — Design tokens

### Task 2: Escala de intensidade nos tokens

A escala de intensidade ("termômetro" dos tempos) precisa de 5 níveis nomeados, claros e escuros. Reaproveita as cores semânticas já existentes (`success`, `caution`, `warning`, `danger`).

**Files:**
- Modify: `frontend/tailwind.config.js`

- [ ] **Step 1: Adicionar a paleta `intensity` ao tema**

Em `frontend/tailwind.config.js`, dentro de `theme.extend.colors`, adicionar (logo após o bloco `success`):
```js
        // Escala de intensidade (termômetro de tempos): 0=ótimo … 4=crítico
        intensity: {
          0: '#437a22', // verde (ótimo)
          1: '#9aa61f', // verde-amarelado
          2: '#d19900', // âmbar
          3: '#da7101', // laranja
          4: '#a13544', // vermelho (crítico)
        },
```

- [ ] **Step 2: Verificar build do Tailwind**

Run: `cd frontend && npm run build`
Expected: build conclui sem erro (as classes `bg-intensity-0..4` ficam disponíveis).

- [ ] **Step 3: Commit**

```bash
git add frontend/tailwind.config.js
git commit -m "feat(front): add intensity color scale tokens"
```

---

## Phase 2 — Helpers de lógica (TDD)

### Task 3: `format.ts` — duração e contagem (pt-BR)

**Files:**
- Create: `frontend/src/lib/format.ts`
- Test: `frontend/src/lib/format.test.ts`

- [ ] **Step 1: Escrever os testes (falhando)**

Create `frontend/src/lib/format.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { formatDuration, formatCount } from './format'

describe('formatDuration', () => {
  it('null vira "sem dados"', () => {
    expect(formatDuration(null, 'dias')).toBe('sem dados')
  })
  it('formata dias com vírgula decimal', () => {
    expect(formatDuration(12.4, 'dias')).toBe('12,4 dias')
  })
  it('singular para exatamente 1', () => {
    expect(formatDuration(1, 'dias')).toBe('1 dia')
    expect(formatDuration(1, 'horas')).toBe('1 hora')
  })
  it('inteiro não mostra casa decimal', () => {
    expect(formatDuration(5, 'dias')).toBe('5 dias')
  })
  it('formata horas', () => {
    expect(formatDuration(2.4, 'horas')).toBe('2,4 horas')
  })
  it('zero é plural', () => {
    expect(formatDuration(0, 'horas')).toBe('0 horas')
  })
})

describe('formatCount', () => {
  it('abaixo de mil mostra cru', () => {
    expect(formatCount(850)).toBe('850')
  })
  it('milhares com "mil"', () => {
    expect(formatCount(45230)).toBe('45 mil')
  })
  it('milhões com "mi" e vírgula', () => {
    expect(formatCount(1_200_000)).toBe('1,2 mi')
  })
})
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `cd frontend && npm run test`
Expected: FAIL ("Cannot find module './format'" ou export ausente).

- [ ] **Step 3: Implementar `format.ts`**

Create `frontend/src/lib/format.ts`:
```ts
export type UnidadeTempo = 'dias' | 'horas'

const SINGULAR: Record<UnidadeTempo, string> = { dias: 'dia', horas: 'hora' }

/** Número pt-BR: vírgula decimal, sem casa quando inteiro, 1 casa quando fracionário. */
function fmtNumber(v: number): string {
  return Number.isInteger(v)
    ? String(v)
    : v.toFixed(1).replace('.', ',')
}

/** "12,4 dias" / "1 hora" / "sem dados" para null. */
export function formatDuration(value: number | null, unit: UnidadeTempo): string {
  if (value === null) return 'sem dados'
  const palavra = value === 1 ? SINGULAR[unit] : unit
  return `${fmtNumber(value)} ${palavra}`
}

/** "850" / "45 mil" / "1,2 mi". */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (n >= 1_000) return `${Math.round(n / 1_000)} mil`
  return String(n)
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npm run test`
Expected: PASS (todos os testes de format).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/format.ts frontend/src/lib/format.test.ts
git commit -m "feat(front): add pt-BR duration/count formatters with tests"
```

### Task 4: `intensity.ts` — escala de intensidade

**Files:**
- Create: `frontend/src/lib/intensity.ts`
- Test: `frontend/src/lib/intensity.test.ts`

- [ ] **Step 1: Escrever os testes (falhando)**

Create `frontend/src/lib/intensity.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { intensityLevel, intensityBarClass } from './intensity'

describe('intensityLevel', () => {
  it('mínimo é nível 0', () => {
    expect(intensityLevel(0, 0, 100)).toBe(0)
  })
  it('máximo é nível 4', () => {
    expect(intensityLevel(100, 0, 100)).toBe(4)
  })
  it('meio é nível 2', () => {
    expect(intensityLevel(50, 0, 100)).toBe(2)
  })
  it('clampa abaixo do mínimo', () => {
    expect(intensityLevel(-10, 0, 100)).toBe(0)
  })
  it('clampa acima do máximo', () => {
    expect(intensityLevel(200, 0, 100)).toBe(4)
  })
  it('intervalo degenerado (min==max) → 0', () => {
    expect(intensityLevel(5, 5, 5)).toBe(0)
  })
})

describe('intensityBarClass', () => {
  it('mapeia nível para classe de fundo', () => {
    expect(intensityBarClass(0)).toBe('bg-intensity-0')
    expect(intensityBarClass(4)).toBe('bg-intensity-4')
  })
})
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `cd frontend && npm run test`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `intensity.ts`**

Create `frontend/src/lib/intensity.ts`:
```ts
export type IntensityLevel = 0 | 1 | 2 | 3 | 4

/** Normaliza value em [min,max] para um dos 5 níveis (0=baixo … 4=alto). */
export function intensityLevel(value: number, min: number, max: number): IntensityLevel {
  if (max <= min) return 0
  const clamped = Math.min(max, Math.max(min, value))
  const ratio = (clamped - min) / (max - min)
  return Math.round(ratio * 4) as IntensityLevel
}

const BAR_CLASSES: Record<IntensityLevel, string> = {
  0: 'bg-intensity-0',
  1: 'bg-intensity-1',
  2: 'bg-intensity-2',
  3: 'bg-intensity-3',
  4: 'bg-intensity-4',
}

export function intensityBarClass(level: IntensityLevel): string {
  return BAR_CLASSES[level]
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/intensity.ts frontend/src/lib/intensity.test.ts
git commit -m "feat(front): add intensity scale helper with tests"
```

### Task 5: `timeline.ts` — intervalo e ordenação

**Files:**
- Create: `frontend/src/lib/timeline.ts`
- Test: `frontend/src/lib/timeline.test.ts`

- [ ] **Step 1: Escrever os testes (falhando)**

Create `frontend/src/lib/timeline.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { elapsedLabel, sortByTimestampAsc } from './timeline'
import type { EventoItem } from '@/types/api.types'

function ev(id: string, ts: string): EventoItem {
  return {
    evento_id: id, paciente_id: '1', tipo_entidade: 'CONSULTA', entidade_id: id,
    timestamp_principal: ts, unidade: 'U', especialidade: 'E',
    tipo_evento: 't', situacao: 's',
  }
}

describe('elapsedLabel', () => {
  it('mesmo dia', () => {
    expect(elapsedLabel('2026-03-01T08:00:00', '2026-03-01T15:00:00')).toBe('no mesmo dia')
  })
  it('horas quando < 1 dia mas dias diferentes não se aplica; usa dias', () => {
    expect(elapsedLabel('2026-03-01T00:00:00', '2026-03-09T00:00:00')).toBe('8 dias depois')
  })
  it('1 dia singular', () => {
    expect(elapsedLabel('2026-03-01T00:00:00', '2026-03-02T00:00:00')).toBe('1 dia depois')
  })
})

describe('sortByTimestampAsc', () => {
  it('ordena do mais antigo para o mais novo, sem mutar o original', () => {
    const input = [ev('b', '2026-03-05T00:00:00'), ev('a', '2026-03-01T00:00:00')]
    const out = sortByTimestampAsc(input)
    expect(out.map((e) => e.evento_id)).toEqual(['a', 'b'])
    expect(input[0].evento_id).toBe('b') // original intacto
  })
})
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `cd frontend && npm run test`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `timeline.ts`**

Create `frontend/src/lib/timeline.ts`:
```ts
import type { EventoItem } from '@/types/api.types'

const MS_DIA = 86_400_000

/** Rótulo do intervalo entre dois eventos cronológicos: "8 dias depois" / "no mesmo dia". */
export function elapsedLabel(fromISO: string, toISO: string): string {
  const from = new Date(fromISO).getTime()
  const to = new Date(toISO).getTime()
  const dias = Math.floor((to - from) / MS_DIA)
  if (dias <= 0) return 'no mesmo dia'
  return dias === 1 ? '1 dia depois' : `${dias} dias depois`
}

/** Cópia ordenada por timestamp ascendente (não muta a entrada). */
export function sortByTimestampAsc(events: EventoItem[]): EventoItem[] {
  return [...events].sort(
    (a, b) =>
      new Date(a.timestamp_principal).getTime() - new Date(b.timestamp_principal).getTime(),
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/timeline.ts frontend/src/lib/timeline.test.ts
git commit -m "feat(front): add timeline elapsed/sort helpers with tests"
```

---

## Phase 3 — Camada de dados

### Task 6: Estender tipos, schema e filtros (KPI-07B, `horas`, `grupo`, GRUPOS)

**Files:**
- Modify: `frontend/src/types/api.types.ts`
- Modify: `frontend/src/schemas/api.schemas.ts`
- Modify: `frontend/src/stores/useFilterStore.ts`

- [ ] **Step 1: Estender `api.types.ts`**

Em `frontend/src/types/api.types.ts`:

(a) Trocar a definição de `KpiCode` e `BaseFilterParams`:
```ts
export type KpiCode = 'KPI-01' | 'KPI-03' | 'KPI-05' | 'KPI-06' | 'KPI-07' | 'KPI-07B'
export type GroupBy = 'unidade' | 'especialidade'
```
```ts
export interface BaseFilterParams {
  grupo?: string
  unidade?: string
  especialidade?: string
  data_inicio?: string  // YYYY-MM-DD
  data_fim?: string     // YYYY-MM-DD
}
```

(b) Em `KpiItem`, trocar `unidade_tempo`:
```ts
  unidade_tempo: 'dias' | 'horas'
```

(c) Substituir o bloco `KPI_META` inteiro (remover emojis; descrições legíveis = títulos; meta do KPI-07B):
```ts
export interface KpiMeta {
  label: string
  /** chave de ícone para o componente Icon */
  icon: string
  aviso?: string
  nota?: string
  /** meta em horas (só KPI-07B) */
  metaHoras?: number
}

export const KPI_META: Record<KpiCode, KpiMeta> = {
  'KPI-01': { label: 'Prontuário → 1º evento assistencial', icon: 'clipboard' },
  'KPI-03': { label: 'Agendamento → realização da consulta', icon: 'calendar' },
  'KPI-05': {
    label: 'Solicitação → realização do exame',
    icon: 'flask',
    aviso: 'Dados de exames limitados a jan–mai/2026',
  },
  'KPI-06': { label: 'Última consulta → internação', icon: 'hospital' },
  'KPI-07': {
    label: 'Permanência no leito',
    icon: 'bed',
    nota: 'Permanência no leito, não tempo até alta médica',
  },
  'KPI-07B': {
    label: 'Alta médica → saída do leito',
    icon: 'bed',
    metaHoras: 4,
  },
}
```

(d) Adicionar a constante `GRUPOS` (após `UNIDADES`/`ESPECIALIDADES`):
```ts
export const GRUPOS = [
  'Ambulatorial',
  'Internação',
  'Análises Clínicas',
  'Diagnóstico por Imagem',
  'Anatomia Patológica',
  'Procedimental',
  'Serviços de Apoio',
] as const

export type Grupo = typeof GRUPOS[number]
```

- [ ] **Step 2: Estender `api.schemas.ts`**

Em `frontend/src/schemas/api.schemas.ts`:

(a) Atualizar `KpiCodeSchema`:
```ts
const KpiCodeSchema = z.enum(['KPI-01', 'KPI-03', 'KPI-05', 'KPI-06', 'KPI-07', 'KPI-07B'])
```
(b) Em `KpiItemSchema`, trocar `unidade_tempo`:
```ts
  unidade_tempo: z.enum(['dias', 'horas']),
```

- [ ] **Step 3: Adicionar `grupo` ao `useFilterStore`**

Em `frontend/src/stores/useFilterStore.ts`:

(a) Após `const unidade = ref<string | null>(null)`, adicionar:
```ts
  const grupo = ref<string | null>(null)
```
(b) Em `activeFilters`, adicionar a chave `grupo`:
```ts
  const activeFilters = computed(() => ({
    grupo:        grupo.value        ?? undefined,
    unidade:      unidade.value      ?? undefined,
    especialidade: especialidade.value ?? undefined,
    data_inicio:  dataInicio.value   ?? undefined,
    data_fim:     dataFim.value      ?? undefined,
    group_by:     groupBy.value,
  }))
```
(c) Em `activeCount`, contar `grupo`:
```ts
    if (grupo.value)        count++
```
(d) Adicionar a action e expor:
```ts
  function setGrupo(g: string | null): void {
    grupo.value = grupo.value === g ? null : g
  }
```
(e) Em `reset()`, adicionar `grupo.value = null`.
(f) No `return`, adicionar `grupo` e `setGrupo`.

- [ ] **Step 4: Type-check**

Run: `cd frontend && npm run type-check`
Expected: erros esperados em arquivos que ainda usam `KPI_META[...].icon` como emoji / `unidade_tempo` literal — serão resolvidos nas tarefas seguintes. **Anotar quais arquivos acusaram erro** (KpiCard, mocks). Não commitar ainda se `type-check` falhar fora dos arquivos previstos.

> Nota: como esta task deixa o type-check temporariamente vermelho (KpiCard usa emoji), commitamos junto com a Task 7 (mocks) e Task 15 (KpiCard). Para manter commits atômicos e verdes, **só commitar tipos+schema+store após a Task 7**; seguir direto.

- [ ] **Step 5: Commit (após Task 7 deixar mocks coerentes)**

Marcado para depois da Task 7. Seguir para a Task 7.

### Task 7: Mocks — KPI-07B (horas) e Jornada por paciente

**Files:**
- Modify: `frontend/src/mocks/kpis.mock.ts`
- Create: `frontend/src/mocks/jornada.mock.ts`

- [ ] **Step 1: Adicionar KPI-07B ao `kpis.mock.ts`**

Em `frontend/src/mocks/kpis.mock.ts`:

(a) Em `BASE_MEDIAS`, `N_GLOBAL` e `DESCRICOES`, adicionar a entrada `KPI-07B` (valor em horas):
```ts
const BASE_MEDIAS: Record<KpiCode, number> = {
  'KPI-01': 14.2,
  'KPI-03': 12.4,
  'KPI-05': 8.7,
  'KPI-06': 21.3,
  'KPI-07': 4.8,
  'KPI-07B': 2.4, // horas (alta médica → saída efetiva)
}

const N_GLOBAL: Record<KpiCode, number> = {
  'KPI-01': 45230,
  'KPI-03': 130000,
  'KPI-05': 28100,
  'KPI-06': 8920,
  'KPI-07': 12300,
  'KPI-07B': 12300,
}

const DESCRICOES: Record<KpiCode, string> = {
  'KPI-01': 'Tempo prontuário → 1º evento assistencial',
  'KPI-03': 'Tempo agendamento → realização (consulta)',
  'KPI-05': 'Tempo solicitação → realização (exame)',
  'KPI-06': 'Tempo última consulta → internação',
  'KPI-07': 'Tempo de permanência no leito',
  'KPI-07B': 'Tempo alta médica → saída do leito',
}
```

(b) Trocar `allCodes` para incluir KPI-07B:
```ts
  const allCodes: KpiCode[] = ['KPI-01', 'KPI-03', 'KPI-05', 'KPI-06', 'KPI-07', 'KPI-07B']
```

(c) No `map`, definir `unidade_tempo` por código (KPI-07B = horas) e zerar breakdown do KPI-07B (sub-métrica simples, sem breakdown):
```ts
  const kpis = codes.map((codigo) => {
    const baseMedia = BASE_MEDIAS[codigo] * fator
    const isKpi05NoData = codigo === 'KPI-05' && params.especialidade === 'CIRURGIA GERAL'
    const isHoras = codigo === 'KPI-07B'

    return {
      codigo,
      descricao: DESCRICOES[codigo],
      unidade_tempo: (isHoras ? 'horas' : 'dias') as 'dias' | 'horas',
      media_global: isKpi05NoData ? null : +baseMedia.toFixed(1),
      n_global: isKpi05NoData ? 0 : Math.floor(N_GLOBAL[codigo] * fator),
      breakdown: isKpi05NoData || isHoras ? [] : gerarBreakdown(baseMedia, codigo, groupBy),
    }
  })
```

- [ ] **Step 2: Criar o mock da Jornada**

Create `frontend/src/mocks/jornada.mock.ts`:
```ts
import type { EventoItem, TipoEntidade } from '@/types/api.types'
import { UNIDADES, ESPECIALIDADES } from '@/types/api.types'

// Sequência clínica plausível de uma jornada
const SEQUENCIA: { tipo: TipoEntidade; tipo_evento: string; situacao: string; offsetDias: number }[] = [
  { tipo: 'PRONTUARIO', tipo_evento: 'Abertura de prontuário', situacao: 'ATIVO',            offsetDias: 0 },
  { tipo: 'CONSULTA',   tipo_evento: 'Consulta inicial',       situacao: 'PACIENTE ATENDIDO', offsetDias: 12 },
  { tipo: 'EXAME',      tipo_evento: 'Exame laboratorial',     situacao: 'REALIZADO',         offsetDias: 20 },
  { tipo: 'CONSULTA',   tipo_evento: 'Consulta de retorno',    situacao: 'PACIENTE ATENDIDO', offsetDias: 41 },
  { tipo: 'INTERNACAO', tipo_evento: 'Internação eletiva',     situacao: 'INTERNADO',         offsetDias: 55 },
  { tipo: 'CIRURGIA',   tipo_evento: 'Cirurgia eletiva',       situacao: 'REALIZADA',         offsetDias: 57 },
  { tipo: 'ALTA',       tipo_evento: 'Alta médica',            situacao: 'CONCLUÍDA',         offsetDias: 60 },
]

/** Hash determinístico simples de uma string para semear a jornada. */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2147483647
  return h
}

function isoFromBase(baseMs: number, offsetDias: number): string {
  return new Date(baseMs + offsetDias * 86_400_000).toISOString().replace('.000Z', '')
}

/** Eventos cronológicos de um paciente (mock determinístico por prontuário). */
export function mockJornada(pacienteId: string): EventoItem[] {
  const h = hash(pacienteId)
  const unidade = UNIDADES[h % UNIDADES.length]
  const especialidade = ESPECIALIDADES[h % ESPECIALIDADES.length]
  const baseMs = new Date('2026-01-05T08:00:00').getTime() + (h % 30) * 86_400_000

  return SEQUENCIA.map((s, i) => ({
    evento_id: `${s.tipo.charAt(0)}-${pacienteId}-${i}`,
    paciente_id: pacienteId,
    tipo_entidade: s.tipo,
    entidade_id: `${h + i}`,
    timestamp_principal: isoFromBase(baseMs, s.offsetDias),
    unidade,
    especialidade,
    tipo_evento: s.tipo_evento,
    situacao: s.situacao,
  }))
}
```

- [ ] **Step 3: Type-check (agora deve passar para tipos/schema/store/mocks)**

Run: `cd frontend && npm run type-check`
Expected: os erros restantes ficam só em `KpiCard.vue` (usa `meta.icon` como emoji e `aviso`/`nota` em banners) — será reescrito na Task 15. Se aparecer erro em outro arquivo de dados, corrigir antes de seguir.

- [ ] **Step 4: Commit (tipos + schema + store + mocks juntos)**

```bash
git add frontend/src/types/api.types.ts frontend/src/schemas/api.schemas.ts frontend/src/stores/useFilterStore.ts frontend/src/mocks/kpis.mock.ts frontend/src/mocks/jornada.mock.ts
git commit -m "feat(front): extend data layer for KPI-07B (horas), grupo filter and jornada mock"
```

### Task 8: Serviço e store da Jornada

**Files:**
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/stores/useJornadaStore.ts`

- [ ] **Step 1: Adicionar `getJornada` ao serviço**

Em `frontend/src/services/api.ts`:

(a) No import dos mocks, adicionar:
```ts
import { mockJornada } from '@/mocks/jornada.mock'
```
(b) Ao final do arquivo, adicionar a função (com a dependência de backend anotada):
```ts
/**
 * Eventos cronológicos de UM paciente (tela Jornada).
 * MOCK nesta fase. Backend real (Fase 4/6): adicionar filtro `paciente_id`
 * ao GET /eventos (ou endpoint /jornada/{paciente_id}). Ver
 * docs/superpowers/specs/2026-06-26-fase-7-frontend-redesign-design.md §11.
 */
export async function getJornada(pacienteId: string): Promise<EventoItem[]> {
  if (USE_MOCK) {
    await delay(450)
    return mockJornada(pacienteId)
  }
  const { data } = await client.get<EventosResponse>('/eventos', {
    params: { paciente_id: pacienteId, limit: 500 },
  })
  return EventosResponseSchema.parse(data).items
}
```
(c) Garantir que `EventoItem` está importado no topo (adicionar a `import type { ... }`):
```ts
import type { KpiParams, KpiResponse, GargaloParams, GargalosResponse, EventosParams, EventosResponse, EventoItem } from '@/types/api.types'
```

- [ ] **Step 2: Criar `useJornadaStore`**

Create `frontend/src/stores/useJornadaStore.ts`:
```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getJornada } from '@/services/api'
import { sortByTimestampAsc } from '@/lib/timeline'
import type { EventoItem, TipoEntidade } from '@/types/api.types'

/**
 * useJornadaStore — timeline de eventos de um paciente (busca por prontuário).
 * Não observa filtros globais: é dirigido pela busca do usuário.
 */
export const useJornadaStore = defineStore('jornada', () => {
  const pacienteId = ref<string | null>(null)
  const eventos    = ref<EventoItem[]>([])
  const loading    = ref(false)
  const error      = ref<string | null>(null)
  const searched   = ref(false)
  const tipoFiltro = ref<TipoEntidade | null>(null)

  async function buscar(id: string): Promise<void> {
    const trimmed = id.trim()
    if (!trimmed) return
    pacienteId.value = trimmed
    searched.value = true
    loading.value = true
    error.value = null
    try {
      const data = await getJornada(trimmed)
      eventos.value = sortByTimestampAsc(data)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erro ao carregar jornada'
      eventos.value = []
    } finally {
      loading.value = false
    }
  }

  function setTipoFiltro(t: TipoEntidade | null): void {
    tipoFiltro.value = tipoFiltro.value === t ? null : t
  }

  return { pacienteId, eventos, loading, error, searched, tipoFiltro, buscar, setTipoFiltro }
})
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run type-check`
Expected: sem novos erros nestes arquivos (KpiCard ainda vermelho até Task 15).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/stores/useJornadaStore.ts
git commit -m "feat(front): add jornada service + store (mock, paciente_id dependency noted)"
```

### Task 9: Filtro de métrica no `useGargaloStore`

**Files:**
- Modify: `frontend/src/stores/useGargaloStore.ts`

- [ ] **Step 1: Adicionar estado `metricas` (kpi_codes) e incluir no fetch**

Em `frontend/src/stores/useGargaloStore.ts`:

(a) Importar o tipo:
```ts
import type { GargaloItem, KpiCode } from '@/types/api.types'
```
(b) Após `const limit = ref(10)`, adicionar (default = transições do ranking, sem KPI-07B):
```ts
  const metricas = ref<KpiCode[]>(['KPI-03', 'KPI-05', 'KPI-06', 'KPI-07'])
```
(c) Em `fetchGargalos`, incluir `kpi_codes`:
```ts
      const response = await getGargalos({
        ...filterStore.activeFilters,
        kpi_codes: metricas.value,
        limit: limit.value,
      })
```
(d) Adicionar a action e expor:
```ts
  function toggleMetrica(code: KpiCode): void {
    metricas.value = metricas.value.includes(code)
      ? metricas.value.filter((c) => c !== code)
      : [...metricas.value, code]
    void fetchGargalos()
  }
```
(e) No `return`, adicionar `metricas` e `toggleMetrica`.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npm run type-check`
Expected: sem novos erros neste arquivo.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/useGargaloStore.ts
git commit -m "feat(front): add metric (kpi_codes) filter to gargalo store"
```

---

## Phase 4 — Primitivos do design system

### Task 10: `Icon.vue` — set de ícones SVG

Centraliza todos os SVGs (nav, KPIs, tipos de evento, controles). Stroke currentColor, 24x24.

**Files:**
- Create: `frontend/src/components/ui/Icon.vue`

- [ ] **Step 1: Implementar `Icon.vue`**

Create `frontend/src/components/ui/Icon.vue`:
```vue
<script setup lang="ts">
defineProps<{ name: string; size?: number }>()

// Cada ícone é o conteúdo interno de um <svg> 24x24 viewBox, stroke currentColor.
const PATHS: Record<string, string> = {
  // nav
  dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  gargalos: '<path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/>',
  jornada: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M6 8v8"/><path d="M11 6h9"/><path d="M11 18h9"/>',
  // KPIs
  clipboard: '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  hospital: '<rect x="4" y="7" width="16" height="14" rx="1"/><path d="M9 21v-5h6v5M12 4v3M10.5 5.5h3"/>',
  bed: '<path d="M3 7v12M3 13h18v6M21 13a4 4 0 0 0-4-4H9v4"/>',
  // tipos de evento
  consulta: '<circle cx="12" cy="8" r="3"/><path d="M6 20a6 6 0 0 1 12 0"/>',
  exame: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  internacao: '<rect x="4" y="7" width="16" height="14" rx="1"/><path d="M9 21v-5h6v5M12 4v3M10.5 5.5h3"/>',
  prontuario: '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 10h6M9 14h4"/>',
  cirurgia: '<path d="M14 4l6 6-9 9H5v-6z"/><path d="M11 7l6 6"/>',
  procedimento: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
  alta: '<path d="M5 12l5 5L20 7"/>',
  // controles
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
}
</script>

<template>
  <svg
    :width="size ?? 20" :height="size ?? 20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    v-html="PATHS[name] ?? ''"
  />
</template>
```

- [ ] **Step 2: Type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: sem erros novos neste arquivo (KpiCard ainda vermelho — ok, será corrigido na Task 15; se o build falhar só por causa do KpiCard, seguir e commitar apenas o Icon).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/Icon.vue
git commit -m "feat(front): add SVG Icon primitive"
```

### Task 11: Primitivos base — `BaseCard`, `Badge`, `BaseButton`, `Tooltip`

**Files:**
- Create: `frontend/src/components/ui/BaseCard.vue`, `Badge.vue`, `BaseButton.vue`, `Tooltip.vue`

- [ ] **Step 1: `BaseCard.vue`**

Create `frontend/src/components/ui/BaseCard.vue`:
```vue
<script setup lang="ts">
withDefaults(defineProps<{ hover?: boolean; padding?: boolean }>(), { hover: false, padding: true })
</script>

<template>
  <div
    class="rounded-2xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark shadow-card transition-all duration-200"
    :class="[hover ? 'hover:shadow-card-hover hover:-translate-y-0.5' : '', padding ? 'p-5' : '']"
  >
    <slot />
  </div>
</template>
```

- [ ] **Step 2: `Badge.vue`**

Create `frontend/src/components/ui/Badge.vue`:
```vue
<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' }>(), { tone: 'neutral' })

const TONES: Record<string, string> = {
  neutral: 'bg-text/5 text-text-muted dark:bg-white/10 dark:text-text-dark-muted',
  brand:   'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger:  'bg-danger/10 text-danger',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap"
    :class="TONES[tone]"
  >
    <slot />
  </span>
</template>
```

- [ ] **Step 3: `BaseButton.vue`**

Create `frontend/src/components/ui/BaseButton.vue`:
```vue
<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'primary' | 'secondary' | 'ghost'; type?: 'button' | 'submit' }>(), {
  variant: 'secondary', type: 'button',
})

const VARIANTS: Record<string, string> = {
  primary:   'bg-primary text-white hover:bg-primary-hover',
  secondary: 'border border-border dark:border-border-dark text-text dark:text-text-dark hover:bg-surface-offset dark:hover:bg-surface-dark-offset',
  ghost:     'text-text-muted dark:text-text-dark-muted hover:bg-surface-offset dark:hover:bg-surface-dark-offset',
}
</script>

<template>
  <button
    :type="type"
    class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none"
    :class="VARIANTS[variant]"
  >
    <slot />
  </button>
</template>
```

- [ ] **Step 4: `Tooltip.vue` (acessível, hover/foco) — usado nos avisos discretos**

Create `frontend/src/components/ui/Tooltip.vue`:
```vue
<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'

defineProps<{ text: string }>()
const open = ref(false)
</script>

<template>
  <span class="relative inline-flex">
    <button
      type="button" class="text-text-faint hover:text-text-muted dark:text-text-dark-muted"
      :aria-label="text"
      @mouseenter="open = true" @mouseleave="open = false"
      @focus="open = true" @blur="open = false"
    >
      <Icon name="info" :size="15" />
    </button>
    <span
      v-if="open" role="tooltip"
      class="absolute z-20 bottom-full right-0 mb-1.5 w-52 px-2.5 py-1.5 rounded-lg text-[11px] leading-snug text-white bg-text dark:bg-black/90 shadow-lg"
    >
      {{ text }}
    </span>
  </span>
</template>
```

- [ ] **Step 5: Type-check**

Run: `cd frontend && npm run type-check`
Expected: sem novos erros nestes 4 arquivos.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/BaseCard.vue frontend/src/components/ui/Badge.vue frontend/src/components/ui/BaseButton.vue frontend/src/components/ui/Tooltip.vue
git commit -m "feat(front): add base primitives (Card, Badge, Button, Tooltip)"
```

### Task 12: Primitivos de visualização — `Stat`, `BarRow`, `RankBar`

**Files:**
- Create: `frontend/src/components/ui/Stat.vue`, `BarRow.vue`, `RankBar.vue`

- [ ] **Step 1: `Stat.vue` (número grande + sufixo + apoio)**

Create `frontend/src/components/ui/Stat.vue`:
```vue
<script setup lang="ts">
defineProps<{ value: string; caption?: string; muted?: boolean }>()
</script>

<template>
  <div>
    <p
      class="text-3xl font-bold tabular-nums leading-none"
      :class="muted ? 'text-text-faint dark:text-text-dark-muted' : 'text-text dark:text-text-dark'"
    >
      {{ value }}
    </p>
    <p v-if="caption" class="text-xs text-text-muted dark:text-text-dark-muted mt-1.5">
      {{ caption }}
    </p>
  </div>
</template>
```

- [ ] **Step 2: `BarRow.vue` (barra horizontal de breakdown)**

Create `frontend/src/components/ui/BarRow.vue`:
```vue
<script setup lang="ts">
defineProps<{ label: string; value: string; ratio: number; barClass?: string }>()
</script>

<template>
  <div class="flex items-center gap-3 text-xs">
    <span class="w-28 shrink-0 truncate text-text-muted dark:text-text-dark-muted" :title="label">
      {{ label }}
    </span>
    <div class="flex-1 h-2 rounded-full bg-surface-offset dark:bg-surface-dark-offset overflow-hidden">
      <div
        class="h-full rounded-full transition-all duration-500"
        :class="barClass ?? 'bg-primary'"
        :style="{ width: `${Math.max(2, Math.min(100, ratio * 100)).toFixed(1)}%` }"
      />
    </div>
    <span class="w-14 shrink-0 text-right tabular-nums font-medium text-text dark:text-text-dark">
      {{ value }}
    </span>
  </div>
</template>
```

- [ ] **Step 3: `RankBar.vue` (linha do ranking de gargalos)**

Create `frontend/src/components/ui/RankBar.vue`:
```vue
<script setup lang="ts">
defineProps<{
  position: number
  label: string
  value: string
  caption?: string
  ratio: number
  barClass: string
}>()
</script>

<template>
  <div class="flex items-center gap-3 px-5 py-3 border-b border-border dark:border-border-dark last:border-0">
    <span class="w-6 shrink-0 text-sm font-bold tabular-nums text-text-faint dark:text-text-dark-muted">
      {{ position }}
    </span>
    <div class="min-w-0 flex-1">
      <div class="flex items-center justify-between gap-2">
        <span class="truncate text-sm font-medium text-text dark:text-text-dark" :title="label">
          {{ label }}
        </span>
        <span class="shrink-0 tabular-nums text-sm font-semibold text-text dark:text-text-dark">
          {{ value }}
        </span>
      </div>
      <div class="mt-1.5 h-2 rounded-full bg-surface-offset dark:bg-surface-dark-offset overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="barClass"
          :style="{ width: `${Math.max(2, Math.min(100, ratio * 100)).toFixed(1)}%` }"
        />
      </div>
      <p v-if="caption" class="mt-1 text-[11px] text-text-muted dark:text-text-dark-muted">
        {{ caption }}
      </p>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npm run type-check`
Expected: sem novos erros nestes arquivos.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/Stat.vue frontend/src/components/ui/BarRow.vue frontend/src/components/ui/RankBar.vue
git commit -m "feat(front): add data-viz primitives (Stat, BarRow, RankBar)"
```

### Task 13: Primitivos de controle — `SegmentedControl`, `FilterSelect`

**Files:**
- Create: `frontend/src/components/ui/SegmentedControl.vue`, `FilterSelect.vue`

- [ ] **Step 1: `SegmentedControl.vue` (toggle/segmentos com v-model)**

Create `frontend/src/components/ui/SegmentedControl.vue`:
```vue
<script setup lang="ts">
defineProps<{ modelValue: string; options: { value: string; label: string }[] }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="inline-flex p-0.5 rounded-xl bg-surface-offset dark:bg-surface-dark-offset">
    <button
      v-for="opt in options" :key="opt.value" type="button"
      class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
      :class="opt.value === modelValue
        ? 'bg-surface dark:bg-surface-dark text-text dark:text-text-dark shadow-sm'
        : 'text-text-muted dark:text-text-dark-muted hover:text-text dark:hover:text-text-dark'"
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
```

- [ ] **Step 2: `FilterSelect.vue` (select estilizado com placeholder "Todas")**

Create `frontend/src/components/ui/FilterSelect.vue`:
```vue
<script setup lang="ts">
defineProps<{
  modelValue: string | null
  options: readonly string[]
  label: string
  placeholder?: string
}>()
defineEmits<{ 'update:modelValue': [value: string | null] }>()
</script>

<template>
  <label class="flex flex-col gap-1 text-xs">
    <span class="font-medium text-text-muted dark:text-text-dark-muted">{{ label }}</span>
    <select
      class="px-3 py-2 rounded-xl text-sm bg-surface dark:bg-surface-dark border border-border dark:border-border-dark text-text dark:text-text-dark min-w-[10rem]"
      :value="modelValue ?? ''"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">{{ placeholder ?? 'Todas' }}</option>
      <option v-for="opt in options" :key="opt" :value="opt">{{ opt }}</option>
    </select>
  </label>
</template>
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run type-check`
Expected: sem novos erros.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/SegmentedControl.vue frontend/src/components/ui/FilterSelect.vue
git commit -m "feat(front): add control primitives (SegmentedControl, FilterSelect)"
```

### Task 14: Primitivos de estado — `Skeleton`, `EmptyState`, `ErrorState`, `ThemeToggle`

**Files:**
- Create: `frontend/src/components/ui/Skeleton.vue`, `ThemeToggle.vue`
- Modify: `frontend/src/components/ui/EmptyState.vue`, `frontend/src/components/ui/ErrorState.vue`
- Create: `frontend/src/stores/useThemeStore.ts`

- [ ] **Step 1: `useThemeStore.ts` (persiste tema, aplica `data-theme`)**

Create `frontend/src/stores/useThemeStore.ts`:
```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

type Theme = 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>('light')

  function apply(t: Theme): void {
    theme.value = t
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('pija-theme', t)
  }

  function init(): void {
    const saved = localStorage.getItem('pija-theme') as Theme | null
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    apply(saved ?? (prefersDark ? 'dark' : 'light'))
  }

  function toggle(): void {
    apply(theme.value === 'dark' ? 'light' : 'dark')
  }

  return { theme, init, toggle }
})
```

- [ ] **Step 2: `ThemeToggle.vue`**

Create `frontend/src/components/ui/ThemeToggle.vue`:
```vue
<script setup lang="ts">
import { useThemeStore } from '@/stores/useThemeStore'
import Icon from './Icon.vue'
const theme = useThemeStore()
</script>

<template>
  <button
    type="button"
    class="p-2 rounded-xl text-text-muted dark:text-text-dark-muted hover:bg-surface-offset dark:hover:bg-surface-dark-offset transition-colors"
    :aria-label="theme.theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'"
    @click="theme.toggle()"
  >
    <Icon :name="theme.theme === 'dark' ? 'sun' : 'moon'" />
  </button>
</template>
```

- [ ] **Step 3: `Skeleton.vue`**

Create `frontend/src/components/ui/Skeleton.vue`:
```vue
<script setup lang="ts">
withDefaults(defineProps<{ height?: string; rounded?: string }>(), { height: 'h-4', rounded: 'rounded-lg' })
</script>

<template>
  <div class="animate-pulse-soft bg-surface-offset dark:bg-surface-dark-offset" :class="[height, rounded]" />
</template>
```

- [ ] **Step 4: Reescrever `EmptyState.vue`**

Replace `frontend/src/components/ui/EmptyState.vue` com:
```vue
<script setup lang="ts">
import Icon from './Icon.vue'
withDefaults(defineProps<{ title: string; description?: string; icon?: string }>(), { icon: 'search' })
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center py-14 px-6">
    <div class="w-12 h-12 rounded-2xl bg-surface-offset dark:bg-surface-dark-offset flex items-center justify-center text-text-faint dark:text-text-dark-muted">
      <Icon :name="icon" :size="24" />
    </div>
    <p class="mt-3 text-sm font-semibold text-text dark:text-text-dark">{{ title }}</p>
    <p v-if="description" class="mt-1 text-xs text-text-muted dark:text-text-dark-muted max-w-xs">
      {{ description }}
    </p>
  </div>
</template>
```

- [ ] **Step 5: Reescrever `ErrorState.vue` (com retry)**

Replace `frontend/src/components/ui/ErrorState.vue` com:
```vue
<script setup lang="ts">
import BaseButton from './BaseButton.vue'
defineProps<{ message: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center py-14 px-6">
    <div class="w-12 h-12 rounded-2xl bg-danger/10 text-danger flex items-center justify-center text-xl font-bold">!</div>
    <p class="mt-3 text-sm font-semibold text-text dark:text-text-dark">Algo deu errado</p>
    <p class="mt-1 text-xs text-text-muted dark:text-text-dark-muted max-w-xs">{{ message }}</p>
    <BaseButton class="mt-4" variant="secondary" @click="$emit('retry')">Tentar novamente</BaseButton>
  </div>
</template>
```

- [ ] **Step 6: Type-check**

Run: `cd frontend && npm run type-check`
Expected: sem novos erros nestes arquivos. (Se algum componente antigo importava o `EmptyState`/`ErrorState` com props diferentes, anotar — será resolvido na reescrita das views.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/stores/useThemeStore.ts frontend/src/components/ui/ThemeToggle.vue frontend/src/components/ui/Skeleton.vue frontend/src/components/ui/EmptyState.vue frontend/src/components/ui/ErrorState.vue
git commit -m "feat(front): add state primitives (Skeleton, EmptyState, ErrorState, ThemeToggle) + theme store"
```

### Task 15: Primitivos da timeline — `TimelineConnector`, `TimelineItem`

**Files:**
- Create: `frontend/src/components/ui/TimelineConnector.vue`, `TimelineItem.vue`

- [ ] **Step 1: `TimelineConnector.vue` (intervalo entre etapas)**

Create `frontend/src/components/ui/TimelineConnector.vue`:
```vue
<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="flex items-center gap-3 pl-[11px] py-1">
    <div class="w-0.5 h-6 bg-border dark:bg-border-dark" />
    <span class="text-[11px] text-text-muted dark:text-text-dark-muted italic">{{ label }}</span>
  </div>
</template>
```

- [ ] **Step 2: `TimelineItem.vue`**

Create `frontend/src/components/ui/TimelineItem.vue`:
```vue
<script setup lang="ts">
import Icon from './Icon.vue'
import Badge from './Badge.vue'
import type { EventoItem } from '@/types/api.types'

defineProps<{ evento: EventoItem }>()

const ICON: Record<string, string> = {
  CONSULTA: 'consulta', EXAME: 'exame', INTERNACAO: 'internacao', PRONTUARIO: 'prontuario',
  CIRURGIA: 'cirurgia', PROCEDIMENTO: 'procedimento', ALTA: 'alta',
}
const DOT: Record<string, string> = {
  CONSULTA: 'bg-evento-consulta', EXAME: 'bg-evento-exame', INTERNACAO: 'bg-evento-internacao',
  PRONTUARIO: 'bg-evento-prontuario', CIRURGIA: 'bg-evento-cirurgia',
  PROCEDIMENTO: 'bg-evento-procedimento', ALTA: 'bg-evento-alta',
}

function fmtData(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="flex gap-3">
    <div class="flex flex-col items-center">
      <span class="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0" :class="DOT[evento.tipo_entidade]">
        <Icon :name="ICON[evento.tipo_entidade]" :size="13" />
      </span>
    </div>
    <div class="min-w-0 flex-1 pb-1">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm font-semibold text-text dark:text-text-dark">{{ evento.tipo_evento }}</span>
        <Badge tone="neutral">{{ evento.situacao }}</Badge>
      </div>
      <p class="text-xs text-text-muted dark:text-text-dark-muted mt-0.5">
        {{ fmtData(evento.timestamp_principal) }} · {{ evento.unidade }} · {{ evento.especialidade }}
      </p>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run type-check`
Expected: sem novos erros.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/TimelineConnector.vue frontend/src/components/ui/TimelineItem.vue
git commit -m "feat(front): add timeline primitives (Connector, Item)"
```

---

## Phase 5 — Shell & filtros

### Task 16: App shell — Topbar, Sidebar, BottomNav, App.vue

**Files:**
- Modify: `frontend/src/components/ui/AppHeader.vue`, `AppSidebar.vue`, `BottomNav.vue`, `frontend/src/App.vue`
- Modify: `frontend/src/main.ts` (init do tema)

- [ ] **Step 1: Inicializar o tema no boot**

Em `frontend/src/main.ts`, após `app.use(createPinia())` e antes de `app.mount`, inicializar o tema:
```ts
import { useThemeStore } from './stores/useThemeStore'
// ...
app.use(createPinia())
app.use(router)
useThemeStore().init()
app.mount('#app')
```

- [ ] **Step 2: Reescrever `AppHeader.vue` (topbar com marca + ThemeToggle)**

Replace `frontend/src/components/ui/AppHeader.vue` com:
```vue
<script setup lang="ts">
import Icon from './Icon.vue'
import ThemeToggle from './ThemeToggle.vue'
</script>

<template>
  <header class="sticky top-0 z-30 h-14 flex items-center justify-between px-4 md:px-6 bg-surface/90 dark:bg-surface-dark/90 backdrop-blur border-b border-border dark:border-border-dark">
    <div class="flex items-center gap-2.5">
      <span class="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center">
        <Icon name="jornada" :size="18" />
      </span>
      <div class="leading-tight">
        <p class="text-sm font-bold text-text dark:text-text-dark tracking-tight">PIJA</p>
        <p class="text-[10px] text-text-muted dark:text-text-dark-muted">Jornada Assistencial · HC-UFPE</p>
      </div>
    </div>
    <ThemeToggle />
  </header>
</template>
```

- [ ] **Step 3: Reescrever `AppSidebar.vue` (3 itens)**

Replace `frontend/src/components/ui/AppSidebar.vue` com:
```vue
<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Icon from './Icon.vue'

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/gargalos',  label: 'Gargalos',  icon: 'gargalos' },
  { to: '/jornada',   label: 'Jornada',   icon: 'jornada' },
]
</script>

<template>
  <aside class="hidden md:flex flex-col w-56 shrink-0 border-r border-border dark:border-border-dark p-3 gap-1">
    <RouterLink
      v-for="item in items" :key="item.to" :to="item.to"
      class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
      active-class="bg-primary/10 text-primary"
      :class="'text-text-muted dark:text-text-dark-muted hover:bg-surface-offset dark:hover:bg-surface-dark-offset'"
    >
      <Icon :name="item.icon" :size="18" />
      {{ item.label }}
    </RouterLink>
  </aside>
</template>
```

- [ ] **Step 4: Reescrever `BottomNav.vue` (mobile, 3 itens)**

Replace `frontend/src/components/ui/BottomNav.vue` com:
```vue
<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Icon from './Icon.vue'

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/gargalos',  label: 'Gargalos',  icon: 'gargalos' },
  { to: '/jornada',   label: 'Jornada',   icon: 'jornada' },
]
</script>

<template>
  <nav class="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 flex items-stretch bg-surface/95 dark:bg-surface-dark/95 backdrop-blur border-t border-border dark:border-border-dark">
    <RouterLink
      v-for="item in items" :key="item.to" :to="item.to"
      class="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors"
      active-class="text-primary"
      :class="'text-text-muted dark:text-text-dark-muted'"
    >
      <Icon :name="item.icon" :size="20" />
      {{ item.label }}
    </RouterLink>
  </nav>
</template>
```

- [ ] **Step 5: Ajustar `App.vue` (remover dependência de `bg-surface` antigo, manter layout)**

O `App.vue` atual já compõe Header/Sidebar/BottomNav e funciona. Confirmar que continua compilando após as reescritas (nenhuma prop nova é exigida). Sem mudança de código necessária além de garantir que os imports resolvem.

- [ ] **Step 6: Type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: pode ainda falhar **apenas** por `KpiCard.vue`/`FilterBar.vue`/views antigas — anotar. Se falhar só nesses, seguir (serão reescritos nas próximas tasks). Se falhar no shell, corrigir.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/main.ts frontend/src/components/ui/AppHeader.vue frontend/src/components/ui/AppSidebar.vue frontend/src/components/ui/BottomNav.vue
git commit -m "feat(front): redesign app shell (topbar, sidebar, bottom-nav) + theme init"
```

### Task 17: Barra de filtros globais

**Files:**
- Modify: `frontend/src/components/ui/FilterBar.vue`
- Delete: `frontend/src/components/ui/UnitSelector.vue` (absorvido pela FilterBar)

**Filtros:** Grupo, Unidade (executora), Especialidade, Período (início/fim), e `SegmentedControl` unidade↔especialidade (`group_by`). Chips de ativos + "limpar".

- [ ] **Step 1: Reescrever `FilterBar.vue`**

Replace `frontend/src/components/ui/FilterBar.vue` com:
```vue
<script setup lang="ts">
import { useFilterStore } from '@/stores/useFilterStore'
import { GRUPOS, UNIDADES, ESPECIALIDADES } from '@/types/api.types'
import FilterSelect from './FilterSelect.vue'
import SegmentedControl from './SegmentedControl.vue'
import BaseButton from './BaseButton.vue'

const filter = useFilterStore()

const groupByOptions = [
  { value: 'unidade', label: 'Por unidade' },
  { value: 'especialidade', label: 'Por especialidade' },
]
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-end gap-3">
      <FilterSelect
        label="Grupo" :options="GRUPOS"
        :model-value="filter.grupo"
        @update:model-value="filter.setGrupo($event)"
      />
      <FilterSelect
        label="Unidade executora" :options="UNIDADES"
        :model-value="filter.unidade"
        @update:model-value="filter.setUnidade($event)"
      />
      <FilterSelect
        label="Especialidade" :options="ESPECIALIDADES"
        :model-value="filter.especialidade"
        @update:model-value="filter.setEspecialidade($event)"
      />
      <label class="flex flex-col gap-1 text-xs">
        <span class="font-medium text-text-muted dark:text-text-dark-muted">De</span>
        <input
          type="date" class="px-3 py-2 rounded-xl text-sm bg-surface dark:bg-surface-dark border border-border dark:border-border-dark text-text dark:text-text-dark"
          :value="filter.dataInicio ?? ''"
          @change="filter.setDataInicio(($event.target as HTMLInputElement).value || null)"
        />
      </label>
      <label class="flex flex-col gap-1 text-xs">
        <span class="font-medium text-text-muted dark:text-text-dark-muted">Até</span>
        <input
          type="date" class="px-3 py-2 rounded-xl text-sm bg-surface dark:bg-surface-dark border border-border dark:border-border-dark text-text dark:text-text-dark"
          :value="filter.dataFim ?? ''"
          @change="filter.setDataFim(($event.target as HTMLInputElement).value || null)"
        />
      </label>
      <div class="ml-auto flex items-center gap-3">
        <SegmentedControl
          :model-value="filter.groupBy" :options="groupByOptions"
          @update:model-value="filter.setGroupBy($event as 'unidade' | 'especialidade')"
        />
        <BaseButton v-if="filter.activeCount > 0" variant="ghost" @click="filter.reset()">
          Limpar ({{ filter.activeCount }})
        </BaseButton>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Apagar o `UnitSelector.vue`**

```bash
git rm frontend/src/components/ui/UnitSelector.vue
```
(O `DashboardView` que o importava será reescrito na Task 19.)

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run type-check`
Expected: pode falhar só em `DashboardView.vue` (ainda importa `UnitSelector`) — será resolvido na Task 19.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/FilterBar.vue
git commit -m "feat(front): global filter bar with grupo/unidade/especialidade/period + group_by"
```

---

## Phase 6 — Views

### Task 18: KPI — `KpiBreakdownBar`, `KpiCard`, `KpiGrid`

**Files:**
- Modify: `frontend/src/components/kpis/KpiBreakdownBar.vue`, `KpiCard.vue`, `KpiGrid.vue`

- [ ] **Step 1: Reescrever `KpiBreakdownBar.vue` (usa `BarRow`)**

Replace `frontend/src/components/kpis/KpiBreakdownBar.vue` com:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import BarRow from '@/components/ui/BarRow.vue'
import { formatDuration } from '@/lib/format'
import type { BreakdownItem } from '@/types/api.types'

const props = withDefaults(defineProps<{ items: BreakdownItem[]; maxItems?: number; unit?: 'dias' | 'horas' }>(), {
  maxItems: 5, unit: 'dias',
})

const top = computed(() => props.items.slice(0, props.maxItems))
const max = computed(() => Math.max(...props.items.map((i) => i.media), 0.0001))
</script>

<template>
  <div class="flex flex-col gap-2">
    <BarRow
      v-for="item in top" :key="item.dimensao"
      :label="item.dimensao"
      :value="formatDuration(item.media, unit)"
      :ratio="item.media / max"
    />
  </div>
</template>
```

- [ ] **Step 2: Reescrever `KpiCard.vue` (título = descrição, aviso/nota só em Tooltip, KPI-07B aninhado)**

Replace `frontend/src/components/kpis/KpiCard.vue` com:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { KpiItem } from '@/types/api.types'
import { KPI_META } from '@/types/api.types'
import { formatDuration, formatCount } from '@/lib/format'
import { intensityLevel, intensityBarClass } from '@/lib/intensity'
import BaseCard from '@/components/ui/BaseCard.vue'
import Icon from '@/components/ui/Icon.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import KpiBreakdownBar from './KpiBreakdownBar.vue'

const props = defineProps<{ kpi: KpiItem; submetric?: KpiItem }>()

const meta = computed(() => KPI_META[props.kpi.codigo])
const subMeta = computed(() => (props.submetric ? KPI_META[props.submetric.codigo] : null))

// Indicador de meta do KPI-07B (≤4h = ok). Nível de intensidade 0..4 em [0, 2*meta].
const subBarClass = computed(() => {
  if (!props.submetric || props.submetric.media_global === null || !subMeta.value?.metaHoras) return 'bg-primary'
  const lvl = intensityLevel(props.submetric.media_global, 0, subMeta.value.metaHoras * 2)
  return intensityBarClass(lvl)
})
const subMeetsTarget = computed(() =>
  props.submetric?.media_global !== null && props.submetric !== undefined && subMeta.value?.metaHoras !== undefined
    ? (props.submetric.media_global as number) <= subMeta.value.metaHoras
    : false,
)
</script>

<template>
  <BaseCard hover class="flex flex-col gap-4 animate-fade-in">
    <!-- Cabeçalho: ícone + título descritivo + aviso discreto -->
    <header class="flex items-start gap-3">
      <span class="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        <Icon :name="meta.icon" :size="18" />
      </span>
      <h2 class="min-w-0 flex-1 text-sm font-semibold text-text dark:text-text-dark leading-snug">
        {{ kpi.descricao }}
      </h2>
      <Tooltip v-if="meta.aviso || meta.nota" :text="meta.aviso ?? meta.nota ?? ''" />
    </header>

    <!-- Valor principal -->
    <div>
      <div v-if="kpi.media_global !== null" class="flex items-baseline gap-1.5">
        <span class="text-3xl font-bold tabular-nums text-text dark:text-text-dark">
          {{ formatDuration(kpi.media_global, kpi.unidade_tempo) }}
        </span>
      </div>
      <span v-else class="text-sm italic text-text-faint dark:text-text-dark-muted">sem dados no recorte</span>
      <p class="text-xs text-text-muted dark:text-text-dark-muted mt-1">
        {{ kpi.n_global > 0 ? `baseado em ${formatCount(kpi.n_global)} casos` : 'nenhum caso no recorte' }}
      </p>
    </div>

    <!-- Breakdown -->
    <KpiBreakdownBar v-if="kpi.breakdown.length > 0" :items="kpi.breakdown" :max-items="5" :unit="kpi.unidade_tempo" />

    <!-- Sub-métrica aninhada (KPI-07B: alta médica → saída, meta 4h) -->
    <div v-if="submetric" class="border-t border-border dark:border-border-dark pt-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-medium text-text-muted dark:text-text-dark-muted">{{ submetric.descricao }}</span>
        <span class="text-sm font-semibold tabular-nums text-text dark:text-text-dark">
          {{ formatDuration(submetric.media_global, submetric.unidade_tempo) }}
        </span>
      </div>
      <div class="mt-1.5 h-2 rounded-full bg-surface-offset dark:bg-surface-dark-offset overflow-hidden">
        <div class="h-full rounded-full" :class="subBarClass" style="width: 60%" />
      </div>
      <p class="mt-1 text-[11px]" :class="subMeetsTarget ? 'text-success' : 'text-warning'">
        meta: {{ subMeta?.metaHoras }}h · {{ subMeetsTarget ? 'dentro da meta' : 'acima da meta' }}
      </p>
    </div>
  </BaseCard>
</template>
```

- [ ] **Step 3: Reescrever `KpiGrid.vue` (separa KPI-07B como sub-métrica do KPI-07)**

Replace `frontend/src/components/kpis/KpiGrid.vue` com:
```vue
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useKpiStore } from '@/stores/useKpiStore'
import KpiCard from './KpiCard.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const store = useKpiStore()

const submetric = computed(() => store.kpis.find((k) => k.codigo === 'KPI-07B'))
const mainKpis = computed(() => store.kpis.filter((k) => k.codigo !== 'KPI-07B'))

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
    <EmptyState v-else-if="mainKpis.length === 0" title="Sem KPIs no recorte" description="Ajuste os filtros para ver os indicadores." />
    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <KpiCard
        v-for="kpi in mainKpis" :key="kpi.codigo" :kpi="kpi"
        :submetric="kpi.codigo === 'KPI-07' ? submetric : undefined"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 4: Type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: KpiCard/KpiGrid/KpiBreakdownBar verdes. Pode ainda falhar em `DashboardView`/`GargaloList`/`EventosView` — próximas tasks.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/kpis/KpiBreakdownBar.vue frontend/src/components/kpis/KpiCard.vue frontend/src/components/kpis/KpiGrid.vue
git commit -m "feat(front): redesign KPI cards (descriptive title, tooltip notices, nested KPI-07B)"
```

### Task 19: `DashboardView`

**Files:**
- Modify: `frontend/src/views/DashboardView.vue`

- [ ] **Step 1: Reescrever `DashboardView.vue` (remove UnitSelector)**

Replace `frontend/src/views/DashboardView.vue` com:
```vue
<script setup lang="ts">
import FilterBar from '@/components/ui/FilterBar.vue'
import KpiGrid from '@/components/kpis/KpiGrid.vue'
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-text dark:text-text-dark tracking-tight">Dashboard</h1>
      <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">
        Tempos médios da jornada assistencial · HC-UFPE
      </p>
    </div>
    <FilterBar />
    <KpiGrid />
  </div>
</template>
```

- [ ] **Step 2: Type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: Dashboard verde. (Gargalos/Eventos podem ainda falhar.)

- [ ] **Step 3: Verificação visual**

Run: `cd frontend && npm run dev` (com `VITE_USE_MOCK=true` — já é o default em dev se setado; senão criar `.env.local` com `VITE_USE_MOCK=true`). Abrir `http://localhost:5173/dashboard`.
Expected: 6 cards (KPI-01/03/05/06/07 + KPI-07 com sub-bloco KPI-07B), título = descrição, valor em dias, breakdown em barras, tooltip ⓘ no KPI-05 e KPI-07, filtros funcionam, claro/escuro alterna.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/DashboardView.vue
git commit -m "feat(front): redesign Dashboard view"
```

### Task 20: Gargalos — `GargaloItem`, `GargaloList`, `GargalosView`

**Files:**
- Modify: `frontend/src/components/gargalos/GargaloItem.vue`, `GargaloList.vue`, `frontend/src/views/GargalosView.vue`

- [ ] **Step 1: Reescrever `GargaloItem.vue` (usa `RankBar`)**

Replace `frontend/src/components/gargalos/GargaloItem.vue` com:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import RankBar from '@/components/ui/RankBar.vue'
import Badge from '@/components/ui/Badge.vue'
import { formatDuration, formatCount } from '@/lib/format'
import { intensityLevel, intensityBarClass } from '@/lib/intensity'
import { KPI_META } from '@/types/api.types'
import type { GargaloItem as GargaloItemType } from '@/types/api.types'

const props = defineProps<{ item: GargaloItemType; position: number; maxMedia: number }>()

const barClass = computed(() => intensityBarClass(intensityLevel(props.item.media, 0, props.maxMedia)))
const transicaoLabel = computed(() => KPI_META[props.item.transicao]?.label ?? props.item.transicao)
</script>

<template>
  <RankBar
    :position="position"
    :label="item.dimensao"
    :value="formatDuration(item.media, 'dias')"
    :ratio="maxMedia > 0 ? item.media / maxMedia : 0"
    :bar-class="barClass"
    :caption="`${formatCount(item.n)} casos`"
  >
  </RankBar>
  <!-- badge da transição fica acima via slot? RankBar não tem slot; mostramos a transição na caption -->
</template>
```

> Nota: para exibir a transição como badge, ajustar: em vez do componente acima, renderizar o badge no `caption`. Como `caption` é string, incluir o rótulo da transição no caption. Versão final do template:
```vue
<template>
  <RankBar
    :position="position"
    :label="item.dimensao"
    :value="formatDuration(item.media, 'dias')"
    :ratio="maxMedia > 0 ? item.media / maxMedia : 0"
    :bar-class="barClass"
    :caption="`${transicaoLabel} · ${formatCount(item.n)} casos`"
  />
</template>
```
(Manter apenas este `<template>` — remover o anterior. O import de `Badge` pode ser removido se não usado.)

- [ ] **Step 2: Reescrever `GargaloList.vue` (com filtro de métrica)**

Replace `frontend/src/components/gargalos/GargaloList.vue` com:
```vue
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useGargaloStore } from '@/stores/useGargaloStore'
import { KPI_META } from '@/types/api.types'
import type { KpiCode } from '@/types/api.types'
import GargaloItem from './GargaloItem.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Badge from '@/components/ui/Badge.vue'

const store = useGargaloStore()

const METRIC_OPTIONS: KpiCode[] = ['KPI-03', 'KPI-05', 'KPI-06', 'KPI-07']
const maxMedia = computed(() => Math.max(...store.items.map((i) => i.media), 0))

onMounted(() => {
  store.initWatcher()
  void store.fetchGargalos()
})
</script>

<template>
  <div>
    <!-- Filtro de métrica (transições) -->
    <div class="px-5 py-3 border-b border-border dark:border-border-dark flex flex-wrap items-center gap-2">
      <span class="text-xs font-medium text-text-muted dark:text-text-dark-muted mr-1">Métricas:</span>
      <button
        v-for="code in METRIC_OPTIONS" :key="code" type="button"
        @click="store.toggleMetrica(code)"
      >
        <Badge :tone="store.metricas.includes(code) ? 'brand' : 'neutral'">
          {{ KPI_META[code].label }}
        </Badge>
      </button>
    </div>

    <div v-if="store.loading" class="p-5 flex flex-col gap-3">
      <Skeleton v-for="n in 6" :key="n" height="h-10" />
    </div>
    <ErrorState v-else-if="store.error" :message="store.error" @retry="store.fetchGargalos()" />
    <EmptyState v-else-if="store.items.length === 0" title="Sem gargalos no recorte" description="Ajuste filtros ou métricas selecionadas." icon="gargalos" />
    <div v-else>
      <GargaloItem
        v-for="(item, idx) in store.items" :key="`${item.dimensao}-${item.transicao}`"
        :item="item" :position="idx + 1" :max-media="maxMedia"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 3: Reescrever `GargalosView.vue`**

Replace `frontend/src/views/GargalosView.vue` com:
```vue
<script setup lang="ts">
import FilterBar from '@/components/ui/FilterBar.vue'
import GargaloList from '@/components/gargalos/GargaloList.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-text dark:text-text-dark tracking-tight">Gargalos</h1>
      <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">
        Ranking dos piores tempos médios · pior para o melhor
      </p>
    </div>
    <FilterBar />
    <BaseCard :padding="false" class="overflow-hidden">
      <GargaloList />
    </BaseCard>
  </div>
</template>
```

- [ ] **Step 4: Type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: Gargalos verde. (Eventos ainda falha — removido na Task 22.)

- [ ] **Step 5: Verificação visual**

Run: `npm run dev`, abrir `/gargalos`.
Expected: chips de métricas alternam e re-buscam; ranking colorido por intensidade (verde→vermelho); rótulo da transição legível (não "KPI-05").

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/gargalos/GargaloItem.vue frontend/src/components/gargalos/GargaloList.vue frontend/src/views/GargalosView.vue
git commit -m "feat(front): redesign Gargalos view with metric filter + intensity ranking"
```

### Task 21: Jornada — `JornadaView` + rotas

**Files:**
- Create: `frontend/src/views/JornadaView.vue`
- Modify: `frontend/src/router/index.ts`

- [ ] **Step 1: Criar `JornadaView.vue`**

Create `frontend/src/views/JornadaView.vue`:
```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useJornadaStore } from '@/stores/useJornadaStore'
import { elapsedLabel } from '@/lib/timeline'
import type { TipoEntidade } from '@/types/api.types'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import TimelineItem from '@/components/ui/TimelineItem.vue'
import TimelineConnector from '@/components/ui/TimelineConnector.vue'

const store = useJornadaStore()
const input = ref('')

const TIPOS: TipoEntidade[] = ['CONSULTA', 'EXAME', 'INTERNACAO', 'CIRURGIA', 'PROCEDIMENTO', 'ALTA', 'PRONTUARIO']

const visiveis = computed(() =>
  store.tipoFiltro ? store.eventos.filter((e) => e.tipo_entidade === store.tipoFiltro) : store.eventos,
)

function submit(): void {
  void store.buscar(input.value)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-text dark:text-text-dark tracking-tight">Jornada do paciente</h1>
      <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">
        Busque um prontuário para ver a linha do tempo dos eventos assistenciais
      </p>
    </div>

    <!-- Busca por prontuário -->
    <form class="flex gap-2 max-w-md" @submit.prevent="submit">
      <div class="relative flex-1">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"><Icon name="search" :size="18" /></span>
        <input
          v-model="input" inputmode="numeric"
          placeholder="Número do prontuário"
          class="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm bg-surface dark:bg-surface-dark border border-border dark:border-border-dark text-text dark:text-text-dark"
        />
      </div>
      <BaseButton type="submit" variant="primary">Buscar</BaseButton>
    </form>

    <!-- Estados -->
    <EmptyState
      v-if="!store.searched"
      title="Digite um número de prontuário"
      description="A jornada mostra os eventos do paciente em ordem cronológica, com o intervalo entre cada etapa."
    />
    <BaseCard v-else-if="store.loading" class="flex flex-col gap-4">
      <Skeleton v-for="n in 5" :key="n" height="h-10" />
    </BaseCard>
    <ErrorState v-else-if="store.error" :message="store.error" @retry="store.buscar(store.pacienteId ?? '')" />
    <EmptyState v-else-if="store.eventos.length === 0" title="Nenhum evento encontrado" :description="`Prontuário ${store.pacienteId} sem eventos.`" />

    <template v-else>
      <!-- Filtro por tipo (chips) -->
      <div class="flex flex-wrap gap-2">
        <button v-for="t in TIPOS" :key="t" type="button" @click="store.setTipoFiltro(t)">
          <Badge :tone="store.tipoFiltro === t ? 'brand' : 'neutral'">{{ t }}</Badge>
        </button>
      </div>

      <!-- Timeline -->
      <BaseCard>
        <p class="text-xs text-text-muted dark:text-text-dark-muted mb-4">
          Prontuário <span class="font-semibold text-text dark:text-text-dark">{{ store.pacienteId }}</span> ·
          {{ visiveis.length }} evento(s)
        </p>
        <div class="flex flex-col">
          <template v-for="(ev, idx) in visiveis" :key="ev.evento_id">
            <TimelineItem :evento="ev" />
            <TimelineConnector
              v-if="idx < visiveis.length - 1"
              :label="elapsedLabel(ev.timestamp_principal, visiveis[idx + 1].timestamp_principal)"
            />
          </template>
        </div>
      </BaseCard>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Atualizar o router (`/jornada`, redirect `/eventos`)**

Replace `frontend/src/router/index.ts` com:
```ts
import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import GargalosView from '@/views/GargalosView.vue'
import JornadaView from '@/views/JornadaView.vue'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { title: 'Dashboard — PIJA' } },
  { path: '/gargalos', name: 'gargalos', component: GargalosView, meta: { title: 'Gargalos — PIJA' } },
  { path: '/jornada', name: 'jornada', component: JornadaView, meta: { title: 'Jornada — PIJA' } },
  { path: '/eventos', redirect: '/jornada' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  document.title = (to.meta.title as string | undefined) ?? 'PIJA — Jornada Assistencial'
})

export default router
```

- [ ] **Step 3: Type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: pode falhar só por `EventosView.vue` órfão (ainda existe mas não é mais importado pelo router → não quebra o build; se o vue-tsc reclamar de algo dentro dele, remover na Task 22). Anotar.

- [ ] **Step 4: Verificação visual**

Run: `npm run dev`, abrir `/jornada`. Digitar um número (ex.: `123456`) e buscar.
Expected: timeline cronológica com ícones por tipo, intervalos ("12 dias depois"), chips de filtro por tipo; estado vazio antes da busca.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/JornadaView.vue frontend/src/router/index.ts
git commit -m "feat(front): add Jornada timeline view (replaces Eventos) + route redirect"
```

### Task 22: Limpeza de componentes mortos

**Files:**
- Delete: `frontend/src/views/EventosView.vue`, `frontend/src/components/eventos/` (3 arquivos), `frontend/src/components/ui/SkeletonCard.vue`

- [ ] **Step 1: Remover arquivos órfãos**

```bash
git rm frontend/src/views/EventosView.vue \
  frontend/src/components/eventos/EventosBadge.vue \
  frontend/src/components/eventos/EventosFilter.vue \
  frontend/src/components/eventos/EventosTable.vue \
  frontend/src/components/ui/SkeletonCard.vue
```

- [ ] **Step 2: Confirmar que nada mais os importa**

Run (no repo root): `grep -rn "EventosView\|components/eventos\|SkeletonCard\|UnitSelector" frontend/src || echo "sem referências"`
Expected: `sem referências` (ou nenhuma linha). Se aparecer alguma, corrigir o import.

- [ ] **Step 3: Type-check + build limpos**

Run: `cd frontend && npm run type-check && npm run build`
Expected: PASS, sem erros.

- [ ] **Step 4: Rodar os testes de helpers**

Run: `cd frontend && npm run test`
Expected: PASS (format, intensity, timeline).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(front): remove dead Eventos components after Jornada redesign"
```

---

## Phase 7 — Docs & fechamento

### Task 23: Documentar dependência de backend + atualizar HANDOFF

**Files:**
- Modify: `docs/GUIA-FRONTEND.md`
- Modify: `docs/HANDOFF.md`

- [ ] **Step 1: Anotar a dependência `paciente_id` no `GUIA-FRONTEND.md`**

Em `docs/GUIA-FRONTEND.md`, na seção 3.1 (`/eventos`), adicionar após a tabela de filtros:
```markdown
> **Pendência (Fase 7 → Fase 4/6):** a tela **Jornada** precisa buscar os eventos de **um** paciente. O contrato atual não tem filtro `paciente_id`. Para conectar a Jornada ao backend real, adicionar o filtro `paciente_id` ao `GET /eventos` (ou um endpoint `/jornada/{paciente_id}`). Hoje a Jornada roda sobre mock.
```

- [ ] **Step 2: Atualizar pendências no `HANDOFF.md`**

Em `docs/HANDOFF.md`, na seção "Pendências → Técnicas", adicionar o item:
```markdown
- **Backend `paciente_id` para a Jornada (Fase 7):** a tela Jornada (timeline por prontuário) está pronta no front sobre mock; conectar ao real exige filtro `paciente_id` no `/eventos` (ou `/jornada/{paciente_id}`). Ver `docs/superpowers/specs/2026-06-26-fase-7-frontend-redesign-design.md` §11.
```

E atualizar o TL;DR/estado do frontend para refletir que a Fase 7 (repaginação) foi entregue (Dashboard, Gargalos, Jornada; design system; claro+escuro).

- [ ] **Step 3: Commit**

```bash
git add docs/GUIA-FRONTEND.md docs/HANDOFF.md
git commit -m "docs: note paciente_id backend dependency for Jornada; update HANDOFF for Fase 7"
```

### Task 24: Verificação final + deploy

**Files:** nenhum (verificação).

- [ ] **Step 1: Suite completa**

Run: `cd frontend && npm run test && npm run type-check && npm run build`
Expected: tests PASS, type-check sem erros, build sem erros.

- [ ] **Step 2: Verificação visual final das 3 telas (claro e escuro)**

Run: `npm run dev`. Conferir `/dashboard`, `/gargalos`, `/jornada` em tema claro e escuro, e responsivo (largura mobile → bottom-nav aparece, sidebar some).
Expected: identidade consistente; KPI por descrição; KPI-07B aninhado; gargalos com filtro de métrica e cores de intensidade; jornada com busca + timeline + intervalos; avisos só em tooltip.

- [ ] **Step 3: Deploy automático (Vercel)**

Confirmar que a `main` está atualizada; o push dispara o auto-deploy do projeto `pija` (Root Directory `frontend`, `VITE_USE_MOCK=true`).
```bash
git push origin main
```
Expected: deploy verde na Vercel; `https://pija-alpha.vercel.app/` mostra o novo design em modo mock.

> Observação: o roadmap usa branch-por-feature → merge `--no-ff`. Se preferir esse fluxo, executar este plano numa branch `feat/fase-7-frontend-redesign` e abrir PR ao final em vez de commitar direto na `main`. Decisão do executor/usuário no início da execução.

---

## Self-Review

**Spec coverage** (spec §→task):
- §3 identidade híbrida → Task 2 (tokens) + primitivos (Tasks 10–15).
- §3 KPI por descrição (não código) → Task 18 (KpiCard usa `kpi.descricao`).
- §3 gráficos CSS/SVG puro → todos os primitivos de viz (BarRow/RankBar/timeline), zero dep de runtime.
- §3 claro+escuro desktop-first → Task 14 (ThemeStore/Toggle) + Task 16 (shell) + classes `dark:` em todos.
- §3 avisos discretos → Task 11 (Tooltip) + Task 18 (só ⓘ no card).
- §4 tokens → Task 2.
- §5 primitivos → Tasks 10–15 (cobre Card, Stat, Badge, Button, Select, SegmentedControl, BarRow, RankBar, TimelineItem, Skeleton, Empty/Error, Tooltip, ThemeToggle).
- §6 shell + filtros grupo/unidade executora → Tasks 16–17 (FilterBar com Grupo+Unidade) + Task 6 (`grupo` no store).
- §7 Dashboard + KPI-07B aninhado → Tasks 18–19 + Task 7 (mock KPI-07B horas).
- §8 Gargalos + filtro de métrica → Task 9 (store) + Task 20 (UI).
- §9 Jornada timeline + intervalos → Tasks 8, 15, 21 + Task 5 (helpers).
- §10 estados → Task 14 + uso em todas as views.
- §11 dependência `paciente_id` → Task 8 (anotada no serviço) + Task 23 (docs).
- §12 critérios → Task 24 (verificação final).

**Placeholder scan:** sem TBD/TODO de implementação; o único "TODO" remanescente em `services/api.ts` (token Fase 3) é pré-existente e fora do escopo.

**Type consistency:** `formatDuration(value, unit)`, `intensityLevel/intensityBarClass`, `elapsedLabel/sortByTimestampAsc`, `KpiCode` (com `KPI-07B`), `unidade_tempo: 'dias'|'horas'`, props `submetric`, `metricas/toggleMetrica`, `setGrupo`, store da jornada `buscar/setTipoFiltro` — usados de forma idêntica entre as tasks que os definem e as que os consomem.

**Ordem de commits verdes:** Tasks 6–7 são commitadas juntas (Task 7 Step 4) porque a Task 6 sozinha deixa o type-check vermelho até os mocks. As demais tasks deixam type-check/build verdes ao final (exceto onde explicitamente anotado que um arquivo órfão será removido na Task 22).
