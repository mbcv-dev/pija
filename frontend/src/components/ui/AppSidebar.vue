<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Icon from './Icon.vue'

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/gargalos',  label: 'Gargalos',  icon: 'gargalos' },
  { to: '/jornada',   label: 'Jornada',   icon: 'jornada' },
]
</script>

<template>
  <aside class="hidden md:flex flex-col w-56 shrink-0 border-r border-border dark:border-border-dark p-3 gap-1">
    <RouterLink
      v-for="item in items" :key="item.to" :to="item.to"
      class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
      active-class="bg-primary/10 text-primary"
      :class="'text-text-muted dark:text-text-dark-muted hover:bg-surface-offset dark:hover:bg-surface-dark-offset'"
    >
      <Icon :name="item.icon" :size="18" />
      {{ item.label }}
    </RouterLink>
  </aside>
</template>
