<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Icon from './Icon.vue'

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/gargalos',  label: 'Gargalos',  icon: 'gargalos' },
  { to: '/jornada',   label: 'Jornada',   icon: 'jornada' },
  { to: '/ciclicidade', label: 'Ciclos', icon: 'ciclicidade' },
  { to: '/metodologia', label: 'Método', icon: 'info' },
]
</script>

<template>
  <nav class="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 flex items-stretch bg-surface/95 dark:bg-surface-dark/95 backdrop-blur border-t border-border dark:border-border-dark">
    <RouterLink
      v-for="item in items" :key="item.to" :to="item.to"
      class="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors"
      active-class="text-primary"
      :class="'text-text-muted dark:text-text-dark-muted'"
    >
      <Icon :name="item.icon" :size="20" />
      {{ item.label }}
    </RouterLink>
  </nav>
</template>
