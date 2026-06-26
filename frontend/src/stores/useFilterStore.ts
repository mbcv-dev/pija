import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GroupBy } from '@/types/api.types'

/**
 * useFilterStore — Filtros globais da plataforma PIJA.
 * Todos os stores de dados observam `activeFilters` e re-buscam automaticamente.
 */
export const useFilterStore = defineStore('filter', () => {
  // ── Estado ──────────────────────────────────────────────────
  const unidade      = ref<string | null>(null)
  const grupo        = ref<string | null>(null)
  const especialidade = ref<string | null>(null)
  const dataInicio   = ref<string | null>(null)
  const dataFim      = ref<string | null>(null)
  const groupBy      = ref<GroupBy>('unidade')

  // ── Computed ─────────────────────────────────────────────────

  /** Objeto de filtros prontos para enviar à API */
  const activeFilters = computed(() => ({
    grupo:        grupo.value        ?? undefined,
    unidade:      unidade.value      ?? undefined,
    especialidade: especialidade.value ?? undefined,
    data_inicio:  dataInicio.value   ?? undefined,
    data_fim:     dataFim.value      ?? undefined,
    group_by:     groupBy.value,
  }))

  /** Contagem de filtros ativos (excluindo group_by) */
  const activeCount = computed(() => {
    let count = 0
    if (grupo.value)        count++
    if (unidade.value)      count++
    if (especialidade.value) count++
    if (dataInicio.value)   count++
    if (dataFim.value)      count++
    return count
  })

  // ── Actions ───────────────────────────────────────────────────

  /** Toggle: clicar na unidade ativa a deseleciona (volta para "Todas") */
  function setUnidade(u: string | null): void {
    unidade.value = unidade.value === u ? null : u
  }

  function setGrupo(g: string | null): void {
    grupo.value = grupo.value === g ? null : g
  }

  function setEspecialidade(e: string | null): void {
    especialidade.value = e
  }

  function setDataInicio(d: string | null): void {
    dataInicio.value = d
  }

  function setDataFim(d: string | null): void {
    dataFim.value = d
  }

  function setGroupBy(g: GroupBy): void {
    groupBy.value = g
  }

  function reset(): void {
    unidade.value       = null
    grupo.value         = null
    especialidade.value = null
    dataInicio.value    = null
    dataFim.value       = null
    // groupBy mantém a preferência do usuário
  }

  return {
    unidade,
    grupo,
    especialidade,
    dataInicio,
    dataFim,
    groupBy,
    activeFilters,
    activeCount,
    setUnidade,
    setGrupo,
    setEspecialidade,
    setDataInicio,
    setDataFim,
    setGroupBy,
    reset,
  }
})
