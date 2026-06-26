import type { EventoItem, TipoEntidade } from '@/types/api.types'
import { UNIDADES, ESPECIALIDADES } from '@/types/api.types'

// Sequência clínica plausível de uma jornada
const SEQUENCIA: { tipo: TipoEntidade; tipo_evento: string; situacao: string; offsetDias: number }[] = [
  { tipo: 'PRONTUARIO', tipo_evento: 'Abertura de prontuário', situacao: 'ATIVO',            offsetDias: 0 },
  { tipo: 'CONSULTA',   tipo_evento: 'Consulta inicial',       situacao: 'PACIENTE ATENDIDO', offsetDias: 12 },
  { tipo: 'EXAME',      tipo_evento: 'Exame laboratorial',     situacao: 'REALIZADO',         offsetDias: 20 },
  { tipo: 'CONSULTA',   tipo_evento: 'Consulta de retorno',    situacao: 'PACIENTE ATENDIDO', offsetDias: 41 },
  { tipo: 'INTERNACAO', tipo_evento: 'Internação eletiva',     situacao: 'INTERNADO',         offsetDias: 55 },
  { tipo: 'CIRURGIA',   tipo_evento: 'Cirurgia eletiva',       situacao: 'REALIZADA',         offsetDias: 57 },
  { tipo: 'ALTA',       tipo_evento: 'Alta médica',            situacao: 'CONCLUÍDA',         offsetDias: 60 },
]

/** Hash determinístico simples de uma string para semear a jornada. */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2147483647
  return h
}

function isoFromBase(baseMs: number, offsetDias: number): string {
  return new Date(baseMs + offsetDias * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** Eventos cronológicos de um paciente (mock determinístico por prontuário). */
export function mockJornada(pacienteId: string): EventoItem[] {
  const h = hash(pacienteId)
  const unidade = UNIDADES[h % UNIDADES.length]
  const especialidade = ESPECIALIDADES[h % ESPECIALIDADES.length]
  const baseMs = new Date('2026-01-05T08:00:00').getTime() + (h % 30) * 86_400_000

  return SEQUENCIA.map((s, i) => ({
    evento_id: `${s.tipo.charAt(0)}-${pacienteId}-${i}`,
    paciente_id: pacienteId,
    tipo_entidade: s.tipo,
    entidade_id: `${h + i}`,
    timestamp_principal: isoFromBase(baseMs, s.offsetDias),
    unidade,
    especialidade,
    tipo_evento: s.tipo_evento,
    situacao: s.situacao,
  }))
}
