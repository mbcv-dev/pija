import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getJornada } from '@/services/api'
import { sortByTimestampAsc } from '@/lib/timeline'
import type { EventoItem, TipoEntidade } from '@/types/api.types'

/**
 * useJornadaStore — timeline de eventos de um paciente (busca por prontuário).
 * Não observa filtros globais: é dirigido pela busca do usuário.
 */
export const useJornadaStore = defineStore('jornada', () => {
  const pacienteId = ref<string | null>(null)
  const eventos    = ref<EventoItem[]>([])
  const loading    = ref(false)
  const error      = ref<string | null>(null)
  const searched   = ref(false)
  const tipoFiltro = ref<TipoEntidade | null>(null)

  async function buscar(id: string): Promise<void> {
    const trimmed = id.trim()
    if (!trimmed) return
    pacienteId.value = trimmed
    searched.value = true
    loading.value = true
    error.value = null
    try {
      const data = await getJornada(trimmed)
      eventos.value = sortByTimestampAsc(data)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erro ao carregar jornada'
      eventos.value = []
    } finally {
      loading.value = false
    }
  }

  function setTipoFiltro(t: TipoEntidade | null): void {
    tipoFiltro.value = tipoFiltro.value === t ? null : t
  }

  return { pacienteId, eventos, loading, error, searched, tipoFiltro, buscar, setTipoFiltro }
})
