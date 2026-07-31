import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
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
import { getKpis } from '@/services/api'

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
      s.findAllComponents(KpiCard).map((c: VueWrapper<InstanceType<typeof KpiCard>>) => (c.props('kpi') as KpiItem).codigo),
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

  it('nenhum KPI mapeado mostra o vazio global, sem seções soltas', async () => {
    vi.mocked(getKpis).mockResolvedValueOnce({ kpis: [] })
    const w = await montar()
    expect(w.text()).toContain('Sem KPIs no recorte')
    expect(w.findAll('[data-area]')).toHaveLength(0)
  })
})
