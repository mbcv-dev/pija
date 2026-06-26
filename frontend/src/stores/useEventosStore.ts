import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useFilterStore } from './useFilterStore'
import { getEventos } from '@/services/api'
import type { EventoItem, TipoEntidade } from '@/types/api.types'

/**
 * useEventosStore — Estado da tabela de eventos paginada.
 * Mantém estado local de paginação e filtros específicos de eventos.
 */
export const useEventosStore = defineStore('eventos', () => {
  // ── Estado ──────────────────────────────────────────────────
  const items         = ref<EventoItem[]>([])
  const total         = ref(0)
  const loading       = ref(false)
  const error         = ref<string | null>(null)

  // Paginação
  const limit         = ref(20)
  const offset        = ref(0)

  // Filtros específicos de eventos (além dos globais)
  const tipoEntidade  = ref<TipoEntidade | null>(null)

  // ── Computed ─────────────────────────────────────────────────

  const currentPage = computed(() => Math.floor(offset.value / limit.value) + 1)
  const totalPages  = computed(() => Math.ceil(total.value / limit.value))

  const hasPrev = computed(() => offset.value > 0)
  const hasNext = computed(() => offset.value + limit.value < total.value)

  // ── Actions ───────────────────────────────────────────────────

  async function fetchEventos(): Promise<void> {
    const filterStore = useFilterStore()
    loading.value = true
    error.value   = null

    try {
      const response = await getEventos({
        ...filterStore.activeFilters,
        tipo_entidade: tipoEntidade.value ?? undefined,
        limit: limit.value,
        offset: offset.value,
      })
      items.value = response.items
      total.value = response.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erro ao carregar eventos'
      items.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  function nextPage(): void {
    if (hasNext.value) {
      offset.value += limit.value
      void fetchEventos()
    }
  }

  function prevPage(): void {
    if (hasPrev.value) {
      offset.value = Math.max(0, offset.value - limit.value)
      void fetchEventos()
    }
  }

  function goToPage(page: number): void {
    const newOffset = (page - 1) * limit.value
    if (newOffset >= 0 && newOffset < total.value) {
      offset.value = newOffset
      void fetchEventos()
    }
  }

  function setTipoEntidade(tipo: TipoEntidade | null): void {
    tipoEntidade.value = tipo
    offset.value = 0  // resetar paginação ao mudar filtro
    void fetchEventos()
  }

  function setLimit(n: number): void {
    limit.value  = n
    offset.value = 0
    void fetchEventos()
  }

  function initWatcher(): void {
    const filterStore = useFilterStore()
    watch(
      () => filterStore.activeFilters,
      () => {
        offset.value = 0  // voltar para página 1 ao mudar filtros globais
        void fetchEventos()
      },
      { deep: true },
    )
  }

  return {
    items,
    total,
    loading,
    error,
    limit,
    offset,
    tipoEntidade,
    currentPage,
    totalPages,
    hasPrev,
    hasNext,
    fetchEventos,
    nextPage,
    prevPage,
    goToPage,
    setTipoEntidade,
    setLimit,
    initWatcher,
  }
})
