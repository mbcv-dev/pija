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
   * Cancela a requisição da busca anterior: sem isso, duas mudanças de filtro
   * seguidas custam duas varreduras completas no backend e só a última é usada.
   */
  let abortAtual: AbortController | null = null

  async function fetch(): Promise<void> {
    const filterStore = useFilterStore()
    abortAtual?.abort()
    const controller = new AbortController()
    abortAtual = controller
    loading.value = true
    error.value = null
    try {
      const { group_by: _gb, ...coorte } = filterStore.activeFilters
      const resp = await getCiclicidade(coorte, { signal: controller.signal })
      nos.value = resp.nos
      transicoes.value = resp.transicoes
    } catch (e) {
      // Cancelamento nosso não é falha: acontece toda vez que o filtro muda
      // antes da resposta chegar. Sem este guarda, cada mudança rápida de
      // filtro pintaria um ErrorState na tela.
      if (!controller.signal.aborted) {
        error.value = e instanceof Error ? e.message : 'Erro ao carregar ciclicidade'
        nos.value = []
        transicoes.value = []
      }
    } finally {
      // Idem: a busca cancelada não pode apagar o skeleton — quem está no ar é
      // a mais recente, e ela ainda não respondeu.
      if (!controller.signal.aborted) loading.value = false
    }
  }

  function initWatcher(): void {
    const filterStore = useFilterStore()
    watch(() => filterStore.activeFilters, () => { void fetch() }, { deep: true })
  }

  return { nos, transicoes, loading, error, fetch, initWatcher }
})
