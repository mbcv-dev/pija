import { describe, it, expect } from 'vitest'
import { mockDistribuicoes } from './distribuicoes.mock'
import { DistribuicoesResponseSchema } from '../schemas/api.schemas'
import type { KpiDistribuicao } from '@/types/api.types'

// Guarda de regressão das invariantes do histograma. Elas parecem óbvias quando
// escritas, mas quebram em silêncio no próximo ajuste do gerador (número de
// baldes lineares, fração da cauda, sobra do arredondamento) — e um mock que
// mente sobre elas leva o gráfico a escalar o eixo errado ou a perder casos.
// Não é um teste do realismo da distribuição, só das invariantes.

function verificarInvariantes(d: KpiDistribuicao): void {
  const { buckets, n_total } = d

  // 1. Nenhum caso some nem aparece do nada.
  expect(buckets.reduce((soma, b) => soma + b.n, 0)).toBe(n_total)

  if (buckets.length === 0) return

  const ultimo = buckets[buckets.length - 1]

  // 2. O teto é o eixo do gráfico e coincide com o início da cauda.
  expect(d.teto).toBe(ultimo.de)

  // 3. Existe exatamente uma cauda aberta, e ela é a última.
  expect(ultimo.ate).toBeNull()
  expect(buckets.filter((b) => b.ate === null)).toHaveLength(1)

  // 4. Baldes lineares contíguos e crescentes — sem buraco nem sobreposição.
  for (let i = 0; i < buckets.length - 1; i++) {
    expect(buckets[i].ate).toBe(buckets[i + 1].de)
    expect(buckets[i + 1].de).toBeGreaterThan(buckets[i].de)
  }
}

const TODOS_OS_CODIGOS = [
  'KPI-01', 'KPI-03', 'KPI-05', 'KPI-06', 'KPI-07', 'KPI-07B', 'KPI-10', 'KPI-10B',
]

describe('mockDistribuicoes', () => {
  it('devolve os 8 KPIs e valida contra o schema do backend', () => {
    const res = mockDistribuicoes({})
    expect(res.distribuicoes.map((d) => d.codigo)).toEqual(TODOS_OS_CODIGOS)
    expect(() => DistribuicoesResponseSchema.parse(res)).not.toThrow()
  })

  it('mantém as invariantes em todos os KPIs, sem filtro', () => {
    for (const d of mockDistribuicoes({}).distribuicoes) {
      verificarInvariantes(d)
    }
  })

  it('mantém as invariantes com filtro aplicado (teto fracionário)', () => {
    const res = mockDistribuicoes({ unidade: ['UTI ADULTO'], especialidade: ['CARDIOLOGIA'] })
    expect(() => DistribuicoesResponseSchema.parse(res)).not.toThrow()
    for (const d of res.distribuicoes) {
      verificarInvariantes(d)
    }
  })

  it('recorte sem dados devolve n_total 0, buckets vazio e percentis nulos', () => {
    const res = mockDistribuicoes({ kpi_codes: ['KPI-05'], especialidade: ['CIRURGIA GERAL'] })
    expect(() => DistribuicoesResponseSchema.parse(res)).not.toThrow()

    const [d] = res.distribuicoes
    expect(d).toMatchObject({ n_total: 0, buckets: [], p50: null, p95: null, teto: null })
    verificarInvariantes(d)
  })

  it('recorte com tudo zero devolve um único balde de cauda aberta em 0', () => {
    const res = mockDistribuicoes({ kpi_codes: ['KPI-07B'], unidade: ['MATERNIDADE'] })
    expect(() => DistribuicoesResponseSchema.parse(res)).not.toThrow()

    const [d] = res.distribuicoes
    expect(d.buckets).toHaveLength(1)
    expect(d.buckets[0]).toEqual({ de: 0, ate: null, n: d.n_total })
    expect(d.n_total).toBeGreaterThan(0)
    expect(d.teto).toBe(0)
    verificarInvariantes(d)
  })
})
