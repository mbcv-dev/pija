<script setup lang="ts">
import { KPI_META } from '@/types/api.types'
import type { KpiCode } from '@/types/api.types'
import BaseCard from '@/components/ui/BaseCard.vue'
import Icon from '@/components/ui/Icon.vue'

// Ordem de exibição dos KPIs
const ordem: KpiCode[] = ['KPI-01', 'KPI-03', 'KPI-05', 'KPI-06', 'KPI-07', 'KPI-07B']
const kpis = ordem.map((codigo) => ({ codigo, ...KPI_META[codigo] }))
</script>

<template>
  <div class="flex flex-col gap-6 max-w-3xl">
    <div>
      <h1 class="text-2xl font-bold text-text dark:text-text-dark tracking-tight">Como calculamos</h1>
      <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">
        Metodologia de cada indicador — âncora (de → até), unidade de tempo e regras de inclusão.
      </p>
    </div>

    <BaseCard v-for="kpi in kpis" :key="kpi.codigo" class="flex flex-col gap-3">
      <header class="flex items-start gap-3">
        <span class="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon :name="kpi.icon" :size="18" />
        </span>
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-text dark:text-text-dark leading-snug">{{ kpi.label }}</h2>
          <p class="text-xs text-text-faint dark:text-text-dark-muted font-mono">
            {{ kpi.codigo }} · em {{ kpi.unidadeTempo }}
          </p>
        </div>
      </header>

      <dl class="flex flex-col gap-2 pl-12 text-sm">
        <div>
          <dt class="text-xs font-medium text-text-muted dark:text-text-dark-muted">Âncora</dt>
          <dd class="text-text dark:text-text-dark">{{ kpi.ancora }}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium text-text-muted dark:text-text-dark-muted">Regras</dt>
          <dd class="text-text dark:text-text-dark">{{ kpi.regras }}</dd>
        </div>
      </dl>
    </BaseCard>

    <p class="text-xs text-text-faint dark:text-text-dark-muted">
      As médias são calculadas sobre toda a base, respeitando os filtros aplicados no Dashboard e nos Gargalos.
    </p>
  </div>
</template>
