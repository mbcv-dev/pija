<script setup lang="ts">
defineProps<{
  lines?: number
  showBreakdown?: boolean
}>()
</script>

<template>
  <div
    class="rounded-2xl border border-border dark:border-border-dark
           bg-surface dark:bg-surface-dark p-5 animate-pulse-soft"
  >
    <!-- Código KPI + título -->
    <div class="flex items-center gap-2 mb-4">
      <div class="w-12 h-5 bg-primary/15 dark:bg-primary/20 rounded-full" />
      <div class="w-36 h-4 bg-border dark:bg-border-dark rounded-md" />
    </div>

    <!-- Número principal -->
    <div class="mb-1">
      <div class="w-28 h-9 bg-border dark:bg-border-dark rounded-lg mb-1.5" />
      <div class="w-40 h-3 bg-surface-offset dark:bg-surface-dark-offset rounded-md" />
    </div>

    <!-- Breakdown bars -->
    <div v-if="showBreakdown !== false" class="mt-4 space-y-2.5">
      <div class="h-3 w-24 bg-surface-offset dark:bg-surface-dark-offset rounded-md mb-3" />
      <div
        v-for="i in (lines ?? 4)"
        :key="i"
        class="flex items-center gap-2"
      >
        <div class="w-28 h-3 bg-border dark:bg-border-dark rounded" />
        <div
          class="h-3 bg-primary/15 dark:bg-primary/20 rounded-full"
          :style="{ width: `${100 - i * 12}%` }"
        />
        <div class="w-8 h-3 bg-surface-offset dark:bg-surface-dark-offset rounded ml-auto" />
      </div>
    </div>
  </div>
</template>
