<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useGargaloStore } from '@/stores/useGargaloStore'
import { KPI_META } from '@/types/api.types'
import type { KpiCode } from '@/types/api.types'
import { METRIC_OPTIONS } from '@/lib/gargalos'
import GargaloItem from './GargaloItem.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Badge from '@/components/ui/Badge.vue'

const store = useGargaloStore()
const route = useRoute()

const maxMedia = computed(() => Math.max(...store.items.map((i) => i.media), 0))

onMounted(() => {
  // Deep-link das seções do dashboard: /gargalos?kpi=KPI-05 pré-seleciona a métrica.
  const kpi = route.query.kpi
  if (typeof kpi === 'string' && (METRIC_OPTIONS as string[]).includes(kpi)) {
    store.setMetricas([kpi as KpiCode])
  }
  store.initWatcher()
  void store.fetchGargalos()
})
</script>

<template>
  <div>
    <!-- Filtro de métrica (transições) -->
    <div class="px-5 py-3 border-b border-border dark:border-border-dark flex flex-wrap items-center gap-2">
      <span class="text-xs font-medium text-text-muted dark:text-text-dark-muted mr-1">Métricas:</span>
      <button
        v-for="code in METRIC_OPTIONS" :key="code" type="button"
        @click="store.toggleMetrica(code)"
      >
        <Badge :tone="store.metricas.includes(code) ? 'brand' : 'neutral'">
          {{ KPI_META[code].label }}
        </Badge>
      </button>
    </div>

    <div v-if="store.loading" class="p-5 flex flex-col gap-3">
      <Skeleton v-for="n in 6" :key="n" height="h-10" />
    </div>
    <ErrorState v-else-if="store.error" :message="store.error" @retry="store.fetchGargalos()" />
    <EmptyState v-else-if="store.items.length === 0" title="Sem gargalos no recorte" description="Ajuste filtros ou métricas selecionadas." icon="gargalos" />
    <div v-else>
      <GargaloItem
        v-for="(item, idx) in store.items" :key="`${item.dimensao}-${item.transicao}`"
        :item="item" :position="idx + 1" :max-media="maxMedia"
      />
    </div>
  </div>
</template>
