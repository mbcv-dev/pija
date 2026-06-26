<script setup lang="ts">
import { useThemeStore } from '@/stores/useThemeStore'
import Icon from './Icon.vue'
const theme = useThemeStore()
</script>

<template>
  <button
    type="button"
    class="p-2 rounded-xl text-text-muted dark:text-text-dark-muted hover:bg-surface-offset dark:hover:bg-surface-dark-offset transition-colors"
    :aria-label="theme.theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'"
    @click="theme.toggle()"
  >
    <Icon :name="theme.theme === 'dark' ? 'sun' : 'moon'" />
  </button>
</template>
