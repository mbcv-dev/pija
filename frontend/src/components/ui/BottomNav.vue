<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const navLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/gargalos',  label: 'Gargalos',  icon: '🔴' },
  { to: '/eventos',   label: 'Eventos',   icon: '📋' },
]

function isActive(path: string): boolean {
  return route.path.startsWith(path)
}
</script>

<template>
  <!-- Bottom nav bar — só visível em mobile (md:hidden) -->
  <nav
    class="fixed bottom-0 left-0 right-0 z-40 flex md:hidden
           bg-surface dark:bg-surface-dark
           border-t border-border dark:border-border-dark
           safe-area-inset-bottom"
    aria-label="Navegação principal"
  >
    <RouterLink
      v-for="link in navLinks"
      :key="link.to"
      :to="link.to"
      :id="`mobile-nav-${link.label.toLowerCase()}`"
      class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5
             min-h-[56px] transition-colors duration-150"
      :class="isActive(link.to)
        ? 'text-primary'
        : 'text-text-muted dark:text-text-dark-muted active:text-primary'"
    >
      <!-- Indicador de ativo (pill acima do ícone) -->
      <span
        class="w-8 h-0.5 rounded-full mb-0.5 transition-all duration-200"
        :class="isActive(link.to) ? 'bg-primary' : 'bg-transparent'"
      />
      <span class="text-xl leading-none">{{ link.icon }}</span>
      <span
        class="text-[10px] font-semibold tracking-wide mt-0.5"
        :class="isActive(link.to) ? 'text-primary' : ''"
      >
        {{ link.label }}
      </span>
    </RouterLink>
  </nav>
</template>
