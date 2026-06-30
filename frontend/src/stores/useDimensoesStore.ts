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
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  return { grupos, unidades, especialidades, loaded, loading, load }
})
