<script setup lang="ts">
import Icon from './Icon.vue'
import ThemeToggle from './ThemeToggle.vue'
</script>

<template>
  <header class="sticky top-0 z-30 h-14 flex items-center justify-between px-4 md:px-6 bg-surface/90 dark:bg-surface-dark/90 backdrop-blur border-b border-border dark:border-border-dark">
    <div class="flex items-center gap-2.5">
      <span class="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center">
        <Icon name="jornada" :size="18" />
      </span>
      <div class="leading-tight">
        <p class="text-sm font-bold text-text dark:text-text-dark tracking-tight">PIJA</p>
        <p class="text-[10px] text-text-muted dark:text-text-dark-muted">Jornada Assistencial · HC-UFPE</p>
      </div>
    </div>
    <ThemeToggle />
  </header>
</template>
