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
        Os tempos usam a <strong>mediana (p50)</strong>: metade dos casos fica abaixo do valor mostrado.
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
      As medianas são calculadas sobre toda a base, respeitando os filtros aplicados no Dashboard e nos Gargalos.
    </p>

    <BaseCard class="flex flex-col gap-3">
      <header class="flex items-start gap-3">
        <span class="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon name="ciclicidade" :size="18" />
        </span>
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-text dark:text-text-dark leading-snug">
            Ciclicidade — o que os números do grafo significam
          </h2>
          <p class="text-xs text-text-faint dark:text-text-dark-muted font-mono">grafo e matriz de transições</p>
        </div>
      </header>

      <dl class="flex flex-col gap-2 pl-12 text-sm">
        <div>
          <dt class="text-xs font-medium text-text-muted dark:text-text-dark-muted">O que é contado</dt>
          <dd class="text-text dark:text-text-dark">
            Cada linha da base é um <strong>evento</strong> (uma consulta, um exame, uma internação…). O número na
            seta é a quantidade de <strong>transições</strong> — idas de uma etapa à etapa seguinte na linha do tempo
            de cada paciente —, não o total de eventos.
          </dd>
        </div>
        <div>
          <dt class="text-xs font-medium text-text-muted dark:text-text-dark-muted">Por que Exame → Exame aparece tão alto</dt>
          <dd class="text-text dark:text-text-dark">
            Para exames, cada <strong>item</strong> conta como um evento: um único pedido (ex.: painel laboratorial)
            pode gerar vários itens com horários minutos entre si. Cada par consecutivo vira uma transição
            Exame → Exame — por isso o volume é alto e o tempo médio é curto. É uma característica do dado de
            origem, mantida de propósito para não descartar informação.
          </dd>
        </div>
        <div>
          <dt class="text-xs font-medium text-text-muted dark:text-text-dark-muted">Tempo na seta</dt>
          <dd class="text-text dark:text-text-dark">
            Tempo médio entre o evento de origem e o de destino, calculado sobre todas as transições daquele par
            na coorte filtrada.
          </dd>
        </div>
      </dl>
    </BaseCard>
  </div>
</template>
