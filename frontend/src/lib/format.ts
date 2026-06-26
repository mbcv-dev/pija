export type UnidadeTempo = 'dias' | 'horas'

const SINGULAR: Record<UnidadeTempo, string> = { dias: 'dia', horas: 'hora' }

/** Número pt-BR: vírgula decimal, sem casa quando inteiro, 1 casa quando fracionário. */
function fmtNumber(v: number): string {
  return Number.isInteger(v)
    ? String(v)
    : v.toFixed(1).replace('.', ',')
}

/** "12,4 dias" / "1 hora" / "sem dados" para null. */
export function formatDuration(value: number | null, unit: UnidadeTempo): string {
  if (value === null) return 'sem dados'
  const palavra = value === 1 ? SINGULAR[unit] : unit
  return `${fmtNumber(value)} ${palavra}`
}

/** "850" / "45 mil" / "1,2 mi". */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (n >= 1_000) return `${Math.round(n / 1_000)} mil`
  return String(n)
}
