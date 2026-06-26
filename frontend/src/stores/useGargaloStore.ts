import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useFilterStore } from './useFilterStore'
import { getGargalos } from '@/services/api'
import type { GargaloItem, KpiCode } from '@/types/api.types'

/**
 * useGargaloStore — Estado do ranking de gargalos.
 * Re-busca automaticamente quando os filtros globais mudam.
 */
export const useGargaloStore = defineStore('gargalo', () => {
  // ── Estado ──────────────────────────────────────────────────
  const items   = ref<GargaloItem[]>([])
  const loading = ref(false)
  const error   = ref<string | null>(null)
  const limit   = ref(10)
  const metricas = ref<KpiCode[]>(['KPI-03', 'KPI-05', 'KPI-06', 'KPI-07'])

  // ── Actions ───────────────────────────────────────────────────

  async function fetchGargalos(): Promise<void> {
    const filterStore = useFilterStore()
    loading.value = true
    error.value   = null

    try {
      const response = await getGargalos({
        ...filterStore.activeFilters,
        kpi_codes: metricas.value,
        limit: limit.value,
      })
      items.value = response.items
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erro ao carregar gargalos'
      items.value = []
    } finally {
      loading.value = false
    }
  }

  function setLimit(n: number): void {
    limit.value = n
    void fetchGargalos()
  }

  function toggleMetrica(code: KpiCode): void {
    metricas.value = metricas.value.includes(code)
      ? metricas.value.filter((c) => c !== code)
      : [...metricas.value, code]
    void fetchGargalos()
  }

  function initWatcher(): void {
    const filterStore = useFilterStore()
    watch(
      () => filterStore.activeFilters,
      () => { void fetchGargalos() },
      { deep: true },
    )
  }

  return { items, loading, error, limit, metricas, fetchGargalos, setLimit, toggleMetrica, initWatcher }
})
