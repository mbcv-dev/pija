import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDimensoes } from '@/services/api'

/**
 * useDimensoesStore — valores reais dos filtros (grupo, unidade, especialidade)
 * vindos do backend. Carregado uma vez; o FilterBar popula os selects daqui.
 */
export const useDimensoesStore = defineStore('dimensoes', () => {
  const grupos = ref<string[]>([])
  const unidades = ref<string[]>([])
  const especialidades = ref<string[]>([])
  // Lista completa de especialidades (sem escopo) — usada ao limpar a unidade.
  const especialidadesFull = ref<string[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  async function load(): Promise<void> {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const d = await getDimensoes()
      grupos.value = d.grupos
      unidades.value = d.unidades
      especialidades.value = d.especialidades
      especialidadesFull.value = d.especialidades
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  /** Cascata: escopa as especialidades pelas unidades selecionadas.
   *  INTERINO: a API ainda aceita uma unidade só; com 2+ selecionadas,
   *  mantém a lista completa. Vira escopo real por lista no Task 9. */
  async function scopeEspecialidades(unidade: string[]): Promise<void> {
    if (unidade.length !== 1) {
      especialidades.value = especialidadesFull.value
      return
    }
    const d = await getDimensoes(unidade[0])
    especialidades.value = d.especialidades
  }

  return { grupos, unidades, especialidades, especialidadesFull, loaded, loading, load, scopeEspecialidades }
})
