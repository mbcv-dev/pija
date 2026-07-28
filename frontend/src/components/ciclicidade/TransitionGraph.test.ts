import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TransitionGraph from './TransitionGraph.vue'
import type { NoItem, TransicaoItem } from '@/types/api.types'

const props: { nos: NoItem[]; transicoes: TransicaoItem[] } = {
  nos: [
    { tipo: 'PRONTUARIO', total_entradas: 0, total_saidas: 5 },
    { tipo: 'CONSULTA', total_entradas: 5, total_saidas: 1 },
    { tipo: 'INTERNACAO', total_entradas: 1, total_saidas: 1 },
  ],
  transicoes: [
    { origem: 'PRONTUARIO', destino: 'CONSULTA', volume: 5, tempo_medio_s: 86400, n: 5 },
    { origem: 'CONSULTA', destino: 'INTERNACAO', volume: 1, tempo_medio_s: 172800, n: 1 },
    { origem: 'INTERNACAO', destino: 'CONSULTA', volume: 1, tempo_medio_s: 259200, n: 1 },
  ],
}

describe('TransitionGraph', () => {
  it('renderiza um <svg>', () => {
    const w = mount(TransitionGraph, { props })
    expect(w.find('svg').exists()).toBe(true)
  })

  it('desenha um nó por tipo e uma aresta por transição', () => {
    const w = mount(TransitionGraph, { props })
    expect(w.findAll('[data-node]')).toHaveLength(3)
    expect(w.findAll('[data-edge]')).toHaveLength(3)
  })
})

// Fixture maior (14 transições, 7 nós) para exercitar top-N e filtro por clique.
const T = (origem: string, destino: string, volume: number): TransicaoItem =>
  ({ origem, destino, volume, tempo_medio_s: 86400, n: volume } as TransicaoItem)

const bigNos: NoItem[] = (
  ['PRONTUARIO', 'CONSULTA', 'PROCEDIMENTO', 'EXAME', 'INTERNACAO', 'CIRURGIA', 'ALTA'] as const
).map((tipo) => ({ tipo, total_entradas: 10, total_saidas: 10 }))

const bigTransicoes: TransicaoItem[] = [
  T('PRONTUARIO', 'CONSULTA', 100),
  T('PRONTUARIO', 'EXAME', 90),
  T('ALTA', 'PRONTUARIO', 5), // 3ª incidente de PRONTUARIO
  T('CONSULTA', 'EXAME', 80),
  T('CONSULTA', 'INTERNACAO', 70),
  T('EXAME', 'EXAME', 60),
  T('EXAME', 'CONSULTA', 55),
  T('PROCEDIMENTO', 'EXAME', 50),
  T('INTERNACAO', 'ALTA', 45),
  T('CIRURGIA', 'ALTA', 40),
  T('ALTA', 'CONSULTA', 35),
  T('PROCEDIMENTO', 'PROCEDIMENTO', 30),
  T('CONSULTA', 'CONSULTA', 25),
  T('INTERNACAO', 'CONSULTA', 20),
]

describe('TransitionGraph — top-N e filtro por clique', () => {
  it('por padrão mostra apenas as 10 transições mais fortes quando há muitas', () => {
    const w = mount(TransitionGraph, { props: { nos: bigNos, transicoes: bigTransicoes } })
    expect(w.findAll('[data-edge]')).toHaveLength(10)
  })

  it('clicar num nó filtra o grafo às transições incidentes a ele', async () => {
    const w = mount(TransitionGraph, { props: { nos: bigNos, transicoes: bigTransicoes } })
    // Nós na ordem canônica: índice 0 = PRONTUARIO. Ele participa de 3 transições.
    await w.findAll('[data-node]')[0].trigger('click')
    expect(w.findAll('[data-edge]')).toHaveLength(3)
  })
})
