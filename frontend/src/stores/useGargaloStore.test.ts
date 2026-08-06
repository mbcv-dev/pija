import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({
  // Assinatura com o 2º argumento: é por ele que o store passa o AbortSignal.
  getGargalos: vi.fn(async (_params: GargaloParams, _opts?: { signal?: AbortSignal }) => ({ items: [] })),
}))

import { useGargaloStore } from './useGargaloStore'
import { getGargalos } from '@/services/api'
import type { GargaloParams, GargalosResponse, KpiCode } from '@/types/api.types'

/** Deixa a fila de microtasks drenar. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

/** Imita o axios: a promise só rejeita quando o signal é abortado. */
const pendenteAteAbortar = (_p: GargaloParams, opts?: { signal?: AbortSignal }) =>
  new Promise<GargalosResponse>((_resolve, reject) => {
    opts?.signal?.addEventListener('abort', () => {
      reject(Object.assign(new Error('canceled'), { name: 'CanceledError' }))
    })
  })

describe('useGargaloStore.setMetricas', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

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

  it('não dispara fetchGargalos (fetch é responsabilidade do chamador)', () => {
    const store = useGargaloStore()
    store.setMetricas(['KPI-05'])
    expect(vi.mocked(getGargalos)).not.toHaveBeenCalled()
  })

  it('faz cópia defensiva (não referencia o array do chamador)', () => {
    const store = useGargaloStore()
    const arr: KpiCode[] = ['KPI-05']
    store.setMetricas(arr)
    arr.push('KPI-01')
    expect(store.metricas).toEqual(['KPI-05'])
  })
})

describe('useGargaloStore — cancelamento', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('mudança de filtro aborta a busca anterior', async () => {
    const sinais: AbortSignal[] = []
    // `...Once` duas vezes (uma por requisição): mockImplementation persistente
    // vazaria para os testes seguintes — este mock nunca resolve.
    const capturar = (p: GargaloParams, opts?: { signal?: AbortSignal }) => {
      if (opts?.signal) sinais.push(opts.signal)
      return pendenteAteAbortar(p, opts)
    }
    vi.mocked(getGargalos).mockImplementationOnce(capturar).mockImplementationOnce(capturar)

    const store = useGargaloStore()
    void store.fetchGargalos()
    void store.fetchGargalos()

    await vi.waitFor(() => expect(sinais.length).toBe(2))
    expect(sinais[0].aborted).toBe(true)
    expect(sinais[1].aborted).toBe(false)
  })

  it('cancelamento NÃO vira ErrorState nem derruba o skeleton', async () => {
    // Este store SETA `error` no catch — se o guarda de abort ficar no lugar
    // errado, toda mudança rápida de filtro pinta um ErrorState na tela.
    vi.mocked(getGargalos)
      .mockImplementationOnce(pendenteAteAbortar)
      .mockImplementationOnce(pendenteAteAbortar)

    const store = useGargaloStore()
    void store.fetchGargalos()  // req 1 — será cancelada
    void store.fetchGargalos()  // req 2 — cancela a anterior e segue no ar
    await flush()

    expect(store.error).toBeNull()
    // A req 2 ainda está no ar: o skeleton tem que continuar, não pode piscar
    // para "vazio" só porque a requisição cancelada passou pelo `finally`.
    expect(store.loading).toBe(true)
  })

  it('falha real continua setando error', async () => {
    // Contraprova: o guarda de abort não pode engolir erro de verdade.
    vi.mocked(getGargalos).mockRejectedValueOnce(new Error('backend caiu'))

    const store = useGargaloStore()
    await store.fetchGargalos()

    expect(store.error).toBe('backend caiu')
    expect(store.loading).toBe(false)
  })
})
