import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({
  // Assinatura com o 2º argumento: é por ele que o store passa o AbortSignal.
  getCiclicidade: vi.fn(async (_params?: CiclicidadeParams, _opts?: { signal?: AbortSignal }) => ({
    nos: [{ tipo: 'CONSULTA', total_entradas: 5, total_saidas: 3 }],
    transicoes: [{ origem: 'PRONTUARIO', destino: 'CONSULTA', volume: 5, tempo_medio_s: 100, n: 5 }],
  })),
}))

import { useCiclicidadeStore } from './useCiclicidadeStore'
import { getCiclicidade } from '@/services/api'
import type { CiclicidadeParams, CiclicidadeResponse } from '@/types/api.types'

/** Deixa a fila de microtasks drenar. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

/** Imita o axios: a promise só rejeita quando o signal é abortado. */
const pendenteAteAbortar = (_p?: CiclicidadeParams, opts?: { signal?: AbortSignal }) =>
  new Promise<CiclicidadeResponse>((_resolve, reject) => {
    opts?.signal?.addEventListener('abort', () => {
      reject(Object.assign(new Error('canceled'), { name: 'CanceledError' }))
    })
  })

describe('useCiclicidadeStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('começa vazio', () => {
    const s = useCiclicidadeStore()
    expect(s.transicoes).toEqual([])
    expect(s.loading).toBe(false)
  })

  it('fetch popula nós e transições', async () => {
    const s = useCiclicidadeStore()
    await s.fetch()
    expect(s.transicoes).toHaveLength(1)
    expect(s.nos[0].tipo).toBe('CONSULTA')
    expect(s.loading).toBe(false)
  })

  it('mudança de filtro aborta a busca anterior', async () => {
    const sinais: AbortSignal[] = []
    // `...Once` duas vezes (uma por requisição): mockImplementation persistente
    // vazaria para os testes seguintes — este mock nunca resolve.
    const capturar = (p?: CiclicidadeParams, opts?: { signal?: AbortSignal }) => {
      if (opts?.signal) sinais.push(opts.signal)
      return pendenteAteAbortar(p, opts)
    }
    vi.mocked(getCiclicidade).mockImplementationOnce(capturar).mockImplementationOnce(capturar)

    const s = useCiclicidadeStore()
    void s.fetch()
    void s.fetch()

    await vi.waitFor(() => expect(sinais.length).toBe(2))
    expect(sinais[0].aborted).toBe(true)
    expect(sinais[1].aborted).toBe(false)
  })

  it('cancelamento NÃO vira ErrorState nem derruba o skeleton', async () => {
    // Este store SETA `error` no catch — se o guarda de abort ficar no lugar
    // errado, toda mudança rápida de filtro pinta um ErrorState na tela.
    vi.mocked(getCiclicidade)
      .mockImplementationOnce(pendenteAteAbortar)
      .mockImplementationOnce(pendenteAteAbortar)

    const s = useCiclicidadeStore()
    void s.fetch()  // req 1 — será cancelada
    void s.fetch()  // req 2 — cancela a anterior e segue no ar
    await flush()

    expect(s.error).toBeNull()
    // A req 2 ainda está no ar: o skeleton tem que continuar.
    expect(s.loading).toBe(true)
  })

  it('falha real continua setando error', async () => {
    // Contraprova: o guarda de abort não pode engolir erro de verdade.
    vi.mocked(getCiclicidade).mockRejectedValueOnce(new Error('backend caiu'))

    const s = useCiclicidadeStore()
    await s.fetch()

    expect(s.error).toBe('backend caiu')
    expect(s.loading).toBe(false)
  })
})
