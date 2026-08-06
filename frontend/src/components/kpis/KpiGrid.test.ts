import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia, type Pinia } from 'pinia'
import { nextTick } from 'vue'
import type { KpiCode, KpiDistribuicao, KpiItem } from '@/types/api.types'

const K = (codigo: KpiItem['codigo'], over: Partial<KpiItem> = {}): KpiItem => ({
  codigo, descricao: '', unidade_tempo: 'dias', media_global: 1.5, n_global: 10, breakdown: [],
  ...over,
})

const D = (codigo: KpiCode, over: Partial<KpiDistribuicao> = {}): KpiDistribuicao => ({
  codigo, unidade_tempo: 'dias', p50: 2, p95: 8, teto: 8, n_total: 100,
  buckets: [{ de: 0, ate: 4, n: 60 }, { de: 4, ate: 8, n: 30 }, { de: 8, ate: null, n: 10 }],
  ...over,
})

// O store agora consome getKpis E getDistribuicoes; o mock precisa cobrir as duas,
// senão a segunda estoura um TypeError que o catch do store engole em silêncio e
// os cards nunca veem distribuição nenhuma.
// Recorte proposital: KPI-05, KPI-07B e KPI-10B com dados, KPI-03 com n_total = 0
// (guarda), KPI-01/06/07/10 sem distribuição (garantia de enhancement).
vi.mock('@/services/api', () => ({
  getKpis: vi.fn(async () => ({
    kpis: [
      K('KPI-01'), K('KPI-03'), K('KPI-05'), K('KPI-06'), K('KPI-07'),
      // Descrições reais nas submétricas: é por elas que os testes distinguem
      // qual bloco `[data-submetrica]` caiu em qual card.
      K('KPI-07B', { unidade_tempo: 'horas', descricao: 'Alta médica → saída do leito' }),
      K('KPI-10', { unidade_tempo: 'horas', descricao: 'Duração da cirurgia' }),
      K('KPI-10B', { unidade_tempo: 'horas', descricao: 'Entrada na sala → início da cirurgia' }),
    ],
  })),
  getDistribuicoes: vi.fn(async () => ({
    distribuicoes: [
      D('KPI-05'),
      D('KPI-07B', { unidade_tempo: 'horas' }),
      D('KPI-10B', { unidade_tempo: 'horas' }),
      D('KPI-03', { p50: null, p95: null, teto: null, n_total: 0, buckets: [] }),
    ],
  })),
}))

