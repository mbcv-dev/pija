import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({
  getDimensoes: vi.fn(async () => ({
    grupos: ['Ambulatorial'],
    unidades: [{ valor: 'U1', grupo: 'Ambulatorial' }],
    especialidades: [
      'REUMATOLOGIA',
      'REUMATOLOGIA - INFUSAO',
      'REUMATOLOGIA - LUPUS',
      'CARDIOLOGIA (ECO)',
      'PEDIATRIA',
    ],
  })),
}))

import FilterBar from './FilterBar.vue'
import FilterSelect from './FilterSelect.vue'
import { useFilterStore } from '@/stores/useFilterStore'

let pinia: ReturnType<typeof createPinia>

async function montar() {
  const w = mount(FilterBar, { global: { plugins: [pinia] } })
  await flushPromises()
  return w
}

describe('FilterBar — especialidade base + subtipo', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('ordem dos filtros: Especialidade primeiro, depois Grupo e Unidade executora', async () => {
    const w = await montar()
    const labels = w.findAllComponents(FilterSelect).map((c) => c.props('label'))
    expect(labels).toEqual(['Especialidade', 'Grupo', 'Unidade executora'])
  })

  it('select de Especialidade lista as BASES (não os 705 valores brutos)', async () => {
    const w = await montar()
    const esp = w.findAllComponents(FilterSelect)[0]
    expect(esp.props('options')).toEqual(['REUMATOLOGIA', 'CARDIOLOGIA', 'PEDIATRIA'])
  })

  it('escolher uma base expande para todos os valores brutos no filtro da API', async () => {
    const w = await montar()
    const filter = useFilterStore()
    w.findAllComponents(FilterSelect)[0].vm.$emit('update:modelValue', ['REUMATOLOGIA'])
    await flushPromises()
    expect(filter.activeFilters.especialidade).toEqual([
      'REUMATOLOGIA', 'REUMATOLOGIA - INFUSAO', 'REUMATOLOGIA - LUPUS',
    ])
  })

  it('select de Subtipo só aparece quando a base escolhida tem subtipos', async () => {
    const w = await montar()
    expect(w.findAllComponents(FilterSelect)).toHaveLength(3)

    w.findAllComponents(FilterSelect)[0].vm.$emit('update:modelValue', ['PEDIATRIA'])
    await flushPromises()
    expect(w.findAllComponents(FilterSelect).map((c) => c.props('label')))
      .not.toContain('Subtipo')

    w.findAllComponents(FilterSelect)[0].vm.$emit('update:modelValue', ['PEDIATRIA', 'REUMATOLOGIA'])
    await flushPromises()
    const labels = w.findAllComponents(FilterSelect).map((c) => c.props('label'))
    expect(labels).toEqual(['Especialidade', 'Subtipo', 'Grupo', 'Unidade executora'])
  })

  it('escolher subtipo restringe o filtro aos valores brutos do subtipo', async () => {
    const w = await montar()
    const filter = useFilterStore()
    w.findAllComponents(FilterSelect)[0].vm.$emit('update:modelValue', ['REUMATOLOGIA'])
    await flushPromises()
    const subtipo = w.findAllComponents(FilterSelect).find((c) => c.props('label') === 'Subtipo')!
    subtipo.vm.$emit('update:modelValue', ['REUMATOLOGIA - LUPUS'])
    await flushPromises()
    expect(filter.activeFilters.especialidade).toEqual(['REUMATOLOGIA - LUPUS'])
  })

  it('desmarcar a base descarta os subtipos dela', async () => {
    const w = await montar()
    const filter = useFilterStore()
    w.findAllComponents(FilterSelect)[0].vm.$emit('update:modelValue', ['REUMATOLOGIA'])
    await flushPromises()
    w.findAllComponents(FilterSelect)
      .find((c) => c.props('label') === 'Subtipo')!
      .vm.$emit('update:modelValue', ['REUMATOLOGIA - LUPUS'])
    await flushPromises()

    w.findAllComponents(FilterSelect)[0].vm.$emit('update:modelValue', [])
    await flushPromises()
    expect(filter.especialidadeSubtipo).toEqual([])
    expect(filter.activeFilters.especialidade).toBeUndefined()
  })

  it('cascata: trocar o Grupo limpa a seleção de especialidade (base e subtipo)', async () => {
    const w = await montar()
    const filter = useFilterStore()
    w.findAllComponents(FilterSelect)[0].vm.$emit('update:modelValue', ['REUMATOLOGIA'])
    await flushPromises()

    const grupo = w.findAllComponents(FilterSelect).find((c) => c.props('label') === 'Grupo')!
    grupo.vm.$emit('update:modelValue', ['Ambulatorial'])
    await flushPromises()
    expect(filter.especialidade).toEqual([])
    expect(filter.especialidadeBase).toEqual([])
    expect(filter.especialidadeSubtipo).toEqual([])
  })
})
