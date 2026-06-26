<script setup lang="ts">
defineProps<{
  icon?: string
  title?: string
  description?: string
  action?: string
}>()

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center"
  >
    <span class="text-5xl select-none">{{ icon ?? '📭' }}</span>
    <h3 class="text-base font-semibold text-text dark:text-text-dark">
      {{ title ?? 'Nenhum dado encontrado' }}
    </h3>
    <p class="text-sm text-text-muted dark:text-text-dark-muted max-w-xs">
      {{ description ?? 'Não há registros para os filtros selecionados.' }}
    </p>
    <button
      v-if="action"
      type="button"
      class="mt-2 px-4 py-2 rounded-lg text-sm font-medium
             bg-primary/10 text-primary hover:bg-primary/20
             transition-colors"
      @click="emit('action')"
    >
      {{ action }}
    </button>
  </div>
</template>
