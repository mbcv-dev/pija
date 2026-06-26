<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { KpiItem } from '@/types/api.types'
import { KPI_META } from '@/types/api.types'
import KpiBreakdownBar from './KpiBreakdownBar.vue'

const props = defineProps<{
  kpi: KpiItem
}>()

// ── Count-up animation ────────────────────────────────────────

const displayValue = ref<number | null>(null)
const animating    = ref(false)

function animateCountUp(target: number | null): void {
  if (target === null) {
    displayValue.value = null
    return
  }

  animating.value = true
  const duration  = 600
  const steps     = 30
  const stepMs    = duration / steps
  const increment = target / steps
  let current     = 0
  let step        = 0

  const timer = setInterval(() => {
    step++
    current = step >= steps ? target : increment * step
    displayValue.value = +current.toFixed(1)
    if (step >= steps) {
      clearInterval(timer)
      animating.value = false
    }
  }, stepMs)
}

onMounted(() => animateCountUp(props.kpi.media_global))
watch(() => props.kpi.media_global, (val) => animateCountUp(val))

// ── Helpers ───────────────────────────────────────────────────

const meta = KPI_META[props.kpi.codigo]

function formatN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)} mil`
  return String(n)
}

function formatMedia(v: number): string {
  return v % 1 === 0 ? `${v}` : v.toFixed(1)
}
</script>

<template>
  <article
    class="rounded-2xl border border-border dark:border-border-dark
           bg-surface dark:bg-surface-dark shadow-card
           hover:shadow-card-hover hover:-translate-y-0.5
           transition-all duration-300 p-5 flex flex-col gap-4 animate-fade-in"
  >
    <!-- Cabeçalho: código + título -->
    <header class="flex items-start gap-3">
      <div
        class="flex-shrink-0 w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/20
               flex items-center justify-center text-lg leading-none"
      >
        {{ meta.icon }}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span
            class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold
                   bg-primary/10 text-primary tracking-wide"
          >
            {{ kpi.codigo }}
          </span>
          <!-- Badge de aviso KPI-05 -->
          <span
            v-if="meta.aviso"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]
                   bg-caution/10 text-caution"
            :title="meta.aviso"
          >
            ⚠️ dados limitados
          </span>
        </div>
        <h2
          class="mt-1 text-sm font-semibold text-text dark:text-text-dark leading-snug"
        >
          {{ meta.label }}
        </h2>
      </div>
    </header>

    <!-- Número principal -->
    <div>
      <div v-if="kpi.media_global !== null" class="flex items-baseline gap-1.5">
        <span
          class="text-3xl font-bold text-text dark:text-text-dark tabular-nums"
          :class="{ 'animate-count-up': animating }"
        >
          {{ displayValue !== null ? formatMedia(displayValue) : '—' }}
        </span>
        <span class="text-sm text-text-muted dark:text-text-dark-muted">dias</span>
      </div>
      <!-- Estado sem dados -->
      <div
        v-else
        class="flex items-center gap-2 py-1"
      >
        <span class="text-2xl font-bold text-text-faint dark:text-text-dark-muted">—</span>
        <span class="text-xs text-text-faint dark:text-text-dark-muted italic">sem dados</span>
      </div>

      <!-- Baseado em N casos -->
      <p class="text-xs text-text-muted dark:text-text-dark-muted mt-0.5">
        <template v-if="kpi.n_global > 0">
          baseado em {{ formatN(kpi.n_global) }} casos
        </template>
        <template v-else>
          nenhum caso no recorte
        </template>
      </p>
    </div>

    <!-- Breakdown -->
    <div v-if="kpi.breakdown.length > 0">
      <div class="flex items-center gap-2 mb-2.5">
        <div class="flex-1 h-px bg-border dark:bg-border-dark" />
        <span class="text-[10px] font-semibold text-text-faint dark:text-text-dark-muted uppercase tracking-widest">
          Breakdown
        </span>
        <div class="flex-1 h-px bg-border dark:bg-border-dark" />
      </div>
      <KpiBreakdownBar :items="kpi.breakdown" :max-items="5" />
    </div>

    <!-- Nota de rodapé KPI-07 -->
    <p
      v-if="meta.nota"
      class="text-[11px] text-text-faint dark:text-text-dark-muted italic border-t border-border dark:border-border-dark pt-2"
    >
      ℹ️ {{ meta.nota }}
    </p>
  </article>
</template>
