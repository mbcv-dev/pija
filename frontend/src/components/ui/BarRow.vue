<script setup lang="ts">
defineProps<{ label: string; value: string; ratio: number; barClass?: string }>()
</script>

<template>
  <div class="flex items-center gap-3 text-xs">
    <span class="w-28 shrink-0 truncate text-text-muted dark:text-text-dark-muted" :title="label">
      {{ label }}
    </span>
    <div class="flex-1 h-2 rounded-full bg-surface-offset dark:bg-surface-dark-offset overflow-hidden">
      <div
        class="h-full rounded-full transition-all duration-500"
        :class="barClass ?? 'bg-primary'"
        :style="{ width: `${Math.max(2, Math.min(100, ratio * 100)).toFixed(1)}%` }"
      />
    </div>
    <span class="w-14 shrink-0 text-right tabular-nums font-medium text-text dark:text-text-dark">
      {{ value }}
    </span>
  </div>
</template>
