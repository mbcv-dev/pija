<script setup lang="ts">
defineProps<{
  modelValue: string | null
  options: readonly string[]
  label: string
  placeholder?: string
}>()
defineEmits<{ 'update:modelValue': [value: string | null] }>()
</script>

<template>
  <label class="flex flex-col gap-1 text-xs">
    <span class="font-medium text-text-muted dark:text-text-dark-muted">{{ label }}</span>
    <select
      class="px-3 py-2 rounded-xl text-sm bg-surface dark:bg-surface-dark border border-border dark:border-border-dark text-text dark:text-text-dark min-w-[10rem]"
      :value="modelValue ?? ''"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">{{ placeholder ?? 'Todas' }}</option>
      <option v-for="opt in options" :key="opt" :value="opt">{{ opt }}</option>
    </select>
  </label>
</template>
