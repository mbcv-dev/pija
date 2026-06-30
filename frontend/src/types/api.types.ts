// ============================================================
// PIJA — API Types
// Fonte da verdade: docs/GUIA-FRONTEND.md
// ============================================================

// ── Parâmetros de filtro compartilhados ─────────────────────

export interface BaseFilterParams {
  grupo?: string
  unidade?: string
  especialidade?: string
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
}

export const KPI_META: Record<KpiCode, KpiMeta> = {
  'KPI-01': { label: 'Prontuário → 1º evento assistencial', icon: 'clipboard' },
  'KPI-03': { label: 'Agendamento → realização da consulta', icon: 'calendar' },
  'KPI-05': {
    label: 'Solicitação → realização do exame',
    icon: 'flask',
    aviso: 'Dados de exames limitados a jan–mai/2026',
  },
  'KPI-06': { label: 'Última consulta → internação', icon: 'hospital' },
  'KPI-07': {
    label: 'Permanência no leito',
    icon: 'bed',
    nota: 'Permanência no leito, não tempo até alta médica',
  },
  'KPI-07B': {
    label: 'Alta médica → saída do leito',
    icon: 'bed',
    metaHoras: 4,
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

/** Valores reais dos filtros, vindos do backend (GET /api/v1/dimensoes). */
export interface DimensoesResponse {
  grupos: string[]
  unidades: string[]
  especialidades: string[]
}
