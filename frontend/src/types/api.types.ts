// ============================================================
// PIJA — API Types
// Fonte da verdade: docs/GUIA-FRONTEND.md
// ============================================================

// ── Parâmetros de filtro compartilhados ─────────────────────

export interface BaseFilterParams {
  grupo?: string[]
  unidade?: string[]
  especialidade?: string[]
  data_inicio?: string  // YYYY-MM-DD
  data_fim?: string     // YYYY-MM-DD
}

// ── KPIs ─────────────────────────────────────────────────────

export type KpiCode = 'KPI-01' | 'KPI-03' | 'KPI-05' | 'KPI-06' | 'KPI-07' | 'KPI-07B'
export type GroupBy = 'unidade' | 'especialidade'

export interface KpiParams extends BaseFilterParams {
  group_by?: GroupBy
  kpi_codes?: KpiCode[]
}

export interface BreakdownItem {
  dimensao: string
  media: number
  n: number
}

export interface KpiItem {
  codigo: KpiCode
  descricao: string
  unidade_tempo: 'dias' | 'horas'
  media_global: number | null  // null = sem dados para o recorte
  n_global: number
  breakdown: BreakdownItem[]   // já vem ordenado maior → menor
}

export interface KpiResponse {
  kpis: KpiItem[]
}

// ── Distribuição de tempos (histograma por KPI) ───────────────
// A média/mediana escondem a cauda: o histograma existe justamente para
// mostrá-la. Contrato espelhado de backend/src/pija/schemas/kpis_schema.py.

export interface DistBucket {
  /** Limite inferior do balde, inclusivo, na unidade do KPI. */
  de: number
  /**
   * Limite superior, exclusivo. `null` = balde de cauda aberta (todos os casos
   * >= `de`) — existe no máximo um, e é sempre o último do array.
   */
  ate: number | null
  n: number
}

export interface KpiDistribuicao {
  codigo: KpiCode
  unidade_tempo: 'dias' | 'horas'
  /** Mediana. `null` quando não há dados no recorte. */
  p50: number | null
  /** Percentil 95. Serve de rótulo/referência — NÃO use para escalar o eixo. */
  p95: number | null
  /**
   * Teto do eixo linear do gráfico — é SEMPRE igual a `buckets[buckets.length - 1].de`.
   * Escale o eixo X por `teto`, nunca por `p95`: os dois coincidem no caso normal,
   * mas quando o p95 é 0 (>= 95% dos casos zerados, situação do KPI-07B) o backend
   * cai no valor máximo, senão a cauda — o objeto do gráfico — sumiria.
   * `null` quando não há dados no recorte.
   */
  teto: number | null
  /** Total de casos no recorte. `0` = sem dados; `buckets` vem vazio e o gráfico é ocultado. */
  n_total: number
  /**
   * Baldes em ordem: os lineares de 0 até o `teto` e, por último, a cauda aberta.
   * Normalmente 17 (16 lineares + cauda), mas 1 quando todos os casos são zero e
   * 0 quando não há dados — nunca assuma a quantidade.
   */
  buckets: DistBucket[]
}

export interface DistribuicoesResponse {
  distribuicoes: KpiDistribuicao[]
}

/** Mesmos filtros dos KPIs; `group_by` não se aplica (a distribuição não tem breakdown). */
export type DistribuicoesParams = Omit<KpiParams, 'group_by'>

// ── Gargalos ──────────────────────────────────────────────────

export interface GargaloParams extends BaseFilterParams {
  group_by?: GroupBy
  limit?: number
  kpi_codes?: KpiCode[]
}

export interface GargaloItem {
  dimensao_tipo: 'unidade' | 'especialidade'
  dimensao: string
  transicao: KpiCode
  media: number   // dias
  n: number
}

export interface GargalosResponse {
  items: GargaloItem[]  // já vem ordenado pior → melhor
}

// ── Eventos ───────────────────────────────────────────────────

export type TipoEntidade =
  | 'CONSULTA'
  | 'EXAME'
  | 'INTERNACAO'
  | 'PRONTUARIO'
  | 'CIRURGIA'
  | 'PROCEDIMENTO'
  | 'ALTA'

export interface EventosParams extends BaseFilterParams {
  tipo_entidade?: TipoEntidade
  limit?: number   // 1–500, padrão 50
  offset?: number  // padrão 0
}

export interface EventoItem {
  evento_id: string
  paciente_id: string        // NUNCA exibir nome — só ID
  tipo_entidade: TipoEntidade
  entidade_id: string
  timestamp_principal: string  // ISO 8601
  unidade: string
  especialidade: string
  tipo_evento: string
  situacao: string
}

export interface EventosResponse {
  items: EventoItem[]
  total: number
  limit: number
  offset: number
}

