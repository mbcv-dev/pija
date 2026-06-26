<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="flex items-center gap-3 pl-[11px] py-1">
    <div class="w-0.5 h-6 bg-border dark:bg-border-dark" />
    <span class="text-[11px] text-text-muted dark:text-text-dark-muted italic">{{ label }}</span>
  </div>
</template>
