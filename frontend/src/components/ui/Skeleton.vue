<script setup lang="ts">
withDefaults(defineProps<{ height?: string; rounded?: string }>(), { height: 'h-4', rounded: 'rounded-lg' })
</script>

<template>
  <div class="animate-pulse-soft bg-surface-offset dark:bg-surface-dark-offset" :class="[height, rounded]" />
</template>
