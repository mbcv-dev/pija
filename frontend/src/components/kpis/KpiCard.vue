<script setup lang="ts">
import { computed, ref } from 'vue'
import type { KpiDistribuicao, KpiItem } from '@/types/api.types'
import { KPI_META } from '@/types/api.types'
import { formatDuration, formatCasos } from '@/lib/format'
import { intensityLevel, intensityBarClass } from '@/lib/intensity'
import BaseCard from '@/components/ui/BaseCard.vue'
import Icon from '@/components/ui/Icon.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import HistogramaTempos from './HistogramaTempos.vue'
import KpiBreakdownBar from './KpiBreakdownBar.vue'
import KpiDetailModal from './KpiDetailModal.vue'

/**
 * `dist`/`subDist` são OPCIONAIS de propósito: chegam por uma busca própria,
 * depois dos cards. Sem elas o card é exatamente o de antes do gráfico existir —
 * por isso também não há skeleton aqui (decisão da spec §3.2): o histograma
 * simplesmente aparece quando chega.
 */
const props = defineProps<{
  kpi: KpiItem
  submetric?: KpiItem
  dist?: KpiDistribuicao
  subDist?: KpiDistribuicao
}>()

const detalheAberto = ref(false)
const temDetalhe = computed(() => props.kpi.breakdown.length > 0)

const subDetalheAberto = ref(false)
const temSubDetalhe = computed(() => !!props.submetric && props.submetric.breakdown.length > 0)

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
  <BaseCard
    hover
    class="flex flex-col gap-4 animate-fade-in"
    :class="temDetalhe ? 'cursor-pointer' : ''"
    @click="temDetalhe && (detalheAberto = true)"
  >
    <!-- Cabeçalho: ícone + título descritivo + aviso discreto -->
    <header class="flex items-start gap-3">
      <span class="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        <Icon :name="meta.icon" :size="18" />
      </span>
      <h3 class="min-w-0 flex-1 text-sm font-semibold text-text dark:text-text-dark leading-snug">
        {{ kpi.descricao }}
      </h3>
      <span @click.stop>
        <Tooltip v-if="meta.aviso || meta.nota" :text="meta.aviso ?? meta.nota ?? ''" />
      </span>
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
        {{ kpi.n_global > 0 ? `baseado em ${formatCasos(kpi.n_global)}` : 'nenhum caso no recorte' }}
      </p>
    </div>

    <!--
      Histograma entre o valor principal e o breakdown: a mediana logo acima é o
      que ele qualifica. O `gap-4` do card já dá o respiro; a guarda de n_total
      evita reservar espaço para um gráfico que não desenharia nada.
    -->
    <HistogramaTempos v-if="dist && dist.n_total > 0" :dist="dist" />

    <!-- Breakdown -->
    <KpiBreakdownBar v-if="temDetalhe" :items="kpi.breakdown" :max-items="5" :unit="kpi.unidade_tempo" />

    <!-- Affordance de drill-down (abre lista completa: filtro + ordenação + paginação) -->
    <button
      v-if="temDetalhe"
      type="button"
      class="self-start inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
      @click.stop="detalheAberto = true"
    >
      Ver todas as {{ kpi.breakdown.length }} dimensões
      <Icon name="chevron" :size="13" />
    </button>

    <!-- Sub-métrica aninhada (KPI-07B: alta médica → saída, meta 4h) -->
    <div v-if="submetric" data-submetrica class="border-t border-border dark:border-border-dark pt-3">
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
      <!--
        Caso-âncora do gráfico: a mediana do 07B lê "< 1 min" e a barra de meta
        diz "dentro da meta" — só o histograma mostra a cauda de horas que as
        duas escondem. Vem logo depois delas, no mesmo ritmo vertical do bloco.
      -->
      <div v-if="subDist && subDist.n_total > 0" class="mt-2">
        <HistogramaTempos :dist="subDist" />
      </div>
      <button
        v-if="temSubDetalhe"
        type="button"
        class="mt-2 self-start inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
        @click.stop="subDetalheAberto = true"
      >
        Ver todas as {{ submetric!.breakdown.length }} dimensões
        <Icon name="chevron" :size="13" />
      </button>
    </div>

    <!-- Drill-down da sub-métrica (KPI-07B) — mesma lista completa das outras KPIs -->
    <KpiDetailModal v-if="subDetalheAberto && submetric" :kpi="submetric" @close="subDetalheAberto = false" />

    <!-- Drill-down: lista completa do breakdown (Teleport → body, não dispara o click do card) -->
    <KpiDetailModal v-if="detalheAberto" :kpi="kpi" @close="detalheAberto = false" />
  </BaseCard>
</template>
