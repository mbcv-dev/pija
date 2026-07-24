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

describe('agruparUnidades — estabilidade', () => {
  it('não mistura opções entre grupos com nomes parecidos', () => {
    const r = agruparUnidades([
      { valor: 'A1', grupo: 'Ambulatorial' },
      { valor: 'B1', grupo: 'Ambulatório' },
      { valor: 'A2', grupo: 'Ambulatorial' },
    ])
    expect(r.map((b) => b.label)).toEqual(['Ambulatorial', 'Ambulatório'])
    expect(r[0].options).toEqual(['A1', 'A2'])
    expect(r[1].options).toEqual(['B1'])
  })
})
