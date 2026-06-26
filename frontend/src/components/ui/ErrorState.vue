<script setup lang="ts">
defineProps<{
  message?: string
  retry?: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center"
  >
    <div
      class="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center"
    >
      <span class="text-2xl">⚠️</span>
    </div>
    <h3 class="text-base font-semibold text-text dark:text-text-dark">
      Erro ao carregar dados
    </h3>
    <p class="text-sm text-text-muted dark:text-text-dark-muted max-w-xs">
      {{ message ?? 'Ocorreu um erro inesperado. Verifique a conexão e tente novamente.' }}
    </p>
    <button
      v-if="retry !== false"
      type="button"
      class="mt-2 px-4 py-2 rounded-lg text-sm font-medium
             bg-danger/10 text-danger hover:bg-danger/20
             transition-colors"
      @click="emit('retry')"
    >
      Tentar novamente
    </button>
  </div>
</template>
