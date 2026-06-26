<script setup lang="ts">
import { useFilterStore } from '@/stores/useFilterStore'
import { ESPECIALIDADES } from '@/types/api.types'

const filterStore = useFilterStore()

function handleReset(): void {
  filterStore.reset()
}
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-3 p-4 rounded-2xl
           bg-surface-2 dark:bg-surface-dark-2
           border border-border dark:border-border-dark"
  >
    <!-- Ícone de filtro -->
    <div class="flex items-center gap-2 text-text-muted dark:text-text-dark-muted">
      <span class="text-sm">🔍</span>
      <span class="text-xs font-semibold uppercase tracking-widest">Filtros</span>
    </div>

    <!-- Especialidade -->
    <select
      id="filter-especialidade"
      class="flex-shrink-0 px-3 py-1.5 rounded-lg text-sm border
             bg-surface dark:bg-surface-dark
             text-text dark:text-text-dark
             border-border dark:border-border-dark
             focus:ring-2 focus:ring-primary/30 focus:border-primary
             transition-colors"
      :value="filterStore.especialidade ?? ''"
      @change="filterStore.setEspecialidade(($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">Todas as especialidades</option>
      <option v-for="esp in ESPECIALIDADES" :key="esp" :value="esp">{{ esp }}</option>
    </select>

    <!-- Data início -->
    <div class="flex items-center gap-1.5">
      <label
        for="filter-data-inicio"
        class="text-xs text-text-muted dark:text-text-dark-muted whitespace-nowrap"
      >De:</label>
      <input
        id="filter-data-inicio"
        type="date"
        class="px-2 py-1.5 rounded-lg text-sm border
               bg-surface dark:bg-surface-dark
               text-text dark:text-text-dark
               border-border dark:border-border-dark
               focus:ring-2 focus:ring-primary/30 focus:border-primary
               transition-colors"
        :value="filterStore.dataInicio ?? ''"
        @change="filterStore.setDataInicio(($event.target as HTMLInputElement).value || null)"
      />
    </div>

    <!-- Data fim -->
    <div class="flex items-center gap-1.5">
      <label
        for="filter-data-fim"
        class="text-xs text-text-muted dark:text-text-dark-muted whitespace-nowrap"
      >Até:</label>
      <input
        id="filter-data-fim"
        type="date"
        class="px-2 py-1.5 rounded-lg text-sm border
               bg-surface dark:bg-surface-dark
               text-text dark:text-text-dark
               border-border dark:border-border-dark
               focus:ring-2 focus:ring-primary/30 focus:border-primary
               transition-colors"
        :value="filterStore.dataFim ?? ''"
        @change="filterStore.setDataFim(($event.target as HTMLInputElement).value || null)"
      />
    </div>

    <!-- Group by toggle -->
    <div
      class="flex items-center rounded-lg overflow-hidden border border-border dark:border-border-dark"
    >
      <button
        id="groupby-unidade"
        type="button"
        class="px-3 py-1.5 text-xs font-medium transition-colors"
        :class="filterStore.groupBy === 'unidade'
          ? 'bg-primary text-white'
          : 'bg-surface dark:bg-surface-dark text-text-muted dark:text-text-dark-muted hover:text-primary'"
        @click="filterStore.setGroupBy('unidade')"
      >
        Por Unidade
      </button>
      <button
        id="groupby-especialidade"
        type="button"
        class="px-3 py-1.5 text-xs font-medium transition-colors border-l border-border dark:border-border-dark"
        :class="filterStore.groupBy === 'especialidade'
          ? 'bg-primary text-white'
          : 'bg-surface dark:bg-surface-dark text-text-muted dark:text-text-dark-muted hover:text-primary'"
        @click="filterStore.setGroupBy('especialidade')"
      >
        Por Especialidade
      </button>
    </div>

    <!-- Limpar filtros -->
    <button
      v-if="filterStore.activeCount > 0"
      id="btn-limpar-filtros"
      type="button"
      class="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
             text-text-muted dark:text-text-dark-muted
             hover:text-danger hover:bg-danger/10
             transition-colors"
      @click="handleReset"
    >
      <span>✕</span>
      Limpar ({{ filterStore.activeCount }})
    </button>
  </div>
</template>
