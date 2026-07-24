import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFilterStore } from './useFilterStore'

describe('useFilterStore (multiseleção)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('começa com listas vazias', () => {
    const s = useFilterStore()
    expect(s.grupo).toEqual([])
    expect(s.unidade).toEqual([])
    expect(s.especialidade).toEqual([])
  })

  it('toggle adiciona e remove', () => {
    const s = useFilterStore()
    s.toggleUnidade('A')
    s.toggleUnidade('B')
    expect(s.unidade).toEqual(['A', 'B'])
    s.toggleUnidade('A')
    expect(s.unidade).toEqual(['B'])
  })

  it('activeCount conta filtros não-vazios', () => {
    const s = useFilterStore()
    expect(s.activeCount).toBe(0)
    s.toggleGrupo('Ambulatorial')
    s.toggleUnidade('A')
    s.setDataInicio('2024-01-01')
    expect(s.activeCount).toBe(3)
  })

  it('activeFilters omite listas vazias e envia arrays', () => {
    const s = useFilterStore()
    expect(s.activeFilters.unidade).toBeUndefined()
    s.toggleUnidade('A')
    s.toggleUnidade('B')
    expect(s.activeFilters.unidade).toEqual(['A', 'B'])
  })

  it('setUnidades substitui a lista inteira', () => {
    const s = useFilterStore()
    s.setUnidades(['X', 'Y'])
    expect(s.unidade).toEqual(['X', 'Y'])
  })

  it('reset limpa tudo menos groupBy', () => {
    const s = useFilterStore()
    s.toggleGrupo('G'); s.toggleUnidade('U'); s.setGroupBy('especialidade')
    s.reset()
    expect(s.grupo).toEqual([])
    expect(s.unidade).toEqual([])
    expect(s.groupBy).toBe('especialidade')
  })
})
