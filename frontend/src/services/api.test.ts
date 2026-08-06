import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * `api.ts` monta o client no topo do modulo: `axios.create()` e, em seguida,
 * `client.interceptors.request.use()` e `client.interceptors.response.use()`.
 * O dublê precisa oferecer os tres, senao o import estoura antes de o teste
 * chegar no parse — que e justamente o que queremos exercitar.
 */
vi.mock('axios', () => {
  const get = vi.fn()
  const client = {
    get,
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  }
  return {
    default: { create: vi.fn(() => client), isAxiosError: vi.fn(() => false) },
    __get: get,
  }
})

const bucketsOk = [
  { de: 0, ate: 10, n: 90 },
  { de: 10, ate: null, n: 10 },
]
const dist = (codigo: string) => ({
  codigo,
  unidade_tempo: 'dias',
  p50: 1,
  p95: 10,
  teto: 10,
  n_total: 100,
  buckets: bucketsOk,
})

/**
 * Carrega o modulo do zero e devolve tambem o `get` do dublê e o `USE_MOCK`
 * efetivo. O `USE_MOCK` volta junto de proposito: `.env.local` define
 * `VITE_USE_MOCK=true` e o Vitest carrega esse arquivo, entao sem o
 * `stubEnv` do beforeEach os testes passariam pelo mock e nunca tocariam o
 * parse — verdes e vazios.
 */
async function carregarApi() {
  const axiosMock = (await import('axios')) as unknown as { __get: ReturnType<typeof vi.fn> }
  const { getDistribuicoes, USE_MOCK } = await import('./api')
  return { get: axiosMock.__get, getDistribuicoes, USE_MOCK }
}

describe('getDistribuicoes — degradacao por KPI', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_USE_MOCK', 'false')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('descarta so a entrada invalida e mantem as validas', async () => {
    const { get, getDistribuicoes, USE_MOCK } = await carregarApi()
    get.mockResolvedValue({
      data: { distribuicoes: [dist('KPI-01'), dist('KPI-99'), dist('KPI-05')] },
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const r = await getDistribuicoes({})

    // Guarda contra teste vazio: se USE_MOCK fosse true nada acima teria valido.
    expect(USE_MOCK).toBe(false)
    expect(get).toHaveBeenCalledWith('/kpis/distribuicoes', { params: {} })

    expect(r.distribuicoes.map((d) => d.codigo)).toEqual(['KPI-01', 'KPI-05'])
    expect(warn).toHaveBeenCalled()
    expect(String(warn.mock.calls[0])).toContain('KPI-99')
  })

  it('envelope malformado continua sendo erro', async () => {
    const { get, getDistribuicoes } = await carregarApi()
    get.mockResolvedValue({ data: { nada: [] } })

    await expect(getDistribuicoes({})).rejects.toThrow()
  })
})
