import { describe, it, expect } from 'vitest'
import {
  agruparUnidades,
  separarEspecialidade,
  agruparEspecialidades,
  expandirEspecialidades,
} from './dimensoes'

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

describe('separarEspecialidade', () => {
  it('separa "BASE - SUBTIPO" no primeiro " - "', () => {
    expect(separarEspecialidade('REUMATOLOGIA - INFUSAO'))
      .toEqual({ base: 'REUMATOLOGIA', subtipo: 'INFUSAO' })
  })

  it('só o PRIMEIRO " - " separa; o resto fica no subtipo', () => {
    expect(separarEspecialidade('NEFROLOGIA - PRE - TRANSPLANTE'))
      .toEqual({ base: 'NEFROLOGIA', subtipo: 'PRE - TRANSPLANTE' })
  })

  it('separa "BASE (SUBTIPO)" sem os parênteses no subtipo', () => {
    expect(separarEspecialidade('CARDIOLOGIA (ECO)'))
      .toEqual({ base: 'CARDIOLOGIA', subtipo: 'ECO' })
  })

  it('usa o separador que aparece PRIMEIRO quando há " - " e " ("', () => {
    expect(separarEspecialidade('NEURO - AVALIACAO (RETORNO)'))
      .toEqual({ base: 'NEURO', subtipo: 'AVALIACAO (RETORNO)' })
    expect(separarEspecialidade('NEURO (AVALIACAO - RETORNO)'))
      .toEqual({ base: 'NEURO', subtipo: 'AVALIACAO - RETORNO' })
  })

  it('sem separador: base = valor inteiro, subtipo null', () => {
    expect(separarEspecialidade('PEDIATRIA'))
      .toEqual({ base: 'PEDIATRIA', subtipo: null })
  })

  it('preserva acentos e caixa', () => {
    expect(separarEspecialidade('NEFROLOGIA - INFILTRAÇÃO'))
      .toEqual({ base: 'NEFROLOGIA', subtipo: 'INFILTRAÇÃO' })
    expect(separarEspecialidade('Cardiologia (Eco Fetal)'))
      .toEqual({ base: 'Cardiologia', subtipo: 'Eco Fetal' })
  })

  it('hífen sem espaços NÃO separa', () => {
    expect(separarEspecialidade('PRE-NATAL'))
      .toEqual({ base: 'PRE-NATAL', subtipo: null })
  })

  it('valor que começa pelo separador não gera base vazia', () => {
    expect(separarEspecialidade(' - ESTRANHO'))
      .toEqual({ base: ' - ESTRANHO', subtipo: null })
  })

  it('trima a base: espaço duplo antes do " - " agrupa com a base normal', () => {
    // Caso real da base do HC: 'ALERGIA  - LACTENTE SIBILANTE' (dois espaços).
    expect(separarEspecialidade('ALERGIA  - LACTENTE SIBILANTE'))
      .toEqual({ base: 'ALERGIA', subtipo: 'LACTENTE SIBILANTE' })
    const grupos = agruparEspecialidades(['ALERGIA - RINITE', 'ALERGIA  - LACTENTE SIBILANTE'])
    expect(grupos).toHaveLength(1)
    expect(grupos[0]!.valores).toEqual(['ALERGIA - RINITE', 'ALERGIA  - LACTENTE SIBILANTE'])
  })
})

describe('agruparEspecialidades', () => {
  const valores = [
    'REUMATOLOGIA',
    'REUMATOLOGIA - INFUSAO',
    'REUMATOLOGIA - LUPUS',
    'CARDIOLOGIA (ECO)',
    'PEDIATRIA',
  ]

  it('agrupa valores brutos por base, preservando ordem de aparição', () => {
    const r = agruparEspecialidades(valores)
    expect(r.map((b) => b.base)).toEqual(['REUMATOLOGIA', 'CARDIOLOGIA', 'PEDIATRIA'])
    expect(r[0].valores).toEqual([
      'REUMATOLOGIA', 'REUMATOLOGIA - INFUSAO', 'REUMATOLOGIA - LUPUS',
    ])
  })

  it('lista subtipos com o valor bruto correspondente', () => {
    const r = agruparEspecialidades(valores)
    expect(r[0].subtipos).toEqual([
      { subtipo: 'INFUSAO', valor: 'REUMATOLOGIA - INFUSAO' },
      { subtipo: 'LUPUS', valor: 'REUMATOLOGIA - LUPUS' },
    ])
    expect(r[1].subtipos).toEqual([{ subtipo: 'ECO', valor: 'CARDIOLOGIA (ECO)' }])
    expect(r[2].subtipos).toEqual([])
  })

  it('lista vazia devolve vazio', () => {
    expect(agruparEspecialidades([])).toEqual([])
  })
})

describe('expandirEspecialidades', () => {
  const grupos = agruparEspecialidades([
    'REUMATOLOGIA',
    'REUMATOLOGIA - INFUSAO',
    'REUMATOLOGIA - LUPUS',
    'CARDIOLOGIA (ECO)',
    'CARDIOLOGIA (ERGO)',
    'PEDIATRIA',
  ])

  it('sem base selecionada devolve vazio (= "Todas")', () => {
    expect(expandirEspecialidades(grupos, [], [])).toEqual([])
  })

  it('base sem subtipo selecionado expande para TODOS os valores brutos da base', () => {
    expect(expandirEspecialidades(grupos, ['REUMATOLOGIA'], [])).toEqual([
      'REUMATOLOGIA', 'REUMATOLOGIA - INFUSAO', 'REUMATOLOGIA - LUPUS',
    ])
  })

  it('subtipo selecionado restringe a base só aos valores brutos escolhidos', () => {
    expect(
      expandirEspecialidades(grupos, ['REUMATOLOGIA'], ['REUMATOLOGIA - LUPUS']),
    ).toEqual(['REUMATOLOGIA - LUPUS'])
  })

  it('subtipo de uma base não restringe outra base selecionada', () => {
    expect(
      expandirEspecialidades(
        grupos,
        ['REUMATOLOGIA', 'CARDIOLOGIA'],
        ['CARDIOLOGIA (ECO)'],
      ),
    ).toEqual([
      'REUMATOLOGIA', 'REUMATOLOGIA - INFUSAO', 'REUMATOLOGIA - LUPUS',
      'CARDIOLOGIA (ECO)',
    ])
  })

  it('ignora subtipos de bases não selecionadas', () => {
    expect(
      expandirEspecialidades(grupos, ['PEDIATRIA'], ['REUMATOLOGIA - LUPUS']),
    ).toEqual(['PEDIATRIA'])
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