// ── KPI Metadata (labels, ícones, avisos) ─────────────────────

export interface KpiMeta {
  label: string
  /** chave de ícone para o componente Icon */
  icon: string
  aviso?: string
  nota?: string
  /** meta em horas (só KPI-07B) */
  metaHoras?: number
  /** Metodologia (página "Como calculamos") */
  ancora?: string
  unidadeTempo?: 'dias' | 'horas'
  regras?: string
}

export const KPI_META: Record<KpiCode, KpiMeta> = {
  'KPI-01': {
    label: 'Prontuário → 1º evento assistencial', icon: 'clipboard',
    ancora: 'Da abertura do prontuário até o 1º evento não-prontuário do paciente (consulta, exame, internação…).',
    unidadeTempo: 'dias',
    regras: 'Exclui durações negativas e unidades inativas. Atenção: mede o 1º evento presente na base — se o paciente teve eventos anteriores à janela de dados, o tempo é superestimado.',
  },
  'KPI-03': {
    label: 'Agendamento → realização da consulta', icon: 'calendar',
    ancora: 'Do agendamento da consulta até a sua realização.',
    unidadeTempo: 'dias',
    regras: 'Eventos do tipo CONSULTA com agendamento e realização preenchidos. Exclui realização anterior ao agendamento e unidades inativas.',
  },
  'KPI-05': {
    label: 'Solicitação → realização do exame', icon: 'flask',
    aviso: 'Dados de exames limitados a jan–mai/2026',
    ancora: 'Da solicitação do exame até a sua realização.',
    unidadeTempo: 'dias',
    regras: 'Eventos do tipo EXAME com solicitação e realização preenchidos. Exclui realização anterior à solicitação e unidades inativas.',
  },
  'KPI-06': {
    label: 'Última consulta → internação', icon: 'hospital',
    ancora: 'Da última consulta realizada antes da internação até a data da internação.',
    unidadeTempo: 'dias',
    regras: 'Para cada internação, considera a consulta realizada mais recente anterior a ela. Exclui unidades inativas.',
  },
  'KPI-07': {
    label: 'Permanência no leito', icon: 'bed',
    nota: 'Permanência no leito, não tempo até alta médica',
    ancora: 'Do início da internação até a alta administrativa (saída do leito).',
    unidadeTempo: 'dias',
    regras: 'Inclui o período entre a alta médica e a saída efetiva. Exclui alta anterior ao início e unidades inativas.',
  },
  'KPI-07B': {
    label: 'Alta médica → saída do leito', icon: 'bed',
    metaHoras: 4,
    ancora: 'Da alta médica até a saída efetiva do leito (alta administrativa).',
    unidadeTempo: 'horas',
    regras: 'Meta de 4 horas. Exclui saída anterior à alta médica e unidades inativas.',
  },
}

// ── Unidades disponíveis (mock / filtros) ─────────────────────

export const UNIDADES = [
  'AMBULATORIO A',
  'AMBULATORIO B',
  'AMBULATORIO C',
  'PRONTO SOCORRO',
  'UTI ADULTO',
  'MATERNIDADE',
] as const

export type Unidade = typeof UNIDADES[number]

export const ESPECIALIDADES = [
  'CARDIOLOGIA',
  'ORTOPEDIA',
  'NEUROLOGIA',
  'PEDIATRIA',
  'GINECOLOGIA',
  'CLÍNICA MÉDICA',
  'OBSTETRÍCIA',
  'CIRURGIA GERAL',
] as const

export const GRUPOS = [
  'Ambulatorial',
  'Internação',
  'Análises Clínicas',
  'Diagnóstico por Imagem',
  'Anatomia Patológica',
  'Procedimental',
  'Serviços de Apoio',
] as const

export type Grupo = typeof GRUPOS[number]

/** Unidade anotada com o grupo assistencial ao qual pertence. */
export interface UnidadeDim {
  valor: string
  grupo: string | null
}

/** Valores reais dos filtros, vindos do backend (GET /api/v1/dimensoes). */
export interface DimensoesResponse {
  grupos: string[]
  unidades: UnidadeDim[]
  especialidades: string[]
}

// ── Ciclicidade ────────────────────────────────────────────────

export interface CiclicidadeParams {
  paciente_id?: string
  grupo?: string[]
  unidade?: string[]
  especialidade?: string[]
  data_inicio?: string
  data_fim?: string
}

export interface TransicaoItem {
  origem: TipoEntidade
  destino: TipoEntidade
  volume: number
  tempo_medio_s: number | null
  n: number
}

export interface NoItem {
  tipo: TipoEntidade
  total_entradas: number
  total_saidas: number
}

export interface CiclicidadeResponse {
  nos: NoItem[]
  transicoes: TransicaoItem[]
}
