<script setup lang="ts">
import BaseButton from './BaseButton.vue'
defineProps<{ message: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center py-14 px-6">
    <div class="w-12 h-12 rounded-2xl bg-danger/10 text-danger flex items-center justify-center text-xl font-bold">!</div>
    <p class="mt-3 text-sm font-semibold text-text dark:text-text-dark">Algo deu errado</p>
    <p class="mt-1 text-xs text-text-muted dark:text-text-dark-muted max-w-xs">{{ message }}</p>
    <BaseButton class="mt-4" variant="secondary" @click="$emit('retry')">Tentar novamente</BaseButton>
  </div>
</template>
