<script setup lang="ts">
defineProps<{ value: string; caption?: string; muted?: boolean }>()
</script>

<template>
  <div>
    <p
      class="text-3xl font-bold font-mono tabular-nums leading-none"
      :class="muted ? 'text-text-faint dark:text-text-dark-muted' : 'text-text dark:text-text-dark'"
    >
      {{ value }}
    </p>
    <p v-if="caption" class="text-xs text-text-muted dark:text-text-dark-muted mt-1.5">
      {{ caption }}
    </p>
  </div>
</template>
