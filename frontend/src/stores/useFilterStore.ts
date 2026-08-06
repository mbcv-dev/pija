import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * useFilterStore — Filtros globais da plataforma PIJA.
 * Grupo/unidade/especialidade são MULTISELEÇÃO: lista vazia = "Todas".
 * Todos os stores de dados observam `activeFilters` e re-buscam automaticamente.
 */
export const useFilterStore = defineStore('filter', () => {
  // ── Estado ──────────────────────────────────────────────────
  const unidade       = ref<string[]>([])
  const grupo         = ref<string[]>([])
  /** Valores BRUTOS de especialidade enviados à API (expansão de base+subtipo). */
  const especialidade = ref<string[]>([])
  /** Seleção de UI: bases de especialidade (trecho antes de " - " ou " ("). */
  const especialidadeBase = ref<string[]>([])
  /** Seleção de UI: subtipos, guardados como valores BRUTOS (não ambíguos). */
  const especialidadeSubtipo = ref<string[]>([])
  const dataInicio    = ref<string | null>(null)
  const dataFim       = ref<string | null>(null)

  // Lista vazia é omitida da query (undefined) — o backend trata ausência como "sem filtro".
  const orUndefined = (l: string[]) => (l.length > 0 ? l : undefined)

  const activeFilters = computed(() => ({
    grupo:         orUndefined(grupo.value),
    unidade:       orUndefined(unidade.value),
    especialidade: orUndefined(especialidade.value),
    data_inicio:   dataInicio.value ?? undefined,
    data_fim:      dataFim.value ?? undefined,
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

  const setUnidades = (l: string[]) => { unidade.value = l }
  const setGrupos   = (l: string[]) => { grupo.value = l }

  /** Define os valores brutos diretamente (ex.: cascata limpando com []) — descarta a seleção base/subtipo. */
  const setEspecialidades = (l: string[]) => {
    especialidade.value = l
    especialidadeBase.value = []
    especialidadeSubtipo.value = []
  }

  /**
   * Define a seleção base+subtipo da UI junto com a expansão em valores brutos
   * (calculada pelo chamador via `expandirEspecialidades`). Mantém o contrato
   * da API: só `especialidade` (brutos) entra em `activeFilters`.
   */
  function setEspecialidadeSelecao(bases: string[], subtipos: string[], valoresBrutos: string[]): void {
    especialidadeBase.value = bases
    especialidadeSubtipo.value = subtipos
    especialidade.value = valoresBrutos
  }

  function setDataInicio(d: string | null): void { dataInicio.value = d }
  function setDataFim(d: string | null): void { dataFim.value = d }

  function reset(): void {
    unidade.value = []
    grupo.value = []
    especialidade.value = []
    especialidadeBase.value = []
    especialidadeSubtipo.value = []
    dataInicio.value = null
    dataFim.value = null
  }

  return {
    unidade, grupo, especialidade, especialidadeBase, especialidadeSubtipo,
    dataInicio, dataFim,
    activeFilters, activeCount,
    toggleUnidade, toggleGrupo, toggleEspecialidade,
    setUnidades, setGrupos, setEspecialidades, setEspecialidadeSelecao,
    setDataInicio, setDataFim, reset,
  }
})
