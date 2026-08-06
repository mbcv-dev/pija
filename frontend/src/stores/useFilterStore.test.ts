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

  it('activeFilters nao carrega group_by', () => {
    // O breakdown e fixo em unidade executora: sem escolha na tela, o store nao
    // deve carregar o estado dela. O backend mantem o parametro com default.
    const store = useFilterStore()
    expect('group_by' in store.activeFilters).toBe(false)
  })

  it('reset limpa grupo e unidade', () => {
    const s = useFilterStore()
    s.toggleGrupo('G'); s.toggleUnidade('U')
    s.reset()
    expect(s.grupo).toEqual([])
    expect(s.unidade).toEqual([])
  })
})

describe('useFilterStore (especialidade base + subtipo)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('começa sem seleção de base nem subtipo', () => {
    const s = useFilterStore()
    expect(s.especialidadeBase).toEqual([])
    expect(s.especialidadeSubtipo).toEqual([])
  })

  it('setEspecialidadeSelecao guarda a seleção e o filtro expandido (valores brutos)', () => {
    const s = useFilterStore()
    s.setEspecialidadeSelecao(
      ['REUMATOLOGIA'],
      [],
      ['REUMATOLOGIA', 'REUMATOLOGIA - INFUSAO', 'REUMATOLOGIA - LUPUS'],
    )
    expect(s.especialidadeBase).toEqual(['REUMATOLOGIA'])
    expect(s.especialidadeSubtipo).toEqual([])
    // Contrato da API intacto: `especialidade` continua a lista de valores BRUTOS.
    expect(s.activeFilters.especialidade).toEqual([
      'REUMATOLOGIA', 'REUMATOLOGIA - INFUSAO', 'REUMATOLOGIA - LUPUS',
    ])
  })

  it('subtipo restringe o filtro aos valores brutos escolhidos', () => {
    const s = useFilterStore()
    s.setEspecialidadeSelecao(
      ['REUMATOLOGIA'], ['REUMATOLOGIA - LUPUS'], ['REUMATOLOGIA - LUPUS'],
    )
    expect(s.especialidadeSubtipo).toEqual(['REUMATOLOGIA - LUPUS'])
    expect(s.activeFilters.especialidade).toEqual(['REUMATOLOGIA - LUPUS'])
  })

  it('seleção de base conta como 1 filtro ativo', () => {
    const s = useFilterStore()
    s.setEspecialidadeSelecao(['REUMATOLOGIA'], [], ['REUMATOLOGIA'])
    expect(s.activeCount).toBe(1)
  })

  it('setEspecialidades([]) (cascata) também limpa base e subtipo', () => {
    const s = useFilterStore()
    s.setEspecialidadeSelecao(['REUMATOLOGIA'], ['REUMATOLOGIA - LUPUS'], ['REUMATOLOGIA - LUPUS'])
    s.setEspecialidades([])
    expect(s.especialidade).toEqual([])
    expect(s.especialidadeBase).toEqual([])
    expect(s.especialidadeSubtipo).toEqual([])
  })

  it('reset limpa base e subtipo', () => {
    const s = useFilterStore()
    s.setEspecialidadeSelecao(['REUMATOLOGIA'], ['REUMATOLOGIA - LUPUS'], ['REUMATOLOGIA - LUPUS'])
    s.reset()
    expect(s.especialidade).toEqual([])
    expect(s.especialidadeBase).toEqual([])
    expect(s.especialidadeSubtipo).toEqual([])
  })
})
