<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const navLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊', desc: 'KPIs de tempo médio' },
  { to: '/gargalos',  label: 'Gargalos',  icon: '🔴', desc: 'Ranking de gargalos'  },
  { to: '/eventos',   label: 'Eventos',   icon: '📋', desc: 'Explorar eventos'     },
]

function isActive(path: string): boolean {
  return route.path.startsWith(path)
}
</script>

<template>
  <!-- Sidebar fixa no desktop, oculta no mobile -->
  <aside
    class="hidden md:flex flex-col w-56 min-h-0 shrink-0
           bg-surface-2 dark:bg-surface-dark-2
           border-r border-border dark:border-border-dark"
  >
    <!-- Navegação principal -->
    <nav class="flex flex-col gap-1 p-3 pt-4">
      <RouterLink
        v-for="link in navLinks"
        :key="link.to"
        :to="link.to"
        :id="`sidebar-link-${link.label.toLowerCase()}`"
        class="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group"
        :class="isActive(link.to)
          ? 'bg-primary text-white shadow-sm'
          : 'text-text dark:text-text-dark hover:bg-primary/10 hover:text-primary dark:hover:text-primary'"
      >
        <span class="text-lg leading-none">{{ link.icon }}</span>
        <div class="flex flex-col min-w-0">
          <span class="text-sm font-semibold leading-tight">{{ link.label }}</span>
          <span
            class="text-[10px] leading-tight truncate"
            :class="isActive(link.to) ? 'text-white/70' : 'text-text-muted dark:text-text-dark-muted'"
          >
            {{ link.desc }}
          </span>
        </div>
      </RouterLink>
    </nav>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Rodapé da sidebar -->
    <div class="p-3 border-t border-border dark:border-border-dark">
      <div class="px-3 py-2">
        <p class="text-[10px] text-text-faint dark:text-text-dark-muted leading-relaxed">
          PIJA v0.1.0 · Fase 2<br />
          HC-UFPE · CIn-UFPE<br />
          IESI 2026.1
        </p>
      </div>
    </div>
  </aside>
</template>
