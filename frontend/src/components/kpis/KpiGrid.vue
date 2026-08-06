<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useKpiStore } from '@/stores/useKpiStore'
import { AREAS_JORNADA } from '@/lib/areas'
// Onde a seção para ao rolar: abaixo do header + barra de áreas (ver lib/layout.ts).
import { SCROLL_MARGIN_PX } from '@/lib/layout'
import type { KpiCode, KpiItem } from '@/types/api.types'
import KpiCard from './KpiCard.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Icon from '@/components/ui/Icon.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const store = useKpiStore()

const porCodigo = computed(() => new Map(store.kpis.map((k) => [k.codigo, k])))

/**
 * Qual KPI é submétrica de qual. Renderiza dentro do card do "pai", não como
 * card próprio — por isso nenhum destes aparece em `AREAS_JORNADA[].kpis`.
 * Virou mapa quando o segundo par (cirurgia) chegou; com um só, três literais
 * espalhados ainda cabiam na cabeça.
 */
const SUBMETRICA_DE: Partial<Record<KpiCode, KpiCode>> = {
  'KPI-07': 'KPI-07B',
  'KPI-10': 'KPI-10B',
}

const submetricaDe = (codigo: KpiCode) => {
  const sub = SUBMETRICA_DE[codigo]
  return sub ? porCodigo.value.get(sub) : undefined
}

/** Áreas com os KPIs já resolvidos a partir da resposta da API (ausentes são pulados). */
const areasComCards = computed(() =>
  AREAS_JORNADA.map((area) => ({
    area,
    cards: area.kpis.reduce<KpiItem[]>((acc, codigo) => {
      const kpi = porCodigo.value.get(codigo)
      if (kpi) acc.push(kpi)
      return acc
    }, []),
  })),
)

const nenhumKpi = computed(() => areasComCards.value.every(({ cards }) => cards.length === 0))

/**
 * Distribuição de um KPI, ou `undefined` enquanto ela não chegou (ou se falhou).
 * O histograma é enhancement: o card renderiza igual com ou sem ela, então aqui
 * não há espera nem estado de erro — só a ausência do gráfico.
 */
const distDe = (codigo: KpiCode) => store.distribuicoes.get(codigo)

const subDistDe = (codigo: KpiCode) => {
  const sub = SUBMETRICA_DE[codigo]
  return sub ? distDe(sub) : undefined
}

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
    <EmptyState v-else-if="nenhumKpi" title="Sem KPIs no recorte" description="Ajuste os filtros para ver os indicadores." />

    <div v-else class="flex flex-col gap-8">
      <section
        v-for="{ area, cards } in areasComCards" :key="area.id"
        :id="`area-${area.id}`" :data-area="area.id"
        :style="{ scrollMarginTop: `${SCROLL_MARGIN_PX}px` }"
        class="flex flex-col gap-3"
      >
        <header class="flex items-start gap-3">
          <span class="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon :name="area.icon" :size="18" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="text-base font-bold text-text dark:text-text-dark leading-snug">{{ area.label }}</h2>
            <p class="text-xs text-text-muted dark:text-text-dark-muted">{{ area.descricao }}</p>
          </div>
          <RouterLink
            v-if="area.gargalosKpi"
            :to="{ path: '/gargalos', query: { kpi: area.gargalosKpi } }"
            :aria-label="`Ver gargalos de ${area.label}`"
            class="shrink-0 text-xs font-medium text-primary dark:text-accent hover:underline whitespace-nowrap"
          >
            Ver gargalos →
          </RouterLink>
        </header>

        <div v-if="cards.length > 0" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            v-for="kpi in cards" :key="kpi.codigo" :kpi="kpi"
            :submetric="submetricaDe(kpi.codigo)"
            :dist="distDe(kpi.codigo)"
            :sub-dist="subDistDe(kpi.codigo)"
          />
        </div>
        <!--
          Toda área já tem KPI mapeado, mas `cards` vem da RESPOSTA: quando o
          recorte não devolve o código da área, a seção fica sem card. O texto
          fala do recorte — prometer roadmap aqui seria mentira desde o KPI-10.
        -->
        <BaseCard v-else>
          <EmptyState
            :icon="area.icon"
            title="Sem indicadores nesta área no recorte"
            description="Nenhum dos indicadores desta etapa da jornada veio na resposta. Ajuste os filtros."
          />
        </BaseCard>
      </section>
    </div>
  </div>
</template>
