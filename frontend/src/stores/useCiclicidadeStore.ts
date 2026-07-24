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

  async function fetch(): Promise<void> {
    const filterStore = useFilterStore()
    loading.value = true
    error.value = null
    try {
      const { group_by: _gb, ...coorte } = filterStore.activeFilters
      const resp = await getCiclicidade(coorte)
      nos.value = resp.nos
      transicoes.value = resp.transicoes
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erro ao carregar ciclicidade'
      nos.value = []
      transicoes.value = []
    } finally {
      loading.value = false
    }
  }

  function initWatcher(): void {
    const filterStore = useFilterStore()
    watch(() => filterStore.activeFilters, () => { void fetch() }, { deep: true })
  }

  return { nos, transicoes, loading, error, fetch, initWatcher }
})
