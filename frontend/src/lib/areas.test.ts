import { describe, it, expect } from 'vitest'
import { AREAS_JORNADA } from './areas'
import { METRIC_OPTIONS } from './gargalos'

describe('AREAS_JORNADA', () => {
  it('segue a ordem canônica da jornada', () => {
    expect(AREAS_JORNADA.map((a) => a.id)).toEqual([
      'entrada', 'consultas', 'exames', 'internacao', 'cirurgias',
    ])
  })

  it('todo KPI de card aparece em exatamente uma área (07B e 10B são submétricas, não entram)', () => {
    const todos = AREAS_JORNADA.flatMap((a) => a.kpis)
    expect([...todos].sort()).toEqual(['KPI-01', 'KPI-03', 'KPI-05', 'KPI-06', 'KPI-07', 'KPI-10'])
    expect(new Set(todos).size).toBe(todos.length)
  })

  it('cirurgias tem o KPI de duração (a submétrica 10B mora dentro do card)', () => {
    const cirurgias = AREAS_JORNADA.find((a) => a.id === 'cirurgias')!
    expect(cirurgias.kpis).toEqual(['KPI-10'])
    // Sem gargalosKpi de propósito: duração longa costuma ser característica do
    // procedimento, não gargalo — ranqueá-la acusaria a especialidade errada.
    expect(cirurgias.gargalosKpi).toBeUndefined()
  })

  it('todo gargalosKpi participa do ranking de gargalos', () => {
    for (const a of AREAS_JORNADA) {
      if (a.gargalosKpi) expect(METRIC_OPTIONS).toContain(a.gargalosKpi)
    }
  })

  it('toda área tem label, ícone e descrição preenchidos', () => {
    for (const a of AREAS_JORNADA) {
      expect(a.label.length).toBeGreaterThan(0)
      expect(a.icon.length).toBeGreaterThan(0)
      expect(a.descricao.length).toBeGreaterThan(0)
    }
  })
})
