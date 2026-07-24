import type { GargaloParams, GargalosResponse, GargaloItem, KpiCode } from '@/types/api.types'
import { UNIDADES } from '@/types/api.types'

// ── Todos os pares dimensão × KPI com médias base ─────────────

interface GargaloBase {
  dimensao: string
  transicao: KpiCode
  mediaBase: number
  nBase: number
}

function buildAllGargalos(groupBy: 'unidade' | 'especialidade'): GargaloBase[] {
  const dimensoes = groupBy === 'especialidade'
    ? ['CARDIOLOGIA', 'ORTOPEDIA', 'NEUROLOGIA', 'PEDIATRIA', 'GINECOLOGIA', 'CLÍNICA MÉDICA', 'OBSTETRÍCIA', 'CIRURGIA GERAL']
    : [...UNIDADES]

  const transicoes: { code: KpiCode; mediaBase: number }[] = [
    { code: 'KPI-03', mediaBase: 12.4 },
    { code: 'KPI-05', mediaBase: 8.7  },
    { code: 'KPI-06', mediaBase: 21.3 },
    { code: 'KPI-07', mediaBase: 4.8  },
  ]

  const result: GargaloBase[] = []

  dimensoes.forEach((dimensao, di) => {
    transicoes.forEach(({ code, mediaBase }, ti) => {
      // Variação determinística por posição
      const fator = 0.5 + ((di * 3 + ti * 7) % 100) / 100
      result.push({
        dimensao,
        transicao: code,
        mediaBase: +(mediaBase * fator).toFixed(1),
        nBase: 500 + (di * 200 + ti * 300) % 4000,
      })
    })
  })

  return result.sort((a, b) => b.mediaBase - a.mediaBase)
}

// ── Função principal do mock ───────────────────────────────────

export function mockGargalos(params: GargaloParams): GargalosResponse {
  const groupBy = params.group_by ?? 'unidade'
  const limit   = params.limit ?? 10

  let todos = buildAllGargalos(groupBy)

  // Filtrar por unidade/especialidade se fornecido
  const unidadeSel = params.unidade?.[0]
  if (unidadeSel && groupBy === 'unidade') {
    todos = todos.filter((g) => params.unidade!.includes(g.dimensao))
    // Se filtrado por unidade específica, mostrar todos os KPIs dessa unidade
    if (todos.length === 0) {
      // Fallback: gerar dados para essa unidade
      const transicoes: { code: KpiCode; mediaBase: number }[] = [
        { code: 'KPI-03', mediaBase: 12.4 },
        { code: 'KPI-05', mediaBase: 8.7  },
        { code: 'KPI-06', mediaBase: 21.3 },
        { code: 'KPI-07', mediaBase: 4.8  },
      ]
      todos = transicoes.map(({ code, mediaBase }, i) => ({
        dimensao: unidadeSel,
        transicao: code,
        mediaBase: +(mediaBase * (0.7 + i * 0.05)).toFixed(1),
        nBase: 800 + i * 200,
      })).sort((a, b) => b.mediaBase - a.mediaBase)
    }
  }

  if (params.especialidade && params.especialidade.length > 0 && groupBy === 'especialidade') {
    todos = todos.filter((g) => params.especialidade!.includes(g.dimensao))
  }

  // Filtrar por kpi_codes se fornecido
  if (params.kpi_codes && params.kpi_codes.length > 0) {
    todos = todos.filter((g) => params.kpi_codes!.includes(g.transicao))
  }

  const items: GargaloItem[] = todos.slice(0, limit).map((g) => ({
    dimensao_tipo: groupBy,
    dimensao: g.dimensao,
    transicao: g.transicao,
    media: g.mediaBase,
    n: g.nBase,
  }))

  return { items }
}
