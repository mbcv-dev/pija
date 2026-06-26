<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useKpiStore } from '@/stores/useKpiStore'
import KpiCard from './KpiCard.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const store = useKpiStore()

const submetric = computed(() => store.kpis.find((k) => k.codigo === 'KPI-07B'))
const mainKpis = computed(() => store.kpis.filter((k) => k.codigo !== 'KPI-07B'))

onMounted(() => {
  store.initWatcher()
  void store.fetchKpis()
})
</script>

<template>
  <div>
    <div v-if="store.loading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <BaseCard v-for="n in 6" :key="n" class="flex flex-col gap-4">
        <Skeleton height="h-9" rounded="rounded-xl" />
        <Skeleton height="h-8" />
        <Skeleton height="h-16" />
      </BaseCard>
    </div>
    <ErrorState v-else-if="store.error" :message="store.error" @retry="store.fetchKpis()" />
    <EmptyState v-else-if="mainKpis.length === 0" title="Sem KPIs no recorte" description="Ajuste os filtros para ver os indicadores." />
    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <KpiCard
        v-for="kpi in mainKpis" :key="kpi.codigo" :kpi="kpi"
        :submetric="kpi.codigo === 'KPI-07' ? submetric : undefined"
      />
    </div>
  </div>
</template>
