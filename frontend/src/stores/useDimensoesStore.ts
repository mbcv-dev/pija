import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDimensoes } from '@/services/api'
import { agruparUnidades, agruparEspecialidades } from '@/lib/dimensoes'
import type { UnidadeDim } from '@/types/api.types'

// Funções puras da derivação base/subtipo (testáveis sem Pinia) — ver @/lib/dimensoes.
export { separarEspecialidade, agruparEspecialidades, expandirEspecialidades } from '@/lib/dimensoes'
export type { BaseEspecialidade, EspecialidadeSeparada, SubtipoEspecialidade } from '@/lib/dimensoes'

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
  /** Especialidades (já escopadas pela cascata) agrupadas por base, com subtipos derivados. */
  const especialidadeBases = computed(() => agruparEspecialidades(especialidades.value))
  /** Nomes das bases (lista plana), para o select de Especialidade. */
  const especialidadeBasesValores = computed(() => especialidadeBases.value.map((b) => b.base))

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

  /**
   * Cancelam a requisição da cascata anterior. Um por nível, porque os dois
   * níveis reagem a filtros diferentes (grupo e unidade) e podem estar no ar ao
   * mesmo tempo. Sem isso, mexer no filtro duas vezes seguidas custa duas
   * varreduras completas no backend e só a última é usada.
   */
  let abortGrupo: AbortController | null = null
  let abortEspecialidades: AbortController | null = null

  /** Cascata nível 1: escopa unidades E especialidades pelos grupos (ou restaura tudo). */
  async function scopeByGrupo(grupo: string[]): Promise<void> {
    abortGrupo?.abort()
    if (grupo.length === 0) {
      // Zerar o controller junto: senão o abortado continua sendo o "atual" e a
      // resposta que já estava resolvida quando o abort chegou passaria na guarda
      // de identidade abaixo, sobrescrevendo as listas cheias que acabamos de restaurar.
      abortGrupo = null
      unidades.value = unidadesFull.value
      especialidades.value = especialidadesFull.value
      return
    }
    const controller = new AbortController()
    abortGrupo = controller
    try {
      const d = await getDimensoes({ grupo }, { signal: controller.signal })
      // Guarda de IDENTIDADE, igual aos outros stores: `abort()` não impede a
      // continuação de uma promise que já resolveu, então sem isto uma resposta
      // obsoleta ainda vence no caminho de sucesso.
      if (abortGrupo !== controller) return
      unidades.value = d.unidades
      especialidades.value = d.especialidades
    } catch (e) {
      // Cancelamento nosso não é falha — engolir. Falha de verdade continua
      // propagando como antes (os chamadores são `void`, então vira unhandled
      // rejection visível no console, que é o comportamento que já existia).
      if (!controller.signal.aborted) throw e
    }
  }

  /** Cascata nível 2: escopa especialidades pelas unidades (ou volta ao escopo do grupo). */
  async function scopeEspecialidades(unidade: string[]): Promise<void> {
    abortEspecialidades?.abort()
    if (unidade.length === 0) {
      abortEspecialidades = null  // idem scopeByGrupo
      especialidades.value = especialidadesFull.value
      return
    }
    const controller = new AbortController()
    abortEspecialidades = controller
    try {
      const d = await getDimensoes({ unidade }, { signal: controller.signal })
      if (abortEspecialidades !== controller) return
      especialidades.value = d.especialidades
    } catch (e) {
      // Idem scopeByGrupo: só o cancelamento é engolido.
      if (!controller.signal.aborted) throw e
    }
  }

  return {
    grupos, unidades, especialidades, unidadesFull, especialidadesFull, loaded, loading,
    unidadesAgrupadas, unidadesValores, especialidadeBases, especialidadeBasesValores,
    load, scopeByGrupo, scopeEspecialidades,
  }
})
