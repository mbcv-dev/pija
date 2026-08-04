import type { DistBucket, DistribuicoesParams, DistribuicoesResponse, KpiCode, KpiDistribuicao } from '@/types/api.types'
import { UNIDADES } from '@/types/api.types'

// Mock do histograma de tempos (GET /kpis/distribuicoes).
// Objetivo: dar ao dev com VITE_USE_MOCK=true uma distribuição assimétrica à
// direita, com cauda visível — que é exatamente o que o gráfico precisa mostrar.
// Duas invariantes do backend são preservadas em TODA entrada, senão o mock
// mentiria para o gráfico:
//   1. teto === buckets[buckets.length - 1].de
//   2. soma dos n === n_total

/** Baldes lineares antes da cauda aberta — mesmo número que o backend usa. */
const N_LINEARES = 16

/** Fração dos casos que cai na cauda aberta: por construção o teto é o p95. */
const FRACAO_CAUDA = 0.05

interface PerfilDist {
  /** Teto do eixo linear, na unidade do KPI. */
  teto: number
  nTotal: number
  /**
   * Decaimento geométrico entre baldes lineares consecutivos. Quanto menor,
   * mais concentrado à esquerda — 0,35 no KPI-07B reproduz o caso âncora
   * (mediana rente a zero e uma cauda longa de casos represados no leito).
   */
  decaimento: number
  unidade: 'dias' | 'horas'
}

const PERFIS: Record<KpiCode, PerfilDist> = {
  'KPI-01': { teto: 48, nTotal: 45230, decaimento: 0.72, unidade: 'dias' },
  'KPI-03': { teto: 64, nTotal: 130000, decaimento: 0.85, unidade: 'dias' },
  'KPI-05': { teto: 40, nTotal: 28100, decaimento: 0.78, unidade: 'dias' },
  'KPI-06': { teto: 96, nTotal: 8920, decaimento: 0.88, unidade: 'dias' },
  'KPI-07': { teto: 24, nTotal: 12300, decaimento: 0.68, unidade: 'dias' },
  'KPI-07B': { teto: 6.3, nTotal: 12300, decaimento: 0.35, unidade: 'horas' },
}

const arred = (v: number): number => +v.toFixed(2)

/**
 * Gera 16 baldes lineares decrescentes + 1 balde de cauda aberta no teto.
 * A sobra do arredondamento vai para o 1º balde (o maior), de forma que a soma
 * dos n bata exatamente com n_total.
 */
function gerarBuckets(teto: number, nTotal: number, decaimento: number): DistBucket[] {
  const pesos = Array.from({ length: N_LINEARES }, (_, i) => decaimento ** i)
  const somaPesos = pesos.reduce((a, b) => a + b, 0)

  const nLineares = pesos.map((p) => Math.round((nTotal * (1 - FRACAO_CAUDA) * p) / somaPesos))
  nLineares[0] += Math.round(nTotal * (1 - FRACAO_CAUDA)) - nLineares.reduce((a, b) => a + b, 0)

  const largura = teto / N_LINEARES
  // A borda superior do último balde linear é o próprio teto, sem arredondamento,
  // para casar com o `de` da cauda.
  const borda = (i: number): number => (i === N_LINEARES ? teto : arred(i * largura))

  const buckets: DistBucket[] = nLineares.map((n, i) => ({ de: borda(i), ate: borda(i + 1), n }))
  buckets.push({ de: teto, ate: null, n: nTotal - nLineares.reduce((a, b) => a + b, 0) })
  return buckets
}

/** Mediana estimada por interpolação dentro do balde em que ela cai. */
function estimarP50(buckets: DistBucket[], nTotal: number): number {
  const alvo = nTotal / 2
  let acumulado = 0
  for (const b of buckets) {
    if (acumulado + b.n >= alvo && b.ate !== null && b.n > 0) {
      return arred(b.de + (b.ate - b.de) * ((alvo - acumulado) / b.n))
    }
    acumulado += b.n
  }
  return arred(buckets[buckets.length - 1]?.de ?? 0)
}

export function mockDistribuicoes(params: DistribuicoesParams): DistribuicoesResponse {
  // Mesmo fator de ajuste por filtro do mockKpis, para os dois mocks contarem
  // a mesma história quando o usuário filtra.
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
  const codes = params.kpi_codes && params.kpi_codes.length > 0 ? params.kpi_codes : allCodes

  const distribuicoes: KpiDistribuicao[] = codes.map((codigo) => {
    const perfil = PERFIS[codigo]
    // Mesmo recorte sem dados do mockKpis — exercita o caminho "gráfico oculto".
    const semDados = codigo === 'KPI-05' && !!params.especialidade?.includes('CIRURGIA GERAL')
    if (semDados) {
      return { codigo, unidade_tempo: perfil.unidade, p50: null, p95: null, teto: null, n_total: 0, buckets: [] }
    }

    const teto = arred(perfil.teto * fator)
    const nTotal = Math.floor(perfil.nTotal * fator)
    const buckets = gerarBuckets(teto, nTotal, perfil.decaimento)

    return {
      codigo,
      unidade_tempo: perfil.unidade,
      p50: estimarP50(buckets, nTotal),
      // A cauda contém exatamente os 5% piores, então o p95 é o próprio teto.
      p95: teto,
      teto,
      n_total: nTotal,
      buckets,
    }
  })

  return { distribuicoes }
}
