<script setup lang="ts">
import { useFilterStore } from '@/stores/useFilterStore'
import { UNIDADES } from '@/types/api.types'

const filterStore = useFilterStore()

// "Todas" = null; cada botão de unidade usa toggle
function selectUnidade(u: string | null): void {
  if (u === null) {
    // Clicar em "Todas" sempre limpa a seleção
    if (filterStore.unidade !== null) {
      filterStore.setUnidade(null)
    }
  } else {
    filterStore.setUnidade(u)
  }
}
</script>

<template>
  <div class="w-full">
    <div class="flex items-center gap-2 mb-2">
      <h3 class="text-xs font-semibold text-text-muted dark:text-text-dark-muted uppercase tracking-widest">
        Filtrar por Unidade
      </h3>
    </div>

    <!-- Scroll horizontal em mobile -->
    <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
      <!-- Botão "Todas" -->
      <button
        id="unit-btn-todas"
        type="button"
        class="flex-shrink-0 snap-start px-4 py-2 rounded-full text-sm font-medium
               transition-all duration-200 whitespace-nowrap border"
        :class="filterStore.unidade === null
          ? 'bg-primary text-white border-primary shadow-md'
          : 'bg-surface dark:bg-surface-dark text-text-muted dark:text-text-dark-muted border-border dark:border-border-dark hover:border-primary hover:text-primary'"
        @click="selectUnidade(null)"
      >
        Todas
      </button>

      <!-- Botões por unidade -->
      <button
        v-for="unidade in UNIDADES"
        :id="`unit-btn-${unidade.toLowerCase().replace(/\s+/g, '-')}`"
        :key="unidade"
        type="button"
        class="flex-shrink-0 snap-start px-4 py-2 rounded-full text-sm font-medium
               transition-all duration-200 whitespace-nowrap border"
        :class="filterStore.unidade === unidade
          ? 'bg-primary text-white border-primary shadow-md scale-105'
          : 'bg-surface dark:bg-surface-dark text-text dark:text-text-dark border-border dark:border-border-dark hover:border-primary hover:text-primary'"
        @click="selectUnidade(unidade)"
      >
        {{ unidade }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Esconde scrollbar mas mantém funcionalidade */
.scrollbar-none {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
</style>
