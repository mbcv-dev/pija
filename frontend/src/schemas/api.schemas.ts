import { z } from 'zod'

// ── Schemas compartilhados ─────────────────────────────────────

const KpiCodeSchema = z.enum(['KPI-01', 'KPI-03', 'KPI-05', 'KPI-06', 'KPI-07'])
const GroupBySchema = z.enum(['unidade', 'especialidade'])

// ── KPIs ──────────────────────────────────────────────────────

export const BreakdownItemSchema = z.object({
  dimensao: z.string(),
  media: z.number().nonnegative(),
  n: z.number().int().nonnegative(),
})

export const KpiItemSchema = z.object({
  codigo: KpiCodeSchema,
  descricao: z.string(),
  unidade_tempo: z.literal('dias'),
  media_global: z.number().nullable(),
  n_global: z.number().int().nonnegative(),
  breakdown: z.array(BreakdownItemSchema),
})

export const KpiResponseSchema = z.object({
  kpis: z.array(KpiItemSchema),
})

// ── Gargalos ──────────────────────────────────────────────────

export const GargaloItemSchema = z.object({
  dimensao_tipo: GroupBySchema,
  dimensao: z.string(),
  transicao: KpiCodeSchema,
  media: z.number().nonnegative(),
  n: z.number().int().nonnegative(),
})

export const GargalosResponseSchema = z.object({
  items: z.array(GargaloItemSchema),
})

// ── Eventos ───────────────────────────────────────────────────

export const TipoEntidadeSchema = z.enum([
  'CONSULTA',
  'EXAME',
  'INTERNACAO',
  'PRONTUARIO',
  'CIRURGIA',
  'PROCEDIMENTO',
  'ALTA',
])

export const EventoItemSchema = z.object({
  evento_id: z.string(),
  paciente_id: z.string(),
  tipo_entidade: TipoEntidadeSchema,
  entidade_id: z.string(),
  timestamp_principal: z.string(),
  unidade: z.string(),
  especialidade: z.string(),
  tipo_evento: z.string(),
  situacao: z.string(),
})

export const EventosResponseSchema = z.object({
  items: z.array(EventoItemSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
})

// ── Tipos inferidos dos schemas ────────────────────────────────

export type KpiItemValidated = z.infer<typeof KpiItemSchema>
export type KpiResponseValidated = z.infer<typeof KpiResponseSchema>
export type GargaloItemValidated = z.infer<typeof GargaloItemSchema>
export type GargalosResponseValidated = z.infer<typeof GargalosResponseSchema>
export type EventoItemValidated = z.infer<typeof EventoItemSchema>
export type EventosResponseValidated = z.infer<typeof EventosResponseSchema>
