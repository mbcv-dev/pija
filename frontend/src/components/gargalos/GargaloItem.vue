<script setup lang="ts">
import { computed } from 'vue'
import type { GargaloItem } from '@/types/api.types'
import { KPI_META } from '@/types/api.types'

const props = defineProps<{
  item: GargaloItem
  rank: number
  maxMedia: number
}>()

// ── Cor por intensidade ────────────────────────────────────────
// Thresholds baseados na media relativa ao máximo do ranking

function getIntensityColor(media: number, max: number): {
  bar: string
  text: string
  bg: string
  label: string
} {
  if (max === 0) return { bar: 'bg-success', text: 'text-success', bg: 'bg-success/10', label: 'Normal' }
  const ratio = media / max

  if (ratio >= 0.8) return { bar: 'bg-danger',  text: 'text-danger',  bg: 'bg-danger/10',  label: 'Crítico' }
  if (ratio >= 0.6) return { bar: 'bg-warning',  text: 'text-warning', bg: 'bg-warning/10', label: 'Alto' }
  if (ratio >= 0.4) return { bar: 'bg-caution',  text: 'text-caution', bg: 'bg-caution/10', label: 'Médio' }
  return { bar: 'bg-success', text: 'text-success', bg: 'bg-success/10', label: 'Baixo' }
}

const intensity = computed(() => getIntensityColor(props.item.media, props.maxMedia))
const barWidth  = computed(() => {
  const pct = props.maxMedia > 0 ? (props.item.media / props.maxMedia) * 100 : 0
  return `${Math.max(pct, 3)}%`
})

const kpiMeta = KPI_META[props.item.transicao]

function formatMedia(m: number): string {
  return m % 1 === 0 ? `${m}d` : `${m.toFixed(1)}d`
}

function formatN(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k casos`
  return `${n} casos`
}
</script>

<template>
  <div
    class="flex items-center gap-3 p-3 rounded-xl
           hover:bg-surface-offset dark:hover:bg-surface-dark-offset
           transition-colors duration-150 group"
  >
    <!-- Rank -->
    <div
      class="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
             text-xs font-bold"
      :class="rank <= 3
        ? `${intensity.bg} ${intensity.text}`
        : 'bg-surface-offset dark:bg-surface-dark-offset text-text-muted dark:text-text-dark-muted'"
    >
      {{ rank }}
    </div>

    <!-- Dimensão + KPI -->
    <div class="flex flex-col min-w-0 w-40 flex-shrink-0">
      <span
        class="text-sm font-semibold text-text dark:text-text-dark truncate"
        :title="item.dimensao"
      >
        {{ item.dimensao }}
      </span>
      <span class="text-[11px] text-text-muted dark:text-text-dark-muted flex items-center gap-1">
        <span>{{ kpiMeta.icon }}</span>
        {{ item.transicao }} · {{ kpiMeta.label }}
      </span>
    </div>

    <!-- Barra de intensidade -->
    <div class="flex-1 h-3 bg-surface-offset dark:bg-surface-dark-offset rounded-full overflow-hidden">
      <div
        class="h-full rounded-full transition-all duration-700 ease-out"
        :class="intensity.bar"
        :style="{ width: barWidth }"
      />
    </div>

    <!-- Valor + badge de nível -->
    <div class="flex-shrink-0 flex items-center gap-2 ml-1">
      <span
        class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
        :class="`${intensity.bg} ${intensity.text}`"
      >
        {{ intensity.label }}
      </span>
      <span class="text-sm font-bold font-mono" :class="intensity.text">
        {{ formatMedia(item.media) }}
      </span>
    </div>

    <!-- N (tooltip-like, visível em hover) -->
    <div
      class="flex-shrink-0 text-[11px] text-text-faint dark:text-text-dark-muted
             opacity-0 group-hover:opacity-100 transition-opacity w-16 text-right"
    >
      {{ formatN(item.n) }}
    </div>
  </div>
</template>