import KpiGrid from './KpiGrid.vue'
import KpiCard from './KpiCard.vue'
import HistogramaTempos from './HistogramaTempos.vue'
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

  it('cada seção mostra os cards da sua área (07B e 10B não são card próprio)', async () => {
    const w = await montar()
    const codigosPorSecao = w.findAll('[data-area]').map((s) =>
      s.findAllComponents(KpiCard).map((c: VueWrapper<InstanceType<typeof KpiCard>>) => (c.props('kpi') as KpiItem).codigo),
    )
    expect(codigosPorSecao).toEqual([
      ['KPI-01'], ['KPI-03'], ['KPI-05'], ['KPI-06', 'KPI-07'], ['KPI-10'],
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

  it('Cirurgias deixou de prometer indicadores futuros — o card do KPI-10 está lá', async () => {
    const w = await montar()
    const cirurgias = w.findAll('[data-area]').find((s) => s.attributes('data-area') === 'cirurgias')!
    expect(cirurgias.findAllComponents(KpiCard)).toHaveLength(1)
    expect(cirurgias.text()).not.toContain('Sem indicadores nesta área')
  })

  it('a submétrica do KPI-10 renderiza no card do KPI-10, não em outro', async () => {
    const w = await montar()
    const cirurgias = w.findAll('[data-area]').find((s) => s.attributes('data-area') === 'cirurgias')!
    const bloco = cirurgias.find('[data-submetrica]')
    expect(bloco.exists()).toBe(true)
    expect(bloco.text()).toContain('sala')
    // O par 07/07B não pode ter migrado para cá junto com a extração do mapa.
    expect(bloco.text()).not.toContain('leito')
  })

  // A `<section>` sem cards não some do DOM: `cards` vem da RESPOSTA, então uma
  // área com KPI mapeado ainda cai no vazio quando o recorte não devolve aquele
  // código. Este teste mantém esse ramo vivo agora que nenhuma área nasce vazia.
  it('área cujo KPI não veio na resposta cai no estado vazio', async () => {
    vi.mocked(getKpis).mockResolvedValueOnce({ kpis: [K('KPI-01')] })
    const w = await montar()
    const cirurgias = w.findAll('[data-area]').find((s) => s.attributes('data-area') === 'cirurgias')!
    expect(cirurgias.findAllComponents(KpiCard)).toHaveLength(0)
    expect(cirurgias.text()).toContain('Sem indicadores nesta área')
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

  // ── Histograma de tempos (enhancement) ────────────────────────────────
  // O gráfico chega por uma busca própria, desacoplada dos cards: os asserts
  // esperam por ele em vez de assumir que já veio junto com o mount.

  it('card com distribuição renderiza o histograma', async () => {
    const w = await montar()
    const exames = w.findAll('[data-area]').find((s) => s.attributes('data-area') === 'exames')!
    await vi.waitFor(() => expect(exames.find('[data-balde]').exists()).toBe(true))
    const hist = exames.findComponent(HistogramaTempos)
    expect((hist.props('dist') as KpiDistribuicao).codigo).toBe('KPI-05')
  })

  it('card sem distribuição continua íntegro (enhancement)', async () => {
    const w = await montar()
    // Espera o histograma de Exames chegar: garante que a busca já resolveu e que
    // a ausência em Entrada é o recorte do mock, não uma corrida de timing.
    await vi.waitFor(() => expect(w.find('[data-balde]').exists()).toBe(true))
    const entrada = w.findAll('[data-area]').find((s) => s.attributes('data-area') === 'entrada')!
    expect(entrada.findComponent(KpiCard).exists()).toBe(true)
    expect(entrada.findComponent(HistogramaTempos).exists()).toBe(false)
    expect(entrada.find('[data-balde]').exists()).toBe(false)
  })

  it('distribuição sem casos no recorte não vira gráfico vazio', async () => {
    const w = await montar()
    await vi.waitFor(() => expect(w.find('[data-balde]').exists()).toBe(true))
    const consultas = w.findAll('[data-area]').find((s) => s.attributes('data-area') === 'consultas')!
    expect(consultas.findComponent(HistogramaTempos).exists()).toBe(false)
  })

  it('a submétrica KPI-07B ganha histograma próprio, dentro do seu bloco', async () => {
    const w = await montar()
    const card07 = w.findAllComponents(KpiCard).find((c) => (c.props('kpi') as KpiItem).codigo === 'KPI-07')!
    await vi.waitFor(() => expect(card07.find('[data-balde]').exists()).toBe(true))

    // KPI-07 (o valor principal do card) não tem distribuição no mock — o único
    // histograma do card tem que ser o da submétrica, e dentro do bloco dela.
    const hists = card07.findAllComponents(HistogramaTempos)
    expect(hists).toHaveLength(1)
    expect((hists[0]!.props('dist') as KpiDistribuicao).codigo).toBe('KPI-07B')
    expect(card07.find('[data-submetrica]').findComponent(HistogramaTempos).exists()).toBe(true)
  })

  it('o bloco da submetrica nao fala mais em meta', async () => {
    const w = await montar()
    const bloco = w.find('[data-submetrica]')
    expect(bloco.exists()).toBe(true)
    expect(bloco.text()).not.toMatch(/meta/i)
  })

  it('mas o resto do bloco da submetrica continua inteiro', async () => {
    // A remoção não pode levar junto o valor nem o histograma do KPI-07B —
    // o caso-âncora da feature de gráficos mora exatamente ali.
    const w = await montar()
    const bloco = w.find('[data-submetrica]')
    await vi.waitFor(() => expect(bloco.find('[data-balde]').exists()).toBe(true))
    expect(bloco.text()).toMatch(/\d/) // o valor da submétrica segue renderizado
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
