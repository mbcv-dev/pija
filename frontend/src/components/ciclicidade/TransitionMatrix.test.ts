import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TransitionMatrix from './TransitionMatrix.vue'
import type { NoItem, TransicaoItem } from '@/types/api.types'

const props: { nos: NoItem[]; transicoes: TransicaoItem[] } = {
  nos: [
    { tipo: 'PRONTUARIO', total_entradas: 0, total_saidas: 5 },
    { tipo: 'CONSULTA', total_entradas: 5, total_saidas: 0 },
  ],
  transicoes: [
    { origem: 'PRONTUARIO', destino: 'CONSULTA', volume: 5, tempo_medio_s: 86400, n: 5 },
  ],
}

describe('TransitionMatrix', () => {
  it('renderiza uma célula com o volume da transição', () => {
    const w = mount(TransitionMatrix, { props })
    expect(w.text()).toContain('5')
  })

  it('renderiza os tipos como cabeçalhos de linha/coluna', () => {
    const w = mount(TransitionMatrix, { props })
    expect(w.text()).toContain('PRONTUARIO')
    expect(w.text()).toContain('CONSULTA')
  })
})
