import { describe, it, expect } from 'vitest'
import { intensityLevel, intensityBarClass } from './intensity'

describe('intensityLevel', () => {
  it('mínimo é nível 0', () => {
    expect(intensityLevel(0, 0, 100)).toBe(0)
  })
  it('máximo é nível 4', () => {
    expect(intensityLevel(100, 0, 100)).toBe(4)
  })
  it('meio é nível 2', () => {
    expect(intensityLevel(50, 0, 100)).toBe(2)
  })
  it('clampa abaixo do mínimo', () => {
    expect(intensityLevel(-10, 0, 100)).toBe(0)
  })
  it('clampa acima do máximo', () => {
    expect(intensityLevel(200, 0, 100)).toBe(4)
  })
  it('intervalo degenerado (min==max) → 0', () => {
    expect(intensityLevel(5, 5, 5)).toBe(0)
  })
})

describe('intensityBarClass', () => {
  it('mapeia nível para classe de fundo', () => {
    expect(intensityBarClass(0)).toBe('bg-intensity-0')
    expect(intensityBarClass(4)).toBe('bg-intensity-4')
  })
})
