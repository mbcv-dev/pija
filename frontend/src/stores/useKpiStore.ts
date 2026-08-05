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
  /**
   * Loading PRÓPRIO do histograma — nunca reaproveitar `loading` (ver nota acima).
   *
   * NÃO É CÓDIGO MORTO, apesar de nenhum componente ler: a spec descarta
   * skeleton no histograma (ver KpiCard.vue), então nenhum vai ler mesmo. É
   * exportado de propósito como o ÚNICO observável que distingue
   * "requisição ainda no ar" de "requisição nunca disparada" — e é isso que
   * o teste do desacoplamento afirma: `fetchKpis` resolveu E a distribuição
   * continua pendente. Sem este campo o teste só conseguiria provar que
   * `fetchKpis` retornou, o que passaria igual se a busca nem tivesse
   * começado — justo a garantia que esta feature existe para dar.
   * Antes de remover: leia useKpiStore.test.ts.
   */
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
    /** Esta busca ainda é a mais recente? Se não, nada dela pode tocar o estado. */
    const isCurrent = (): boolean => reqId === distReqId
    loadingDist.value = true

    try {
      // Mesmos filtros dos KPIs; `group_by` não se aplica (sem breakdown aqui).
      const { group_by: _semBreakdown, ...params } = filterStore.activeFilters
      const response = await getDistribuicoes(params)
      if (!isCurrent()) return  // obsoleta: já há busca mais nova no ar
      distribuicoes.value = new Map(response.distribuicoes.map((d) => [d.codigo, d]))
    } catch (e) {
      // Silencioso para o USUÁRIO (enhancement: sem `error`, sem ErrorState) —
      // mas não para o dev: sem este warn, um histograma que some não deixa
      // rastro nenhum fora da aba Network.
      console.warn('[useKpiStore] falha ao buscar distribuicoes; histograma oculto', e)
      if (isCurrent()) distribuicoes.value = new Map()
    } finally {
      if (isCurrent()) loadingDist.value = false
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
    // `loadingDist` sai daqui sem consumidor em componente de propósito — é
    // observável de teste, não estado de UI. Motivo completo na declaração.
    distribuicoes, loadingDist,
    fetchKpis, fetchDistribuicoes, initWatcher,
  }
})
