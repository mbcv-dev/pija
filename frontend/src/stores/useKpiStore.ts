import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useFilterStore } from './useFilterStore'
import { getKpis } from '@/services/api'
import type { KpiItem } from '@/types/api.types'

/**
 * useKpiStore — Estado dos 5 KPIs de tempo médio.
 * Re-busca automaticamente quando os filtros globais mudam.
 */
export const useKpiStore = defineStore('kpi', () => {
  // ── Estado ──────────────────────────────────────────────────
  const kpis    = ref<KpiItem[]>([])
  // AreaNav.vue observa a transição true -> false deste campo pra ressincronizar
  // o scroll-spy (é quando o KpiGrid sai do skeleton e monta as <section>). Um
  // refactor que separe o estado do fetch ou pule o loading num cache-hit deve
  // atualizar esse watch também.
  const loading = ref(false)
  const error   = ref<string | null>(null)

  // ── Actions ───────────────────────────────────────────────────

  async function fetchKpis(): Promise<void> {
    const filterStore = useFilterStore()
    loading.value = true
    error.value   = null

    try {
      const response = await getKpis(filterStore.activeFilters)
      kpis.value = response.kpis
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erro ao carregar KPIs'
      kpis.value  = []
    } finally {
      loading.value = false
    }
  }

  // ── Watcher — re-busca ao mudar filtros ──────────────────────
  // Executado após o store ser usado pela primeira vez (lazy)

  function initWatcher(): void {
    const filterStore = useFilterStore()
    watch(
      () => filterStore.activeFilters,
      () => { void fetchKpis() },
      { deep: true },
    )
  }

  return { kpis, loading, error, fetchKpis, initWatcher }
})
