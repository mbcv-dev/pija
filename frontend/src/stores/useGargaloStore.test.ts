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
