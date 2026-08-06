import { describe, it, expect } from 'vitest'
import { DistribuicoesResponseSchema } from './api.schemas'

/** Distribuição válida no formato que o backend devolve: 2 lineares + cauda aberta. */
const valida = {
  codigo: 'KPI-05',
  unidade_tempo: 'dias',
  p50: 1, p95: 10, teto: 10, n_total: 100,
  buckets: [
    { de: 0, ate: 5, n: 60 },
    { de: 5, ate: 10, n: 30 },
    { de: 10, ate: null, n: 10 },
  ],
}

const parse = (d: unknown) => DistribuicoesResponseSchema.safeParse({ distribuicoes: [d] })

describe('KpiDistribuicaoSchema — invariantes estruturais', () => {
  it('aceita a forma normal', () => {
    expect(parse(valida).success).toBe(true)
  })

  it('rejeita teto diferente do inicio do ultimo balde', () => {
    // O componente escala o eixo por `teto` e desenha a cauda a partir de
    // buckets[last].de. Se divergirem, o grafico mente sobre onde a cauda comeca.
    expect(parse({ ...valida, teto: 99 }).success).toBe(false)
  })

  it('rejeita duas caudas abertas', () => {
    expect(parse({
      ...valida,
      buckets: [{ de: 0, ate: null, n: 60 }, { de: 10, ate: null, n: 40 }],
    }).success).toBe(false)
  })

  it('rejeita cauda aberta que nao e a ultima', () => {
    expect(parse({
      ...valida,
      buckets: [{ de: 0, ate: null, n: 60 }, { de: 5, ate: 10, n: 40 }],
    }).success).toBe(false)
  })

  it('aceita o degenerado sem dados', () => {
    expect(parse({
      ...valida, p50: null, p95: null, teto: null, n_total: 0, buckets: [],
    }).success).toBe(true)
  })

  it('aceita o degenerado tudo-zero (um balde aberto so)', () => {
    expect(parse({
      ...valida, p50: 0, p95: 0, teto: 0, n_total: 50,
      buckets: [{ de: 0, ate: null, n: 50 }],
    }).success).toBe(true)
  })
})
