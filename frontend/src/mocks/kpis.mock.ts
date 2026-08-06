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
  'KPI-10': 0.95, // horas — acima da mediana real (0,65 h), puxada pela cauda
  'KPI-10B': 0.21, // horas — mediana real 5 min, mas a cauda chega a 1 h
}

const N_GLOBAL: Record<KpiCode, number> = {
  'KPI-01': 45230,
  'KPI-03': 130000,
  'KPI-05': 28100,
  'KPI-06': 8920,
  'KPI-07': 12300,
  'KPI-07B': 12300,
  // Volumes medidos na base de produção: o 10B perde as cirurgias sem a entrada
  // na sala registrada, por isso fica 26 casos abaixo do 10.
  'KPI-10': 19321,
  'KPI-10B': 19295,
}

const DESCRICOES: Record<KpiCode, string> = {
  'KPI-01': 'Tempo prontuário → 1º evento assistencial',
  'KPI-03': 'Tempo agendamento → realização (consulta)',
  'KPI-05': 'Solicitação → liberação (exame)',
  'KPI-06': 'Tempo última consulta → internação',
  'KPI-07': 'Tempo de permanência no leito',
  'KPI-07B': 'Tempo alta médica → saída do leito',
  'KPI-10': 'Duração da cirurgia',
  'KPI-10B': 'Entrada na sala → início da cirurgia',
}

/** KPIs medidos em horas; os demais, em dias. */
const EM_HORAS: KpiCode[] = ['KPI-07B', 'KPI-10', 'KPI-10B']

/**
 * Submétricas: renderizam dentro do card do KPI pai, que já mostra o breakdown
 * da área — por isso o mock não gera um segundo para elas.
 */
const SUBMETRICAS: KpiCode[] = ['KPI-07B', 'KPI-10B']

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

function gerarBreakdown(baseMedia: number, kpiCode: string, groupBy: string, casas: number): BreakdownItem[] {
  const dimensoes = groupBy === 'especialidade'
    ? ['CARDIOLOGIA', 'ORTOPEDIA', 'NEUROLOGIA', 'PEDIATRIA', 'GINECOLOGIA', 'CLÍNICA MÉDICA']
    : [...UNIDADES]

  const seed = kpiCode.charCodeAt(4) + kpiCode.charCodeAt(5) * 100
  const rng = seededRandom(seed)

  return dimensoes
    .map((dimensao) => ({
      dimensao,
      media: +(baseMedia * (0.55 + rng() * 0.9)).toFixed(casas),
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

  const allCodes: KpiCode[] = [
    'KPI-01', 'KPI-03', 'KPI-05', 'KPI-06', 'KPI-07', 'KPI-07B', 'KPI-10', 'KPI-10B',
  ]
  const codes = params.kpi_codes && params.kpi_codes.length > 0
    ? params.kpi_codes
    : allCodes

  // Simular null para KPI-05 quando filtrado por especialidade específica sem dados
  const kpis = codes.map((codigo) => {
    const baseMedia = BASE_MEDIAS[codigo] * fator
    const isKpi05NoData = codigo === 'KPI-05' && !!params.especialidade?.includes('CIRURGIA GERAL')
    const isHoras = EM_HORAS.includes(codigo)
    // Duas casas nos KPIs em horas: o 10B tem mediana de minutos e uma casa só
    // arredondaria tudo para 0,2 h — o mock esconderia a escala do indicador.
    const casas = isHoras ? 2 : 1

    return {
      codigo,
      descricao: DESCRICOES[codigo],
      unidade_tempo: (isHoras ? 'horas' : 'dias') as 'dias' | 'horas',
      media_global: isKpi05NoData ? null : +baseMedia.toFixed(casas),
      n_global: isKpi05NoData ? 0 : Math.floor(N_GLOBAL[codigo] * fator),
      breakdown: isKpi05NoData || SUBMETRICAS.includes(codigo)
        ? []
        : gerarBreakdown(baseMedia, codigo, groupBy, casas),
    }
  })

  return { kpis }
}
