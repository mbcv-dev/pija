import { describe, it, expect } from 'vitest'
import { agruparUnidades } from './dimensoes'

describe('agruparUnidades', () => {
  it('agrupa por grupo preservando a ordem de aparição', () => {
    const r = agruparUnidades([
      { valor: 'UAC: BIOQUÍMICA', grupo: 'Análises Clínicas' },
      { valor: 'UDI: MAMOGRAFIA', grupo: 'Diagnóstico por Imagem' },
      { valor: 'UAC: SOROLOGIA', grupo: 'Análises Clínicas' },
    ])
    expect(r).toEqual([
      { label: 'Análises Clínicas', options: ['UAC: BIOQUÍMICA', 'UAC: SOROLOGIA'] },
      { label: 'Diagnóstico por Imagem', options: ['UDI: MAMOGRAFIA'] },
    ])
  })

  it('agrupa unidades sem grupo sob "Sem grupo"', () => {
    const r = agruparUnidades([{ valor: 'X', grupo: null }])
    expect(r).toEqual([{ label: 'Sem grupo', options: ['X'] }])
  })

  it('lista vazia devolve vazio', () => {
    expect(agruparUnidades([])).toEqual([])
  })
})
