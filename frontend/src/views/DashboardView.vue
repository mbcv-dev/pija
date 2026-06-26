<script setup lang="ts">
import FilterBar from '@/components/ui/FilterBar.vue'
import KpiGrid from '@/components/kpis/KpiGrid.vue'
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-text dark:text-text-dark tracking-tight">Dashboard</h1>
      <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">
        Tempos médios da jornada assistencial · HC-UFPE
      </p>
    </div>
    <FilterBar />
    <KpiGrid />
  </div>
</template>
