export type IntensityLevel = 0 | 1 | 2 | 3 | 4

/** Normaliza value em [min,max] para um dos 5 níveis (0=baixo … 4=alto). */
export function intensityLevel(value: number, min: number, max: number): IntensityLevel {
  if (max <= min) return 0
  const clamped = Math.min(max, Math.max(min, value))
  const ratio = (clamped - min) / (max - min)
  return Math.round(ratio * 4) as IntensityLevel
}

const BAR_CLASSES: Record<IntensityLevel, string> = {
  0: 'bg-intensity-0',
  1: 'bg-intensity-1',
  2: 'bg-intensity-2',
  3: 'bg-intensity-3',
  4: 'bg-intensity-4',
}

export function intensityBarClass(level: IntensityLevel): string {
  return BAR_CLASSES[level]
}
