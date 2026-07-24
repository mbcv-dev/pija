import type { KpiParams, KpiResponse, BreakdownItem, KpiCode } from '@/types/api.types'
import { UNIDADES } from '@/types/api.types'

// ── Médias base por KPI ────────────────────────────────────────
const BASE_MEDIAS: Record<KpiCode, number> = {
  'KPI-01': 14.2,
  'KPI-03': 12.4,
  'KPI-05': 8.7,
  'KPI-06': 21.3,
  'KPI-07': 4.8,
  'KPI-07B': 2.4, // horas (alta médica → saída efetiva)
}

const N_GLOBAL: Record<KpiCode, number> = {
  'KPI-01': 45230,
  'KPI-03': 130000,
  'KPI-05': 28100,
  'KPI-06': 8920,
  'KPI-07': 12300,
  'KPI-07B': 12300,
}

const DESCRICOES: Record<KpiCode, string> = {
  'KPI-01': 'Tempo prontuário → 1º evento assistencial',
  'KPI-03': 'Tempo agendamento → realização (consulta)',
  'KPI-05': 'Tempo solicitação → realização (exame)',
  'KPI-06': 'Tempo última consulta → internação',
  'KPI-07': 'Tempo de permanência no leito',
  'KPI-07B': 'Tempo alta médica → saída do leito',
}

// ── Gerador de breakdown dinâmico por seed ────────────────────
// Usa seed determinístico para que os valores sejam estáveis
// entre re-renders, mas variem por unidade/kpi

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function gerarBreakdown(baseMedia: number, kpiCode: string, groupBy: string): BreakdownItem[] {
  const dimensoes = groupBy === 'especialidade'
    ? ['CARDIOLOGIA', 'ORTOPEDIA', 'NEUROLOGIA', 'PEDIATRIA', 'GINECOLOGIA', 'CLÍNICA MÉDICA']
    : [...UNIDADES]

  const seed = kpiCode.charCodeAt(4) + kpiCode.charCodeAt(5) * 100
  const rng = seededRandom(seed)

  return dimensoes
    .map((dimensao) => ({
      dimensao,
      media: +(baseMedia * (0.55 + rng() * 0.9)).toFixed(1),
      n: Math.floor(800 + rng() * 6000),
    }))
    .sort((a, b) => b.media - a.media)
}

// ── Função principal do mock ───────────────────────────────────

export function mockKpis(params: KpiParams): KpiResponse {
  const groupBy = params.group_by ?? 'unidade'

  // Fator de ajuste por unidade (simula filtragem real)
  let fator = 1.0
  const unidadeSel = params.unidade?.[0]
  if (unidadeSel) {
    const unidadeIndex = UNIDADES.indexOf(unidadeSel as typeof UNIDADES[number])
    fator = 0.65 + (unidadeIndex >= 0 ? unidadeIndex : 2) * 0.08
  }
  if (params.especialidade && params.especialidade.length > 0) {
    fator *= 0.9
  }

  const allCodes: KpiCode[] = ['KPI-01', 'KPI-03', 'KPI-05', 'KPI-06', 'KPI-07', 'KPI-07B']
  const codes = params.kpi_codes && params.kpi_codes.length > 0
    ? params.kpi_codes
    : allCodes

  // Simular null para KPI-05 quando filtrado por especialidade específica sem dados
  const kpis = codes.map((codigo) => {
    const baseMedia = BASE_MEDIAS[codigo] * fator
    const isKpi05NoData = codigo === 'KPI-05' && !!params.especialidade?.includes('CIRURGIA GERAL')
    const isHoras = codigo === 'KPI-07B'

    return {
      codigo,
      descricao: DESCRICOES[codigo],
      unidade_tempo: (isHoras ? 'horas' : 'dias') as 'dias' | 'horas',
      media_global: isKpi05NoData ? null : +baseMedia.toFixed(1),
      n_global: isKpi05NoData ? 0 : Math.floor(N_GLOBAL[codigo] * fator),
      breakdown: isKpi05NoData || isHoras ? [] : gerarBreakdown(baseMedia, codigo, groupBy),
    }
  })

  return { kpis }
}
