import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDimensoes } from '@/services/api'
import { agruparUnidades } from '@/lib/dimensoes'
import type { UnidadeDim } from '@/types/api.types'

/**
 * useDimensoesStore — valores reais dos filtros (grupo, unidade, especialidade).
 * Carrega uma vez; `scopeByGrupo`/`scopeEspecialidades` aplicam a cascata.
 */
export const useDimensoesStore = defineStore('dimensoes', () => {
  const grupos = ref<string[]>([])
  const unidades = ref<UnidadeDim[]>([])
  const especialidades = ref<string[]>([])
  // Listas completas (sem escopo) — usadas ao limpar a seleção do pai.
  const unidadesFull = ref<UnidadeDim[]>([])
  const especialidadesFull = ref<string[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  /** Unidades agrupadas por grupo, para os optgroups do filtro. */
  const unidadesAgrupadas = computed(() => agruparUnidades(unidades.value))
  /** Nomes das unidades (lista plana), para o `options` do FilterSelect. */
  const unidadesValores = computed(() => unidades.value.map((u) => u.valor))

  async function load(): Promise<void> {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const d = await getDimensoes()
      grupos.value = d.grupos
      unidades.value = d.unidades
      unidadesFull.value = d.unidades
      especialidades.value = d.especialidades
      especialidadesFull.value = d.especialidades
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  /** Cascata nível 1: escopa unidades E especialidades pelos grupos (ou restaura tudo). */
  async function scopeByGrupo(grupo: string[]): Promise<void> {
    if (grupo.length === 0) {
      unidades.value = unidadesFull.value
      especialidades.value = especialidadesFull.value
      return
    }
    const d = await getDimensoes({ grupo })
    unidades.value = d.unidades
    especialidades.value = d.especialidades
  }

  /** Cascata nível 2: escopa especialidades pelas unidades (ou volta ao escopo do grupo). */
  async function scopeEspecialidades(unidade: string[]): Promise<void> {
    if (unidade.length === 0) {
      especialidades.value = especialidadesFull.value
      return
    }
    const d = await getDimensoes({ unidade })
    especialidades.value = d.especialidades
  }

  return {
    grupos, unidades, especialidades, unidadesFull, especialidadesFull, loaded, loading,
    unidadesAgrupadas, unidadesValores,
    load, scopeByGrupo, scopeEspecialidades,
  }
})
