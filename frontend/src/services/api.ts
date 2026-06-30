import axios from 'axios'
import type { KpiParams, KpiResponse, GargaloParams, GargalosResponse, EventosParams, EventosResponse, EventoItem, DimensoesResponse } from '@/types/api.types'
import { GRUPOS, UNIDADES, ESPECIALIDADES } from '@/types/api.types'
import { KpiResponseSchema, GargalosResponseSchema, EventosResponseSchema, DimensoesResponseSchema } from '@/schemas/api.schemas'
import { mockKpis } from '@/mocks/kpis.mock'
import { mockGargalos } from '@/mocks/gargalos.mock'
import { mockEventos } from '@/mocks/eventos.mock'
import { mockJornada } from '@/mocks/jornada.mock'

// ── Configuração ──────────────────────────────────────────────

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://127.0.0.1:8000'

/**
 * Toggle mock/real:
 * - VITE_USE_MOCK=true  → retorna dados mockados dinâmicos
 * - VITE_USE_MOCK=false → faz chamadas reais ao backend FastAPI
 * Mudar essa variável NÃO requer alterar nenhum componente.
 */
export const USE_MOCK = (import.meta.env.VITE_USE_MOCK as string) === 'true'

// ── Cliente Axios centralizado ────────────────────────────────

const client = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  // 60s: a mediana dos KPIs sem filtro varre toda a base (~2.26M eventos) sem
  // índice — pode levar dezenas de segundos no cold-start. Filtros reduzem muito.
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
  // FastAPI espera arrays como chave repetida (kpi_codes=KPI-03&kpi_codes=KPI-05),
  // não no formato bracket padrão do axios (kpi_codes[]=...). Null/undefined são omitidos.
  paramsSerializer: {
    serialize: (params: Record<string, unknown>) => {
      const sp = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue
        if (Array.isArray(value)) {
          value.forEach((v) => sp.append(key, String(v)))
        } else {
          sp.append(key, String(value))
        }
      }
      return sp.toString()
    },
  },
})

// ── Interceptor de request — token Auth (Fase 3) ──────────────
// Estrutura pronta; implementação pendente até Fase 3 (login).

client.interceptors.request.use((config) => {
  const token: string | null = null // TODO Fase 3: pegar do useUserStore
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Interceptor de response — refresh silencioso (Fase 3) ─────

client.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // TODO Fase 3: tentar refresh token, redirecionar para /login
    }
    return Promise.reject(error)
  },
)

export default client

// ── Delay artificial para mocks (simula latência de rede) ─────

function delay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Serviços de API ───────────────────────────────────────────

/**
 * GET /api/v1/kpis/tempos-medios
 * Retorna os 5 KPIs de tempo médio com breakdown por dimensão.
 */
export async function getKpis(params: KpiParams): Promise<KpiResponse> {
  if (USE_MOCK) {
    await delay(500)
    return mockKpis(params)
  }
  const { data } = await client.get<KpiResponse>('/kpis/tempos-medios', { params })
  return KpiResponseSchema.parse(data)
}

/**
 * GET /api/v1/gargalos
 * Retorna o ranking dos piores tempos médios, do pior para o melhor.
 */
export async function getGargalos(params: GargaloParams): Promise<GargalosResponse> {
  if (USE_MOCK) {
    await delay(400)
    return mockGargalos(params)
  }
  const { data } = await client.get<GargalosResponse>('/gargalos', { params })
  return GargalosResponseSchema.parse(data)
}

/**
 * GET /api/v1/eventos
 * Retorna lista paginada de eventos da jornada do paciente.
 */
export async function getEventos(params: EventosParams): Promise<EventosResponse> {
  if (USE_MOCK) {
    await delay(350)
    return mockEventos(params)
  }
  const { data } = await client.get<EventosResponse>('/eventos', { params })
  return EventosResponseSchema.parse(data)
}

/**
 * GET /api/v1/dimensoes
 * Valores reais para popular os filtros (grupo, unidade, especialidade).
 * Em modo mock, devolve as listas estáticas de exemplo.
 */
export async function getDimensoes(unidade?: string): Promise<DimensoesResponse> {
  if (USE_MOCK) {
    await delay(200)
    return { grupos: [...GRUPOS], unidades: [...UNIDADES], especialidades: [...ESPECIALIDADES] }
  }
  const { data } = await client.get<DimensoesResponse>('/dimensoes', {
    params: unidade ? { unidade } : undefined,
  })
  return DimensoesResponseSchema.parse(data)
}

/**
 * Eventos cronológicos de UM paciente (tela Jornada).
 * MOCK nesta fase. Backend real (Fase 4/6): adicionar filtro `paciente_id`
 * ao GET /eventos (ou endpoint /jornada/{paciente_id}). Ver
 * docs/superpowers/specs/2026-06-26-fase-7-frontend-redesign-design.md §11.
 */
export async function getJornada(pacienteId: string): Promise<EventoItem[]> {
  if (USE_MOCK) {
    await delay(450)
    return mockJornada(pacienteId)
  }
  const { data } = await client.get<EventosResponse>('/eventos', {
    params: { paciente_id: pacienteId, limit: 500 },
  })
  return EventosResponseSchema.parse(data).items
}
