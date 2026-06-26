<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'primary' | 'secondary' | 'ghost'; type?: 'button' | 'submit' }>(), {
  variant: 'secondary', type: 'button',
})

const VARIANTS: Record<string, string> = {
  primary:   'bg-primary text-white hover:bg-primary-hover',
  secondary: 'border border-border dark:border-border-dark text-text dark:text-text-dark hover:bg-surface-offset dark:hover:bg-surface-dark-offset',
  ghost:     'text-text-muted dark:text-text-dark-muted hover:bg-surface-offset dark:hover:bg-surface-dark-offset',
}
</script>

<template>
  <button
    :type="type"
    class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none"
    :class="VARIANTS[variant]"
  >
    <slot />
  </button>
</template>
