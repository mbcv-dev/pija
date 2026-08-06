import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useFilterStore } from './useFilterStore'
import { getCiclicidade } from '@/services/api'
import type { NoItem, TransicaoItem } from '@/types/api.types'

/**
 * useCiclicidadeStore — fluxo agregado de transições.
 * Observa os filtros globais (semântica de coorte) e re-busca ao mudarem.
 */
export const useCiclicidadeStore = defineStore('ciclicidade', () => {
  const nos        = ref<NoItem[]>([])
  const transicoes = ref<TransicaoItem[]>([])
  const loading    = ref(false)
  const error      = ref<string | null>(null)

  /**
   * Controller da busca MAIS RECENTE. Faz dois papéis:
   *
   * 1. `abort()` na anterior — ECONOMIA: sem isso, duas mudanças de filtro
   *    seguidas custam duas varreduras completas no backend e só a última é usada.
   * 2. Identidade (`abortAtual === controller`) — CORREÇÃO: é ele que decide
   *    quem pode escrever no estado. Abortar não garante nada — a resposta pode
   *    já estar a caminho quando o abort chega, e em modo mock o signal é
   *    ignorado por completo; nos dois casos a busca velha voltaria e pintaria
   *    um fluxo que não bate com os filtros da tela.
   *
   * Não trocar por `!controller.signal.aborted`: além de não cobrir (2), essa
   * forma só não deixa o skeleton preso porque hoje todo `abort()` é seguido
   * imediatamente do `try/finally` que zera `loading` — invariante frágil.
   * Comparar identidade é seguro por construção: a requisição mais nova É o
   * `abortAtual`, então o `finally` dela sempre roda.
   */
  let abortAtual: AbortController | null = null

  async function fetch(): Promise<void> {
    const filterStore = useFilterStore()
    abortAtual?.abort()
    const controller = new AbortController()
    abortAtual = controller
    /** Esta busca ainda é a mais recente? Se não, nada dela pode tocar o estado. */
    const isCurrent = (): boolean => abortAtual === controller
    loading.value = true
    error.value = null
    try {
      const resp = await getCiclicidade(filterStore.activeFilters, { signal: controller.signal })
      if (!isCurrent()) return  // obsoleta: já há busca mais nova no ar
      nos.value = resp.nos
      transicoes.value = resp.transicoes
    } catch (e) {
      // Cancelamento nosso não é falha: acontece toda vez que o filtro muda
      // antes da resposta chegar. Sem este guarda, cada mudança rápida de
      // filtro pintaria um ErrorState na tela.
      if (isCurrent()) {
        error.value = e instanceof Error ? e.message : 'Erro ao carregar ciclicidade'
        nos.value = []
        transicoes.value = []
      }
    } finally {
      // Idem: a busca obsoleta não pode apagar o skeleton — quem está no ar é
      // a mais recente, e ela ainda não respondeu.
      if (isCurrent()) loading.value = false
    }
  }

  function initWatcher(): void {
    const filterStore = useFilterStore()
    watch(() => filterStore.activeFilters, () => { void fetch() }, { deep: true })
  }

  return { nos, transicoes, loading, error, fetch, initWatcher }
})
