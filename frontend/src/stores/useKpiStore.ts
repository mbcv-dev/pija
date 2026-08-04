import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useFilterStore } from './useFilterStore'
import { getDistribuicoes, getKpis } from '@/services/api'
import type { KpiCode, KpiDistribuicao, KpiItem } from '@/types/api.types'

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

  /** Histograma de tempos por KPI, indexado pelo código. Vazio = sem gráfico. */
  const distribuicoes = ref<Map<KpiCode, KpiDistribuicao>>(new Map())
  /** Loading PRÓPRIO do histograma — nunca reaproveitar `loading` (ver nota acima). */
  const loadingDist   = ref(false)
  /**
   * Sequência da última busca disparada. Filtros mudam sem debounce, então duas
   * buscas podem estar no ar; só a mais recente pode escrever no estado, senão
   * uma resposta lenta de um filtro antigo pintaria um histograma que não bate
   * com os cards.
   */
  let distReqId = 0

  // ── Actions ───────────────────────────────────────────────────

  /**
   * Distribuições são ENHANCEMENT: buscadas em paralelo, nunca bloqueiam nem
   * derrubam os cards. Falha aqui = histograma some em silêncio (sem ErrorState).
   * Atenção: NÃO mexer em `loading` — o AreaNav observa esse campo (scroll-spy).
   */
  async function fetchDistribuicoes(): Promise<void> {
    const filterStore = useFilterStore()
    const reqId = ++distReqId
    loadingDist.value = true

    try {
      // Mesmos filtros dos KPIs; `group_by` não se aplica (sem breakdown aqui).
      const { group_by: _semBreakdown, ...params } = filterStore.activeFilters
      const response = await getDistribuicoes(params)
      if (reqId !== distReqId) return  // obsoleta: já há busca mais nova no ar
      distribuicoes.value = new Map(response.distribuicoes.map((d) => [d.codigo, d]))
    } catch {
      // Silencioso de propósito (enhancement): sem `error`, sem ErrorState.
      if (reqId === distReqId) distribuicoes.value = new Map()
    } finally {
      if (reqId === distReqId) loadingDist.value = false
    }
  }

  async function fetchKpis(): Promise<void> {
    // Fire-and-forget: os cards não esperam (nem quebram por causa) do histograma.
    void fetchDistribuicoes()

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

  return {
    kpis, loading, error,
    distribuicoes, loadingDist,
    fetchKpis, fetchDistribuicoes, initWatcher,
  }
})
