<script setup lang="ts">
import type { TipoEntidade } from '@/types/api.types'

defineProps<{
  tipo: TipoEntidade
  small?: boolean
}>()

// Mapeamento de tipo → { label, classes de cor }
const CONFIG: Record<TipoEntidade, { label: string; classes: string }> = {
  CONSULTA:     { label: 'Consulta',     classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  EXAME:        { label: 'Exame',        classes: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  INTERNACAO:   { label: 'Internação',   classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  PRONTUARIO:   { label: 'Prontuário',   classes: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
  CIRURGIA:     { label: 'Cirurgia',     classes: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
  PROCEDIMENTO: { label: 'Procedimento', classes: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  ALTA:         { label: 'Alta',         classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
}
</script>

<template>
  <span
    class="inline-flex items-center font-medium rounded-full whitespace-nowrap"
    :class="[
      CONFIG[tipo].classes,
      small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
    ]"
  >
    {{ CONFIG[tipo].label }}
  </span>
</template>
