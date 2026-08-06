import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({
  // Assinatura com o 2º argumento: e por ele que o store passa o AbortSignal.
  getDimensoes: vi.fn(),
}))

import { useDimensoesStore } from './useDimensoesStore'
import { getDimensoes } from '@/services/api'
import type { DimensoesResponse, UnidadeDim } from '@/types/api.types'

const unidade = (valor: string): UnidadeDim => ({ valor, grupo: 'Procedimental' })

const resposta = (marcador: string): DimensoesResponse => ({
  grupos: ['Procedimental'],
  unidades: [unidade(marcador)],
  especialidades: [marcador],
})

/** Deixa a fila de microtasks drenar. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

/**
 * Imita o pior caso do axios: a promise JA resolveu quando o abort chega, entao
 * `abort()` nao impede a continuacao. E exatamente o caso que a guarda de
 * identidade existe para cobrir e que a guarda de `signal.aborted` nao cobre.
 */
const resolveIgnorandoSignal = (marcador: string, atrasoMs: number) =>
  new Promise<DimensoesResponse>((resolve) => setTimeout(() => resolve(resposta(marcador)), atrasoMs))

describe('useDimensoesStore — cascata nao deixa resposta obsoleta vencer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  /** Popula as listas "cheias", que sao o estado restaurado ao limpar o filtro. */
  async function comListasCheias() {
    vi.mocked(getDimensoes).mockResolvedValueOnce(resposta('TUDO'))
    const store = useDimensoesStore()
    await store.load()
    return store
  }

  it('scopeByGrupo: a resposta lenta do filtro antigo nao sobrescreve a do novo', async () => {
    const store = await comListasCheias()

    vi.mocked(getDimensoes)
      .mockImplementationOnce(() => resolveIgnorandoSignal('ANTIGO', 40))
      .mockImplementationOnce(() => resolveIgnorandoSignal('NOVO', 5))

    void store.scopeByGrupo(['A'])
    void store.scopeByGrupo(['B'])

    await new Promise((r) => setTimeout(r, 80))

    expect(store.especialidades).toEqual(['NOVO'])
    expect(store.unidadesValores).toEqual(['NOVO'])
  })

  it('scopeByGrupo: limpar o filtro restaura tudo e a resposta em voo nao desfaz isso', async () => {
    // O caso que o `abort()` sozinho nao resolve: ao limpar, a funcao retorna
    // cedo sem criar controller novo. Se o controller abortado continuasse sendo
    // o "atual", a resposta ja resolvida sobrescreveria as listas cheias.
    const store = await comListasCheias()

    vi.mocked(getDimensoes).mockImplementationOnce(() => resolveIgnorandoSignal('ESCOPADO', 30))

    void store.scopeByGrupo(['A'])
    await flush()
    void store.scopeByGrupo([])

    await new Promise((r) => setTimeout(r, 70))

    expect(store.especialidades).toEqual(['TUDO'])
    expect(store.unidadesValores).toEqual(['TUDO'])
  })

  it('scopeEspecialidades: idem no nivel 2 da cascata', async () => {
    const store = await comListasCheias()

    vi.mocked(getDimensoes)
      .mockImplementationOnce(() => resolveIgnorandoSignal('ANTIGO', 40))
      .mockImplementationOnce(() => resolveIgnorandoSignal('NOVO', 5))

    void store.scopeEspecialidades(['U1'])
    void store.scopeEspecialidades(['U2'])

    await new Promise((r) => setTimeout(r, 80))

    expect(store.especialidades).toEqual(['NOVO'])
  })

  it('falha de verdade continua propagando', async () => {
    // A guarda engole cancelamento, nao erro. Se engolisse os dois, uma queda do
    // backend viraria silencio e o filtro ficaria com a lista errada sem aviso.
    const store = await comListasCheias()
    vi.mocked(getDimensoes).mockRejectedValueOnce(new Error('backend caiu'))

    await expect(store.scopeByGrupo(['A'])).rejects.toThrow('backend caiu')
  })
})
