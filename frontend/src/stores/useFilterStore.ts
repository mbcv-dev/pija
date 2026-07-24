import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GroupBy } from '@/types/api.types'

/**
 * useFilterStore — Filtros globais da plataforma PIJA.
 * Grupo/unidade/especialidade são MULTISELEÇÃO: lista vazia = "Todas".
 * Todos os stores de dados observam `activeFilters` e re-buscam automaticamente.
 */
export const useFilterStore = defineStore('filter', () => {
  // ── Estado ──────────────────────────────────────────────────
  const unidade       = ref<string[]>([])
  const grupo         = ref<string[]>([])
  const especialidade = ref<string[]>([])
  const dataInicio    = ref<string | null>(null)
  const dataFim       = ref<string | null>(null)
  const groupBy       = ref<GroupBy>('unidade')

  // Lista vazia é omitida da query (undefined) — o backend trata ausência como "sem filtro".
  const orUndefined = (l: string[]) => (l.length > 0 ? l : undefined)

  const activeFilters = computed(() => ({
    grupo:         orUndefined(grupo.value),
    unidade:       orUndefined(unidade.value),
    especialidade: orUndefined(especialidade.value),
    data_inicio:   dataInicio.value ?? undefined,
    data_fim:      dataFim.value ?? undefined,
    group_by:      groupBy.value,
  }))

  const activeCount = computed(() => {
    let count = 0
    if (grupo.value.length)         count++
    if (unidade.value.length)       count++
    if (especialidade.value.length) count++
    if (dataInicio.value)           count++
    if (dataFim.value)              count++
    return count
  })

  // ── Actions ───────────────────────────────────────────────────
  function toggle(lista: typeof unidade, valor: string): void {
    lista.value = lista.value.includes(valor)
      ? lista.value.filter((v) => v !== valor)
      : [...lista.value, valor]
  }

  const toggleUnidade       = (u: string) => toggle(unidade, u)
  const toggleGrupo         = (g: string) => toggle(grupo, g)
  const toggleEspecialidade = (e: string) => toggle(especialidade, e)

  const setUnidades       = (l: string[]) => { unidade.value = l }
  const setGrupos         = (l: string[]) => { grupo.value = l }
  const setEspecialidades = (l: string[]) => { especialidade.value = l }

  function setDataInicio(d: string | null): void { dataInicio.value = d }
  function setDataFim(d: string | null): void { dataFim.value = d }
  function setGroupBy(g: GroupBy): void { groupBy.value = g }

  function reset(): void {
    unidade.value = []
    grupo.value = []
    especialidade.value = []
    dataInicio.value = null
    dataFim.value = null
    // groupBy mantém a preferência do usuário
  }

  return {
    unidade, grupo, especialidade, dataInicio, dataFim, groupBy,
    activeFilters, activeCount,
    toggleUnidade, toggleGrupo, toggleEspecialidade,
    setUnidades, setGrupos, setEspecialidades,
    setDataInicio, setDataFim, setGroupBy, reset,
  }
})
