<script setup lang="ts">
import { computed } from 'vue'
import type { KpiItem } from '@/types/api.types'
import { KPI_META } from '@/types/api.types'
import { formatDuration, formatCount } from '@/lib/format'
import { intensityLevel, intensityBarClass } from '@/lib/intensity'
import BaseCard from '@/components/ui/BaseCard.vue'
import Icon from '@/components/ui/Icon.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import KpiBreakdownBar from './KpiBreakdownBar.vue'

const props = defineProps<{ kpi: KpiItem; submetric?: KpiItem }>()

const meta = computed(() => KPI_META[props.kpi.codigo])
const subMeta = computed(() => (props.submetric ? KPI_META[props.submetric.codigo] : null))

// Indicador de meta do KPI-07B (≤4h = ok). Nível de intensidade 0..4 em [0, 2*meta].
const subBarClass = computed(() => {
  if (!props.submetric || props.submetric.media_global === null || !subMeta.value?.metaHoras) return 'bg-primary'
  const lvl = intensityLevel(props.submetric.media_global, 0, subMeta.value.metaHoras * 2)
  return intensityBarClass(lvl)
})
const subBarRatio = computed(() => {
  if (!props.submetric || props.submetric.media_global === null || !subMeta.value?.metaHoras) return 0
  return Math.min(1, props.submetric.media_global / (subMeta.value.metaHoras * 2))
})
const subMeetsTarget = computed(() => {
  if (!props.submetric || props.submetric.media_global === null || !subMeta.value?.metaHoras) return false
  return props.submetric.media_global <= subMeta.value.metaHoras
})
</script>

<template>
  <BaseCard hover class="flex flex-col gap-4 animate-fade-in">
    <!-- Cabeçalho: ícone + título descritivo + aviso discreto -->
    <header class="flex items-start gap-3">
      <span class="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        <Icon :name="meta.icon" :size="18" />
      </span>
      <h2 class="min-w-0 flex-1 text-sm font-semibold text-text dark:text-text-dark leading-snug">
        {{ kpi.descricao }}
      </h2>
      <Tooltip v-if="meta.aviso || meta.nota" :text="meta.aviso ?? meta.nota ?? ''" />
    </header>

    <!-- Valor principal -->
    <div>
      <div v-if="kpi.media_global !== null" class="flex items-baseline gap-1.5">
        <span class="text-3xl font-bold font-mono tabular-nums text-text dark:text-text-dark">
          {{ formatDuration(kpi.media_global, kpi.unidade_tempo) }}
        </span>
      </div>
      <span v-else class="text-sm italic text-text-faint dark:text-text-dark-muted">sem dados no recorte</span>
      <p class="text-xs text-text-muted dark:text-text-dark-muted mt-1">
        {{ kpi.n_global > 0 ? `baseado em ${formatCount(kpi.n_global)} casos` : 'nenhum caso no recorte' }}
      </p>
    </div>

    <!-- Breakdown -->
    <KpiBreakdownBar v-if="kpi.breakdown.length > 0" :items="kpi.breakdown" :max-items="5" :unit="kpi.unidade_tempo" />

    <!-- Sub-métrica aninhada (KPI-07B: alta médica → saída, meta 4h) -->
    <div v-if="submetric" class="border-t border-border dark:border-border-dark pt-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-medium text-text-muted dark:text-text-dark-muted">{{ submetric.descricao }}</span>
        <span class="text-sm font-semibold font-mono tabular-nums text-text dark:text-text-dark">
          {{ formatDuration(submetric.media_global, submetric.unidade_tempo) }}
        </span>
      </div>
      <div class="mt-1.5 h-2 rounded-full bg-surface-offset dark:bg-surface-dark-offset overflow-hidden">
        <div class="h-full rounded-full transition-all duration-500" :class="subBarClass" :style="{ width: `${(subBarRatio * 100).toFixed(1)}%` }" />
      </div>
      <p class="mt-1 text-[11px]" :class="subMeetsTarget ? 'text-success' : 'text-warning'">
        meta: {{ subMeta?.metaHoras }}h · {{ subMeetsTarget ? 'dentro da meta' : 'acima da meta' }}
      </p>
    </div>
  </BaseCard>
</template>
