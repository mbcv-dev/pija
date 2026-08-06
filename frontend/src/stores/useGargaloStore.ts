import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useFilterStore } from './useFilterStore'
import { getGargalos } from '@/services/api'
import { METRIC_OPTIONS } from '@/lib/gargalos'
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
  // Cópia defensiva: nunca referenciar METRIC_OPTIONS diretamente, ou uma mutação
  // aqui corromperia a fonte única compartilhada com GargaloList.
  const metricas = ref<KpiCode[]>([...METRIC_OPTIONS])

  /**
   * Cancela a requisição da busca anterior: sem isso, duas mudanças de filtro
   * seguidas custam duas varreduras completas no backend e só a última é usada.
   */
  let abortAtual: AbortController | null = null

  // ── Actions ───────────────────────────────────────────────────

  async function fetchGargalos(): Promise<void> {
    const filterStore = useFilterStore()
    abortAtual?.abort()
    const controller = new AbortController()
    abortAtual = controller
    loading.value = true
    error.value   = null

    try {
      const response = await getGargalos({
        ...filterStore.activeFilters,
        kpi_codes: metricas.value,
        limit: limit.value,
      }, { signal: controller.signal })
      items.value = response.items
    } catch (e) {
      // Cancelamento nosso não é falha: acontece toda vez que o filtro muda
      // antes da resposta chegar. Sem este guarda, cada mudança rápida de
      // filtro pintaria um ErrorState na tela.
      if (!controller.signal.aborted) {
        error.value = e instanceof Error ? e.message : 'Erro ao carregar gargalos'
        items.value = []
      }
    } finally {
      // Idem: a busca cancelada não pode apagar o skeleton — quem está no ar é
      // a mais recente, e ela ainda não respondeu.
      if (!controller.signal.aborted) loading.value = false
    }
  }

  function setLimit(n: number): void {
    limit.value = n
    void fetchGargalos()
  }

  function toggleMetrica(code: KpiCode): void {
    const has = metricas.value.includes(code)
    if (has && metricas.value.length === 1) return // mantém ao menos uma métrica
    metricas.value = has
      ? metricas.value.filter((c) => c !== code)
      : [...metricas.value, code]
    void fetchGargalos()
  }

  /**
   * Substitui a seleção de métricas (usado pelo deep-link ?kpi= do dashboard).
   *
   * NÃO dispara fetchGargalos — ao contrário de setLimit/toggleMetrica. O chamador
   * busca em seguida (GargaloList.onMounted chama setMetricas e depois fetchGargalos).
   */
  function setMetricas(codes: KpiCode[]): void {
    if (codes.length === 0) return // mantém ao menos uma métrica
    metricas.value = [...codes]
  }

  function initWatcher(): void {
    const filterStore = useFilterStore()
    watch(
      () => filterStore.activeFilters,
      () => { void fetchGargalos() },
      { deep: true },
    )
  }

  return { items, loading, error, limit, metricas, fetchGargalos, setLimit, toggleMetrica, setMetricas, initWatcher }
})
