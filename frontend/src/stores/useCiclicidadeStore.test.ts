import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({
  getCiclicidade: vi.fn(async () => ({
    nos: [{ tipo: 'CONSULTA', total_entradas: 5, total_saidas: 3 }],
    transicoes: [{ origem: 'PRONTUARIO', destino: 'CONSULTA', volume: 5, tempo_medio_s: 100, n: 5 }],
  })),
}))

import { useCiclicidadeStore } from './useCiclicidadeStore'

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
})
