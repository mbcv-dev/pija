import type { UnidadeDim } from '@/types/api.types'

export interface GrupoDeOpcoes {
  label: string
  options: string[]
}

/** Agrupa unidades por grupo assistencial, preservando a ordem de aparição. */
export function agruparUnidades(unidades: readonly UnidadeDim[]): GrupoDeOpcoes[] {
  const blocos: GrupoDeOpcoes[] = []
  const indice = new Map<string, GrupoDeOpcoes>()
  for (const u of unidades) {
    const label = u.grupo ?? 'Sem grupo'
    let bloco = indice.get(label)
    if (!bloco) {
      bloco = { label, options: [] }
      indice.set(label, bloco)
      blocos.push(bloco)
    }
    bloco.options.push(u.valor)
  }
  return blocos
}
