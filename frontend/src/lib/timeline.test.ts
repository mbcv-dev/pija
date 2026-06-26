import { describe, it, expect } from 'vitest'
import { elapsedLabel, sortByTimestampAsc } from './timeline'
import type { EventoItem } from '@/types/api.types'

function ev(id: string, ts: string): EventoItem {
  return {
    evento_id: id, paciente_id: '1', tipo_entidade: 'CONSULTA', entidade_id: id,
    timestamp_principal: ts, unidade: 'U', especialidade: 'E',
    tipo_evento: 't', situacao: 's',
  }
}

describe('elapsedLabel', () => {
  it('mesmo dia', () => {
    expect(elapsedLabel('2026-03-01T08:00:00', '2026-03-01T15:00:00')).toBe('no mesmo dia')
  })
  it('horas quando < 1 dia mas dias diferentes não se aplica; usa dias', () => {
    expect(elapsedLabel('2026-03-01T00:00:00', '2026-03-09T00:00:00')).toBe('8 dias depois')
  })
  it('1 dia singular', () => {
    expect(elapsedLabel('2026-03-01T00:00:00', '2026-03-02T00:00:00')).toBe('1 dia depois')
  })
})

describe('sortByTimestampAsc', () => {
  it('ordena do mais antigo para o mais novo, sem mutar o original', () => {
    const input = [ev('b', '2026-03-05T00:00:00'), ev('a', '2026-03-01T00:00:00')]
    const out = sortByTimestampAsc(input)
    expect(out.map((e) => e.evento_id)).toEqual(['a', 'b'])
    expect(input[0].evento_id).toBe('b') // original intacto
  })
})
