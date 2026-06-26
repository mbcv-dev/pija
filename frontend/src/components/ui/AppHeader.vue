<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { USE_MOCK } from '@/services/api'

const route = useRoute()
const isDark = ref(false)

onMounted(() => {
  // Restaurar preferência salva
  const saved = localStorage.getItem('pija-theme')
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true
    document.documentElement.setAttribute('data-theme', 'dark')
  }
})

function toggleDark(): void {
  isDark.value = !isDark.value
  const theme = isDark.value ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('pija-theme', theme)
}
</script>

<template>
  <header
    class="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:px-6
           bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark
           backdrop-blur-sm bg-opacity-95"
  >
    <!-- Logo + nome -->
    <RouterLink
      to="/dashboard"
      class="flex items-center gap-2.5 group"
    >
      <div
        class="w-8 h-8 rounded-xl bg-primary flex items-center justify-center
               shadow-sm group-hover:shadow-md transition-shadow"
      >
        <span class="text-white text-sm font-bold select-none">P</span>
      </div>
      <div class="flex flex-col leading-none">
        <span class="text-[13px] font-bold text-primary tracking-wide">PIJA</span>
        <span class="text-[10px] text-text-muted dark:text-text-dark-muted hidden sm:block">
          Jornada Assistencial · HC-UFPE
        </span>
      </div>
    </RouterLink>

    <!-- Navegação central (desktop) -->
    <nav class="hidden md:flex items-center gap-1">
      <RouterLink
        v-for="link in [
          { to: '/dashboard', label: 'Dashboard' },
          { to: '/gargalos',  label: 'Gargalos'  },
          { to: '/eventos',   label: 'Eventos'   },
        ]"
        :key="link.to"
        :to="link.to"
        class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        :class="route.path.startsWith(link.to)
          ? 'bg-primary text-white'
          : 'text-text-muted dark:text-text-dark-muted hover:bg-primary/10 hover:text-primary'"
      >
        {{ link.label }}
      </RouterLink>
    </nav>

    <!-- Ações do header -->
    <div class="flex items-center gap-2">
      <!-- Indicador de modo mock -->
      <span
        v-if="USE_MOCK"
        class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full
               bg-caution/15 text-caution text-[11px] font-medium"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-caution animate-pulse" />
        MOCK
      </span>

      <!-- Toggle dark mode -->
      <button
        id="btn-toggle-dark-mode"
        type="button"
        :aria-label="isDark ? 'Ativar modo claro' : 'Ativar modo escuro'"
        :title="isDark ? 'Modo claro' : 'Modo escuro'"
        class="w-8 h-8 rounded-lg flex items-center justify-center
               text-text-muted dark:text-text-dark-muted
               hover:bg-surface-offset dark:hover:bg-surface-dark-offset
               transition-colors"
        @click="toggleDark"
      >
        <span v-if="isDark" class="text-base">☀️</span>
        <span v-else        class="text-base">🌙</span>
      </button>
    </div>
  </header>
</template>
