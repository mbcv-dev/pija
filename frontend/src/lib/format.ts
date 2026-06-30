export type UnidadeTempo = 'dias' | 'horas'

type DisplayUnit = 'minutos' | 'horas' | 'dias'
const SINGULAR: Record<DisplayUnit, string> = { minutos: 'minuto', horas: 'hora', dias: 'dia' }

/** Número pt-BR: vírgula decimal, sem casa quando inteiro, 1 casa quando fracionário. */
function fmtNumber(v: number): string {
  return Number.isInteger(v)
    ? String(v)
    : v.toFixed(1).replace('.', ',')
}

/**
 * Formata uma duração escolhendo a unidade mais legível pela magnitude.
 * `unit` é a unidade-base em que `value` vem do backend (dias ou horas).
 * < 1 h → minutos · < 1 dia → horas · senão → dias.
 * Resolve os extremos da mediana: `0,1 dias` vira `2,4 horas`; `0 dias` vira `0 minutos`.
 */
export function formatDuration(value: number | null, unit: UnidadeTempo): string {
  if (value === null) return 'sem dados'
  const horas = unit === 'dias' ? value * 24 : value

  let display: number
  let key: DisplayUnit
  if (horas < 1) {
    display = horas * 60
    key = 'minutos'
  } else if (horas < 24) {
    display = horas
    key = 'horas'
  } else {
    display = horas / 24
    key = 'dias'
  }

  const rounded = Math.round(display * 10) / 10
  const palavra = rounded === 1 ? SINGULAR[key] : key
  return `${fmtNumber(rounded)} ${palavra}`
}

/** "850" / "45 mil" / "1,2 mi". */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (n >= 1_000) return `${Math.round(n / 1_000)} mil`
  return String(n)
}
