<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' }>(), { tone: 'neutral' })

const TONES: Record<string, string> = {
  neutral: 'bg-text/5 text-text-muted dark:bg-white/10 dark:text-text-dark-muted',
  brand:   'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger:  'bg-danger/10 text-danger',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap"
    :class="TONES[tone]"
  >
    <slot />
  </span>
</template>
