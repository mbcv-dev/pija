import type { KpiCode } from '@/types/api.types'

/**
 * Áreas da jornada do paciente — fonte única do agrupamento do Dashboard.
 *
 * Ordem = ordem canônica da jornada (mesma do grafo de ciclicidade:
 * consulta antes de exame), não a ordem de citação do doc de feedback.
 * KPI-06 mora em Internação: a âncora do indicador é a internação.
 * KPI-07B não aparece aqui — é submétrica renderizada dentro do card do KPI-07.
 */
export interface AreaJornada {
  id: string
  label: string
  /** Nome de ícone existente em Icon.vue. */
  icon: string
  descricao: string
  /** KPIs exibidos na seção, em ordem. Vazio = área sem indicadores ainda. */
  kpis: KpiCode[]
  /** KPI pré-selecionado no cross-link para /gargalos. Ausente = sem link. */
  gargalosKpi?: KpiCode
}

export const AREAS_JORNADA: AreaJornada[] = [
  {
    id: 'entrada', label: 'Entrada', icon: 'prontuario',
    descricao: 'Do prontuário ao primeiro contato assistencial',
    kpis: ['KPI-01'],
  },
  {
    id: 'consultas', label: 'Consultas', icon: 'consulta',
    descricao: 'Agendamento e realização de consultas',
    kpis: ['KPI-03'], gargalosKpi: 'KPI-03',
  },
  {
    id: 'exames', label: 'Exames', icon: 'exame',
    descricao: 'Solicitação e realização de exames',
    kpis: ['KPI-05'], gargalosKpi: 'KPI-05',
  },
  {
    id: 'internacao', label: 'Internação', icon: 'internacao',
    descricao: 'Da chegada ao leito até a saída',
    kpis: ['KPI-06', 'KPI-07'], gargalosKpi: 'KPI-07',
  },
  {
    id: 'cirurgias', label: 'Cirurgias', icon: 'cirurgia',
    descricao: 'Procedimentos cirúrgicos — indicadores em desenvolvimento',
    kpis: [],
  },
]
