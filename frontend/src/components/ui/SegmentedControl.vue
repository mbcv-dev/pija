<script setup lang="ts">
defineProps<{ modelValue: string; options: { value: string; label: string }[] }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="inline-flex p-0.5 rounded-xl bg-surface-offset dark:bg-surface-dark-offset">
    <button
      v-for="opt in options" :key="opt.value" type="button"
      class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
      :class="opt.value === modelValue
        ? 'bg-surface dark:bg-surface-dark text-text dark:text-text-dark shadow-sm'
        : 'text-text-muted dark:text-text-dark-muted hover:text-text dark:hover:text-text-dark'"
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
