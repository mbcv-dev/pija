<script setup lang="ts">
defineProps<{
  position: number
  label: string
  value: string
  caption?: string
  ratio: number
  barClass: string
}>()
</script>

<template>
  <div class="flex items-center gap-3 px-5 py-3 border-b border-border dark:border-border-dark last:border-0">
    <span class="w-6 shrink-0 text-sm font-bold tabular-nums text-text-faint dark:text-text-dark-muted">
      {{ position }}
    </span>
    <div class="min-w-0 flex-1">
      <div class="flex items-center justify-between gap-2">
        <span class="truncate text-sm font-medium text-text dark:text-text-dark" :title="label">
          {{ label }}
        </span>
        <span class="shrink-0 tabular-nums text-sm font-semibold text-text dark:text-text-dark">
          {{ value }}
        </span>
      </div>
      <div class="mt-1.5 h-2 rounded-full bg-surface-offset dark:bg-surface-dark-offset overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="barClass"
          :style="{ width: `${Math.max(2, Math.min(100, ratio * 100)).toFixed(1)}%` }"
        />
      </div>
      <p v-if="caption" class="mt-1 text-[11px] text-text-muted dark:text-text-dark-muted">
        {{ caption }}
      </p>
    </div>
  </div>
</template>
