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

// Fixture acima tem 7 avanços, 4 retornos e 3 repetições (auto-laços).
describe('TransitionGraph — modo "Escolher" (quais transições aparecem)', () => {
  const montar = () => mount(TransitionGraph, { props: { nos: bigNos, transicoes: bigTransicoes } })
  const entrarNoModoEscolher = async (w: ReturnType<typeof montar>) => {
    await w.get('[data-modo="escolher"]').trigger('click')
    return w
  }

  it('oferece o modo de escolha no escopo agregado', () => {
    expect(montar().find('[data-modo="escolher"]').exists()).toBe(true)
  })

  it('não oferece o modo de escolha no escopo paciente', () => {
    const w = mount(TransitionGraph, {
      props: { nos: bigNos, transicoes: bigTransicoes, escopo: 'paciente' },
    })
    expect(w.find('[data-modo="escolher"]').exists()).toBe(false)
  })

  it('ao entrar no modo, mantém as transições que já estavam visíveis', async () => {
    const w = await entrarNoModoEscolher(montar())
    expect(w.findAll('[data-edge]')).toHaveLength(10)
    expect(w.findAll('[data-chip]')).toHaveLength(10)
  })

  it('atalho "Só repetições" deixa apenas os auto-laços', async () => {
    const w = await entrarNoModoEscolher(montar())
    await w.get('[data-preset="repeticoes"]').trigger('click')
    expect(w.findAll('[data-edge]')).toHaveLength(3)
  })

  it('atalho "Só retornos" exclui avanços e repetições', async () => {
    const w = await entrarNoModoEscolher(montar())
    await w.get('[data-preset="retornos"]').trigger('click')
    expect(w.findAll('[data-edge]')).toHaveLength(4)
  })

  it('atalho "Só avanços" deixa apenas quem segue na ordem da jornada', async () => {
    const w = await entrarNoModoEscolher(montar())
    await w.get('[data-preset="avancos"]').trigger('click')
    expect(w.findAll('[data-edge]')).toHaveLength(7)
  })

  it('atalho "Todas" mostra a base inteira', async () => {
    const w = await entrarNoModoEscolher(montar())
    await w.get('[data-preset="todas"]').trigger('click')
    expect(w.findAll('[data-edge]')).toHaveLength(bigTransicoes.length)
  })

  it('remover um chip tira aquela transição do grafo', async () => {
    const w = await entrarNoModoEscolher(montar())
    await w.findAll('[data-chip]')[0].trigger('click')
    expect(w.findAll('[data-edge]')).toHaveLength(9)
    expect(w.findAll('[data-chip]')).toHaveLength(9)
  })

  it('seleção vazia avisa em vez de mostrar um grafo vazio calado', async () => {
    const w = await entrarNoModoEscolher(montar())
    await w.get('[data-preset="nenhuma"]').trigger('click')
    expect(w.findAll('[data-edge]')).toHaveLength(0)
    expect(w.get('[data-vazio]').text()).toContain('Nenhuma transição escolhida')
  })

  it('fica disponível também em coortes pequenas (há o que escolher)', () => {
    const w = mount(TransitionGraph, {
      props: { nos: bigNos, transicoes: bigTransicoes.slice(0, 5) },
    })
    expect(w.find('[data-modo="escolher"]').exists()).toBe(true)
  })

  it('conta o que está sendo mostrado em relação ao total', async () => {
    const w = await entrarNoModoEscolher(montar())
    await w.get('[data-preset="repeticoes"]').trigger('click')
    expect(w.get('[data-contador]').text()).toContain('3 de 14')
  })

  it('trocar a coorte sem nenhuma escolhida sobrevivente volta a semear', async () => {
    const w = await entrarNoModoEscolher(montar())
    await w.get('[data-preset="repeticoes"]').trigger('click')
    expect(w.findAll('[data-edge]')).toHaveLength(3)
    // Nova coorte (filtro aplicado) sem nenhum auto-laço: em vez de um grafo
    // vazio que parece bug, volta a mostrar as principais da coorte nova.
    await w.setProps({ transicoes: bigTransicoes.filter((t) => t.origem !== t.destino) })
    expect(w.findAll('[data-edge]').length).toBeGreaterThan(0)
  })

  it('voltar para "As principais" restaura o corte automático', async () => {
    const w = await entrarNoModoEscolher(montar())
    await w.get('[data-preset="repeticoes"]').trigger('click')
    await w.get('[data-modo="principais"]').trigger('click')
    expect(w.findAll('[data-edge]')).toHaveLength(10)
  })
})
