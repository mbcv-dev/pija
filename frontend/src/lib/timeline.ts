import type { EventoItem } from '@/types/api.types'

const MS_DIA = 86_400_000

/** Rótulo do intervalo entre dois eventos cronológicos: "8 dias depois" / "no mesmo dia". */
export function elapsedLabel(fromISO: string, toISO: string): string {
  const from = new Date(fromISO).getTime()
  const to = new Date(toISO).getTime()
  const dias = Math.floor((to - from) / MS_DIA)
  if (dias <= 0) return 'no mesmo dia'
  return dias === 1 ? '1 dia depois' : `${dias} dias depois`
}

/** Cópia ordenada por timestamp ascendente (não muta a entrada). */
export function sortByTimestampAsc(events: EventoItem[]): EventoItem[] {
  return [...events].sort(
    (a, b) =>
      new Date(a.timestamp_principal).getTime() - new Date(b.timestamp_principal).getTime(),
  )
}
