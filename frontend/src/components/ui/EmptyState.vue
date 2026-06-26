<script setup lang="ts">
import Icon from './Icon.vue'
withDefaults(defineProps<{ title: string; description?: string; icon?: string }>(), { icon: 'search' })
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center py-14 px-6">
    <div class="w-12 h-12 rounded-2xl bg-surface-offset dark:bg-surface-dark-offset flex items-center justify-center text-text-faint dark:text-text-dark-muted">
      <Icon :name="icon" :size="24" />
    </div>
    <p class="mt-3 text-sm font-semibold text-text dark:text-text-dark">{{ title }}</p>
    <p v-if="description" class="mt-1 text-xs text-text-muted dark:text-text-dark-muted max-w-xs">
      {{ description }}
    </p>
  </div>
</template>
