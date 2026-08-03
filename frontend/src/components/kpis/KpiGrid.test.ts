import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia, type Pinia } from 'pinia'
import { nextTick } from 'vue'
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
import { useKpiStore } from '@/stores/useKpiStore'

let pinia: Pinia

async function montar() {
  const w = mount(KpiGrid, {
    global: {
      plugins: [pinia],
      // Cross-links usam RouterLink; stub captura a prop `to` (serializada em data-to)
      // para permitir asserir o destino do link, não só a sua presença.
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a data-gargalos-link :data-to="JSON.stringify(to)"><slot /></a>',
        },
      },
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

  it('hierarquia de cabeçalhos: seção h2 envolve o título do card em h3', async () => {
    // A página tem h1 (DashboardView). Se o card voltar pra h2, um leitor de tela
    // não distingue onde a área termina — foi regressão real quando as seções entraram.
    const w = await montar()
    const secao = w.findAll('[data-area]')[0]!
    expect(secao.find('h2').exists()).toBe(true)
    expect(secao.findAllComponents(KpiCard)[0]!.find('h3').exists()).toBe(true)
    expect(secao.findAllComponents(KpiCard)[0]!.find('h2').exists()).toBe(false)
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

  // Task 3 já testa o lado leitor (GargaloList lendo ?kpi=). Este teste cobre o
  // lado escritor: o `to` que o KpiGrid efetivamente monta para o RouterLink.
  it('link de gargalos de Exames aponta para /gargalos?kpi=KPI-05', async () => {
    const w = await montar()
    const exames = w.findAll('[data-area]').find((s) => s.attributes('data-area') === 'exames')!
    const link = exames.find('[data-gargalos-link]')
    const to = JSON.parse(link.attributes('data-to')!) as unknown
    expect(to).toEqual({ path: '/gargalos', query: { kpi: 'KPI-05' } })
  })

  it('nenhum KPI mapeado mostra o vazio global, sem seções soltas', async () => {
    vi.mocked(getKpis).mockResolvedValueOnce({ kpis: [] })
    const w = await montar()
    expect(w.text()).toContain('Sem KPIs no recorte')
    expect(w.findAll('[data-area]')).toHaveLength(0)
  })

  it('loading mostra o skeleton, sem seções', async () => {
    const w = await montar()
    useKpiStore().loading = true
    await nextTick()
    expect(w.find('[data-area]').exists()).toBe(false)
    expect(w.find('.animate-pulse-soft').exists()).toBe(true)
  })

  it('erro mostra ErrorState, sem seções', async () => {
    const w = await montar()
    const store = useKpiStore()
    store.loading = false
    store.error = 'boom'
    await nextTick()
    expect(w.find('[data-area]').exists()).toBe(false)
    expect(w.text()).toContain('boom')
  })
})
