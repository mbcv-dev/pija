<script setup lang="ts">
import FilterBar from '@/components/ui/FilterBar.vue'
import GargaloList from '@/components/gargalos/GargaloList.vue'
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Cabeçalho da tela -->
    <div>
      <h1 class="text-2xl font-bold text-text dark:text-text-dark">
        Gargalos
      </h1>
      <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">
        Ranking dos piores tempos médios · pior para o melhor
      </p>
    </div>

    <!-- Filtros globais -->
    <FilterBar />

    <!-- Lista de gargalos -->
    <div
      class="rounded-2xl border border-border dark:border-border-dark
             bg-surface dark:bg-surface-dark shadow-card overflow-hidden"
    >
      <div class="px-5 py-4 border-b border-border dark:border-border-dark">
        <h2 class="text-sm font-semibold text-text dark:text-text-dark">
          Ranking de Gargalos
        </h2>
        <p class="text-xs text-text-muted dark:text-text-dark-muted mt-0.5">
          Dimensão × transição com maior tempo médio em dias
        </p>
      </div>
      <GargaloList />
    </div>
  </div>
</template>
