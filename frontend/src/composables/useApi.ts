import { ref } from 'vue'
import axios from 'axios'

/**
 * useApi — Composable genérico para chamadas assíncronas com loading/error state.
 * Os stores principais usam esse padrão internamente.
 * Componentes que precisam de chamadas ad-hoc podem usar este composable diretamente.
 */
export function useApi<T>() {
  const data    = ref<T | null>(null)
  const loading = ref(false)
  const error   = ref<string | null>(null)

  async function execute(fn: () => Promise<T>): Promise<T | null> {
    loading.value = true
    error.value   = null

    try {
      const result = await fn()
      data.value   = result as typeof data.value
      return result
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const status  = e.response?.status
        const message = (e.response?.data as { detail?: string })?.detail

        if (status === 404) {
          error.value = 'Recurso não encontrado'
        } else if (status === 422) {
          error.value = 'Parâmetros inválidos'
        } else if (status === 500) {
          error.value = 'Erro interno do servidor'
        } else if (e.code === 'ECONNABORTED') {
          error.value = 'Timeout — o servidor demorou muito para responder'
        } else {
          error.value = message ?? e.message ?? 'Erro desconhecido'
        }
      } else if (e instanceof Error) {
        error.value = e.message
      } else {
        error.value = 'Erro desconhecido'
      }

      data.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  function reset(): void {
    data.value    = null
    loading.value = false
    error.value   = null
  }

  return { data, loading, error, execute, reset }
}
