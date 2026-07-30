import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterSelect from './FilterSelect.vue'

async function abrir(w: ReturnType<typeof mount>): Promise<void> {
  await w.find('button[aria-haspopup="listbox"]').trigger('click')
}

describe('FilterSelect — opções string (comportamento existente)', () => {
  it('renderiza as opções e emite o valor ao marcar', async () => {
    const w = mount(FilterSelect, {
      props: { label: 'Grupo', options: ['A', 'B'], modelValue: [] },
    })
    await abrir(w)
    expect(w.text()).toContain('A')
    await w.findAll('input[type="checkbox"]')[0].setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual([['A']])
  })

  it('mostra o placeholder quando nada está selecionado', () => {
    const w = mount(FilterSelect, {
      props: { label: 'Grupo', options: ['A'], modelValue: [], placeholder: 'Todas' },
    })
    expect(w.text()).toContain('Todas')
  })
})

describe('FilterSelect — opções { value, label } (subtipos)', () => {
  const options = [
    { value: 'REUMATOLOGIA - LUPUS', label: 'LUPUS' },
    { value: 'REUMATOLOGIA - INFUSAO', label: 'INFUSAO' },
  ]

  it('exibe a label mas emite o VALUE (valor bruto)', async () => {
    const w = mount(FilterSelect, {
      props: { label: 'Subtipo', options, modelValue: [] },
    })
    await abrir(w)
    expect(w.text()).toContain('LUPUS')
    expect(w.text()).not.toContain('REUMATOLOGIA - LUPUS')
    await w.findAll('input[type="checkbox"]')[0].setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual([['REUMATOLOGIA - LUPUS']])
  })

  it('resumo com 1 selecionado mostra a label, não o value', () => {
    const w = mount(FilterSelect, {
      props: { label: 'Subtipo', options, modelValue: ['REUMATOLOGIA - LUPUS'] },
    })
    expect(w.find('button[aria-haspopup="listbox"]').text()).toContain('LUPUS')
    expect(w.find('button[aria-haspopup="listbox"]').text()).not.toContain('REUMATOLOGIA - LUPUS')
  })

  it('suporta groups com opções { value, label }', async () => {
    const w = mount(FilterSelect, {
      props: {
        label: 'Subtipo',
        options: [],
        groups: [
          { label: 'REUMATOLOGIA', options },
          { label: 'CARDIOLOGIA', options: [{ value: 'CARDIOLOGIA (ECO)', label: 'ECO' }] },
        ],
        modelValue: [],
      },
    })
    await abrir(w)
    expect(w.text()).toContain('REUMATOLOGIA')
    expect(w.text()).toContain('ECO')
    const checks = w.findAll('input[type="checkbox"]')
    expect(checks).toHaveLength(3)
    await checks[2].setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual([['CARDIOLOGIA (ECO)']])
  })
})
