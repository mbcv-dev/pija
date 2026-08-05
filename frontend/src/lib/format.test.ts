import { describe, it, expect } from 'vitest'
import { formatDuration, formatCount, pluralCasos, formatCasos } from './format'

describe('formatDuration', () => {
  it('null vira "sem dados"', () => {
    expect(formatDuration(null, 'dias')).toBe('sem dados')
  })
  it('formata dias com vírgula decimal', () => {
    expect(formatDuration(12.4, 'dias')).toBe('12,4 dias')
  })
  it('singular para exatamente 1', () => {
    expect(formatDuration(1, 'dias')).toBe('1 dia')
    expect(formatDuration(1, 'horas')).toBe('1 hora')
  })
  it('inteiro não mostra casa decimal', () => {
    expect(formatDuration(5, 'dias')).toBe('5 dias')
  })
  it('formata horas', () => {
    expect(formatDuration(2.4, 'horas')).toBe('2,4 horas')
  })

  // ── Unidade adaptativa: escolhe min/horas/dias pela magnitude ──
  it('< 1 dia (em dias) cai para horas', () => {
    expect(formatDuration(0.1, 'dias')).toBe('2,4 horas')
  })
  it('< 1 hora (em dias) cai para minutos', () => {
    expect(formatDuration(0.02, 'dias')).toBe('28,8 minutos')
  })
  it('< 1 hora (em horas) cai para minutos', () => {
    expect(formatDuration(0.5, 'horas')).toBe('30 minutos')
  })
  it('1 minuto no singular', () => {
    expect(formatDuration(1 / 60, 'horas')).toBe('1 minuto')
  })
  it('duração que arredonda pra zero vira "< 1 min"', () => {
    expect(formatDuration(0, 'horas')).toBe('< 1 min')
    expect(formatDuration(0, 'dias')).toBe('< 1 min')
    expect(formatDuration(0.0001, 'horas')).toBe('< 1 min') // ~0,006 min → arredonda p/ 0
  })
  it('valor grande em horas sobe para dias', () => {
    expect(formatDuration(48, 'horas')).toBe('2 dias')
  })
})

describe('formatCount', () => {
  it('abaixo de mil mostra cru', () => {
    expect(formatCount(850)).toBe('850')
  })
  it('milhares com "mil"', () => {
    expect(formatCount(45230)).toBe('45 mil')
  })
  it('milhões com "mi" e vírgula', () => {
    expect(formatCount(1_200_000)).toBe('1,2 mi')
  })
})

describe('pluralCasos', () => {
  it('singular só no 1 exato', () => {
    expect(pluralCasos(1)).toBe('caso')
  })
  it('plural no zero — "0 casos" é a forma certa em pt-BR', () => {
    expect(pluralCasos(0)).toBe('casos')
  })
  it('plural em qualquer outro número', () => {
    expect(pluralCasos(2)).toBe('casos')
    expect(pluralCasos(1475)).toBe('casos')
  })
})

describe('formatCasos', () => {
  it('um caso só não vira "1 casos"', () => {
    // O defeito que motivou extrair a regra: o card dizia "baseado em 1 casos"
    // logo acima do histograma, que já dizia "1 caso".
    expect(formatCasos(1)).toBe('1 caso')
  })
  it('mantém a contagem compacta do formatCount', () => {
    expect(formatCasos(850)).toBe('850 casos')
    expect(formatCasos(45230)).toBe('45 mil casos')
    expect(formatCasos(1_200_000)).toBe('1,2 mi casos')
  })
  it('zero fica no plural', () => {
    expect(formatCasos(0)).toBe('0 casos')
  })
})
