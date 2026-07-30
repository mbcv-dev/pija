<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useCiclicidadeStore } from '@/stores/useCiclicidadeStore'
import Icon from '@/components/ui/Icon.vue'
import FilterBar from '@/components/ui/FilterBar.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import TransitionMatrix from '@/components/ciclicidade/TransitionMatrix.vue'
import TransitionGraph from '@/components/ciclicidade/TransitionGraph.vue'

type Modo = 'grafo' | 'matriz'

const store = useCiclicidadeStore()
const modo = ref<Modo>('grafo')
const opcoes: { value: Modo; label: string }[] = [
  { value: 'grafo', label: 'Grafo' },
  { value: 'matriz', label: 'Matriz' },
]

onMounted(() => {
  store.initWatcher()
  void store.fetch()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-text dark:text-text-dark tracking-tight">Ciclicidade da jornada</h1>
      <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">
        Fluxo agregado das transições entre etapas · coorte definida pelos filtros
      </p>
    </div>
    <FilterBar />
    <div class="flex justify-end">
      <SegmentedControl
        :model-value="modo"
        :options="opcoes"
        @update:model-value="modo = $event as Modo"
      />
    </div>
    <BaseCard>
      <Skeleton v-if="store.loading" height="h-64" />
      <ErrorState v-else-if="store.error" :message="store.error" @retry="store.fetch" />
      <EmptyState
        v-else-if="store.transicoes.length === 0"
        title="Sem transições"
        description="Nenhuma transição encontrada para esta coorte."
      />
      <TransitionGraph v-else-if="modo === 'grafo'" :nos="store.nos" :transicoes="store.transicoes" />
      <TransitionMatrix v-else :nos="store.nos" :transicoes="store.transicoes" />
    </BaseCard>
    <p class="flex items-start gap-1.5 text-xs text-text-muted dark:text-text-dark-muted -mt-2">
      <Icon name="info" :size="14" class="shrink-0 mt-[1px]" />
      <span>
        O número na seta conta <strong>transições</strong> (idas de uma etapa à seguinte), não eventos. Para exames,
        cada item do pedido conta como um evento — por isso Exame → Exame aparece alto, com tempo curto.
        <RouterLink to="/metodologia" class="text-primary dark:text-accent hover:underline">Ver metodologia</RouterLink>
      </span>
    </p>
  </div>
</template>
