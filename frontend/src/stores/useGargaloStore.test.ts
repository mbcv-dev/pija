import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({
  getGargalos: vi.fn(async () => ({ items: [] })),
}))

import { useGargaloStore } from './useGargaloStore'
import { getGargalos } from '@/services/api'
import type { KpiCode } from '@/types/api.types'

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
