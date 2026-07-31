import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia, type Pinia } from 'pinia'

vi.mock('@/services/api', () => ({
  getGargalos: vi.fn(async () => ({ items: [] })),
}))

// useRoute é mockado por teste para simular a query string.
// vue-router permite ?kpi=A&kpi=B, que surge aqui como string[] — daí o tipo mais largo.
const rota = { query: {} as Record<string, string | string[]> }
vi.mock('vue-router', () => ({
  useRoute: () => rota,
}))

import GargaloList from './GargaloList.vue'
import { useGargaloStore } from '@/stores/useGargaloStore'
import { METRIC_OPTIONS } from '@/lib/gargalos'
import { AREAS_JORNADA } from '@/lib/areas'

let pinia: Pinia

async function montar(query: Record<string, string | string[]>) {
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

  it('?kpi= repetido (vira array) mantém o default', async () => {
    await montar({ kpi: ['KPI-05', 'KPI-03'] })
    expect(useGargaloStore().metricas).toEqual(['KPI-03', 'KPI-05', 'KPI-06', 'KPI-07'])
  })

  it('todo gargalosKpi de AREAS_JORNADA é uma métrica válida do GargaloList (fonte única, sem cópia)', () => {
    for (const area of AREAS_JORNADA) {
      if (area.gargalosKpi) expect(METRIC_OPTIONS).toContain(area.gargalosKpi)
    }
  })
})
