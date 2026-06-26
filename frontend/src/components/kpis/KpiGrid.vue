<script setup lang="ts">
import { onMounted } from 'vue'
import { useKpiStore } from '@/stores/useKpiStore'
import KpiCard from './KpiCard.vue'
import SkeletonCard from '@/components/ui/SkeletonCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'

const kpiStore = useKpiStore()

onMounted(() => {
  kpiStore.initWatcher()
  if (kpiStore.kpis.length === 0 && !kpiStore.loading) {
    void kpiStore.fetchKpis()
  }
})
</script>

<template>
  <section>
    <!-- Loading: 5 skeleton cards -->
    <div
      v-if="kpiStore.loading"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4"
    >
      <SkeletonCard v-for="i in 5" :key="i" :show-breakdown="true" />
    </div>

    <!-- Error -->
    <div
      v-else-if="kpiStore.error"
      class="rounded-2xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark"
    >
      <ErrorState
        :message="kpiStore.error"
        @retry="kpiStore.fetchKpis()"
      />
    </div>

    <!-- Empty -->
    <div
      v-else-if="kpiStore.kpis.length === 0"
      class="rounded-2xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark"
    >
      <EmptyState
        title="Nenhum KPI disponível"
        description="Não há dados de KPI para os filtros selecionados."
        icon="📊"
      />
    </div>

    <!-- Grid de KPIs -->
    <div
      v-else
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <KpiCard
        v-for="kpi in kpiStore.kpis"
        :key="kpi.codigo"
        :kpi="kpi"
      />
    </div>
  </section>
</template>
