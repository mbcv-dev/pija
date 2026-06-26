import type { EventosParams, EventosResponse, EventoItem, TipoEntidade } from '@/types/api.types'
import { UNIDADES, ESPECIALIDADES } from '@/types/api.types'

// ── Pool de dados para geração ────────────────────────────────

const TIPOS_ENTIDADE: TipoEntidade[] = [
  'CONSULTA', 'EXAME', 'INTERNACAO', 'PRONTUARIO', 'CIRURGIA', 'PROCEDIMENTO', 'ALTA',
]

const TIPO_EVENTO_MAP: Record<TipoEntidade, string[]> = {
  CONSULTA:    ['Consulta de retorno', 'Consulta inicial', 'Consulta de urgência'],
  EXAME:       ['Exame laboratorial', 'Exame de imagem', 'Biópsia', 'Eletrocardiograma'],
  INTERNACAO:  ['Internação eletiva', 'Internação de urgência', 'Internação cirúrgica'],
  PRONTUARIO:  ['Abertura de prontuário', 'Atualização de prontuário'],
  CIRURGIA:    ['Cirurgia eletiva', 'Cirurgia de emergência', 'Cirurgia laparoscópica'],
  PROCEDIMENTO:['Procedimento ambulatorial', 'Curativos', 'Coleta de material'],
  ALTA:        ['Alta médica', 'Alta a pedido', 'Alta por transferência'],
}

const SITUACOES: Record<TipoEntidade, string[]> = {
  CONSULTA:    ['PACIENTE ATENDIDO', 'PACIENTE FALTOSO', 'CANCELADO'],
  EXAME:       ['REALIZADO', 'PENDENTE', 'CANCELADO'],
  INTERNACAO:  ['INTERNADO', 'ALTA DADA', 'TRANSFERIDO'],
  PRONTUARIO:  ['ATIVO', 'INATIVO'],
  CIRURGIA:    ['REALIZADA', 'CANCELADA', 'SUSPENSA'],
  PROCEDIMENTO:['REALIZADO', 'PENDENTE'],
  ALTA:        ['CONCLUÍDA', 'REGISTRADA'],
}

// ── Gerador determinístico de eventos ─────────────────────────

function padId(n: number, prefix: string): string {
  return `${prefix}-${String(n).padStart(6, '0')}`
}

function gerarTimestamp(seed: number): string {
  // Datas entre 2025-01-01 e 2026-06-30
  const base = new Date('2025-01-01').getTime()
  const range = new Date('2026-06-30').getTime() - base
  const ms = base + ((seed * 7919) % range)
  return new Date(ms).toISOString().replace('.000Z', '')
}

function buildEvento(index: number, forceUnidade?: string, forceTipo?: TipoEntidade): EventoItem {
  const tipo = forceTipo ?? TIPOS_ENTIDADE[index % TIPOS_ENTIDADE.length]
  const unidade = forceUnidade ?? UNIDADES[index % UNIDADES.length]
  const especialidade = ESPECIALIDADES[index % ESPECIALIDADES.length]

  const tipoEventos = TIPO_EVENTO_MAP[tipo]
  const situacoes   = SITUACOES[tipo]

  return {
    evento_id:           padId(index + 1, tipo.charAt(0)),
    paciente_id:         String(100000 + (index * 17) % 900000),
    tipo_entidade:       tipo,
    entidade_id:         String(200000 + index),
    timestamp_principal: gerarTimestamp(index),
    unidade,
    especialidade,
    tipo_evento:         tipoEventos[index % tipoEventos.length],
    situacao:            situacoes[index % situacoes.length],
  }
}

// ── Pool total de 10.000 eventos pré-gerados ──────────────────

const TOTAL_POOL = 10_000
const ALL_EVENTOS: EventoItem[] = Array.from({ length: TOTAL_POOL }, (_, i) => buildEvento(i))

// ── Função principal do mock ───────────────────────────────────

export function mockEventos(params: EventosParams): EventosResponse {
  const limit  = Math.min(params.limit  ?? 50, 500)
  const offset = params.offset ?? 0

  let filtered = ALL_EVENTOS

  // Filtrar por tipo_entidade
  if (params.tipo_entidade) {
    filtered = filtered.filter((e) => e.tipo_entidade === params.tipo_entidade)
  }

  // Filtrar por unidade
  if (params.unidade) {
    filtered = filtered.filter((e) => e.unidade === params.unidade)
  }

  // Filtrar por especialidade
  if (params.especialidade) {
    filtered = filtered.filter((e) => e.especialidade === params.especialidade)
  }

  // Filtrar por data_inicio
  if (params.data_inicio) {
    const inicio = new Date(params.data_inicio).getTime()
    filtered = filtered.filter((e) => new Date(e.timestamp_principal).getTime() >= inicio)
  }

  // Filtrar por data_fim
  if (params.data_fim) {
    const fim = new Date(params.data_fim).getTime()
    filtered = filtered.filter((e) => new Date(e.timestamp_principal).getTime() <= fim)
  }

  const total = filtered.length
  const items = filtered.slice(offset, offset + limit)

  return { items, total, limit, offset }
}
