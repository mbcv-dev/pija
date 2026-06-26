<script setup lang="ts">
withDefaults(defineProps<{ hover?: boolean; padding?: boolean }>(), { hover: false, padding: true })
</script>

<template>
  <div
    class="rounded-2xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark shadow-card transition-all duration-200"
    :class="[hover ? 'hover:shadow-card-hover hover:-translate-y-0.5' : '', padding ? 'p-5' : '']"
  >
    <slot />
  </div>
</template>
