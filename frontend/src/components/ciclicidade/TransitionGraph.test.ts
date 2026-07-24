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
