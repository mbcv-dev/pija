import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { DistribuicoesResponse, KpiCode, KpiDistribuicao } from '@/types/api.types'

const dist = (codigo: KpiCode): KpiDistribuicao => ({
  codigo,
  unidade_tempo: 'dias',
  p50: 1,
  p95: 10,
  teto: 10,
  n_total: 100,
  buckets: [{ de: 0, ate: 10, n: 90 }, { de: 10, ate: null, n: 10 }],
})

// O store só consome getKpis/getDistribuicoes — o módulo inteiro é substituído
// para nenhum teste tocar axios.
vi.mock('@/services/api', () => ({
  getKpis: vi.fn(async () => ({ kpis: [] })),
  getDistribuicoes: vi.fn(async () => ({ distribuicoes: [dist('KPI-01')] })),
}))

import { getDistribuicoes, getKpis } from '@/services/api'
import { useFilterStore } from './useFilterStore'
import { useKpiStore } from './useKpiStore'

/** Deixa a fila de microtasks (e o watcher do Vue) drenar. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('useKpiStore — distribuições', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchKpis dispara também a busca das distribuições', async () => {
    const store = useKpiStore()
    await store.fetchKpis()
    await vi.waitFor(() => expect(store.distribuicoes.get('KPI-01')).toBeDefined())
    expect(getDistribuicoes).toHaveBeenCalledTimes(1)
  })

  it('as duas buscas correm em paralelo (a distribuição não espera os KPIs)', async () => {
    // getKpis pendurado: se a distribuição fosse buscada DEPOIS dos cards,
    // getDistribuicoes nunca seria chamada.
    vi.mocked(getKpis).mockImplementationOnce(() => new Promise(() => {}))
    const store = useKpiStore()
    void store.fetchKpis()
    await flush()
    expect(getDistribuicoes).toHaveBeenCalledTimes(1)
  })

  it('falha da distribuição NÃO seta o error global nem mexe no loading dos cards', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const erro = new Error('boom')
    vi.mocked(getDistribuicoes).mockRejectedValueOnce(erro)
    const store = useKpiStore()
    await store.fetchKpis()
    await vi.waitFor(() => expect(getDistribuicoes).toHaveBeenCalled())
    await flush()
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.loadingDist).toBe(false)
    expect(store.distribuicoes.size).toBe(0)
    // Silencioso para o usuário, mas rastreável para o dev.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('distribuicoes'), erro)
    warn.mockRestore()
  })

  it('o loading dos cards não espera a distribuição (desacoplado)', async () => {
    // getDistribuicoes pendurado para sempre; fetchKpis tem que resolver mesmo assim.
    vi.mocked(getDistribuicoes).mockImplementationOnce(() => new Promise(() => {}))
    const store = useKpiStore()
    await store.fetchKpis()
    expect(store.loading).toBe(false)
    expect(store.loadingDist).toBe(true)
  })

  it('manda os mesmos filtros dos KPIs, sem group_by', async () => {
    const filterStore = useFilterStore()
    filterStore.setUnidades(['UTI ADULTO'])
    filterStore.setDataInicio('2026-01-01')

    const store = useKpiStore()
    await store.fetchDistribuicoes()

    const params = vi.mocked(getDistribuicoes).mock.calls[0][0]
    expect(params).toMatchObject({ unidade: ['UTI ADULTO'], data_inicio: '2026-01-01' })
    expect('group_by' in params).toBe(false)
  })

  it('uma única busca de distribuição por mudança de filtro (sem watcher extra)', async () => {
    const store = useKpiStore()
    store.initWatcher()
    useFilterStore().setDataInicio('2026-02-01')

    await vi.waitFor(() => expect(getKpis).toHaveBeenCalledTimes(1))
    await flush()
    expect(getDistribuicoes).toHaveBeenCalledTimes(1)
  })

  it('resposta atrasada de um filtro antigo não sobrescreve a mais recente', async () => {
    let resolveLenta!: (r: DistribuicoesResponse) => void
    vi.mocked(getDistribuicoes)
      .mockImplementationOnce(() => new Promise<DistribuicoesResponse>((r) => { resolveLenta = r }))
      .mockResolvedValueOnce({ distribuicoes: [dist('KPI-05')] })

    const store = useKpiStore()
    void store.fetchDistribuicoes()   // req 1 — lenta
    await store.fetchDistribuicoes()  // req 2 — chega primeiro
    resolveLenta({ distribuicoes: [dist('KPI-01')] })
    await flush()

    expect(store.distribuicoes.has('KPI-05')).toBe(true)
    expect(store.distribuicoes.has('KPI-01')).toBe(false)
  })
})
