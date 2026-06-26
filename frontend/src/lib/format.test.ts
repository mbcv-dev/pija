import { describe, it, expect } from 'vitest'
import { formatDuration, formatCount } from './format'

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
  it('zero é plural', () => {
    expect(formatDuration(0, 'horas')).toBe('0 horas')
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
