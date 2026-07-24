<script setup lang="ts">
import { onMounted } from 'vue'
import { useCiclicidadeStore } from '@/stores/useCiclicidadeStore'
import FilterBar from '@/components/ui/FilterBar.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import TransitionMatrix from '@/components/ciclicidade/TransitionMatrix.vue'

const store = useCiclicidadeStore()

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
    <BaseCard>
      <Skeleton v-if="store.loading" height="h-64" />
      <ErrorState v-else-if="store.error" :message="store.error" @retry="store.fetch" />
      <EmptyState
        v-else-if="store.transicoes.length === 0"
        title="Sem transições"
        description="Nenhuma transição encontrada para esta coorte."
      />
      <TransitionMatrix v-else :nos="store.nos" :transicoes="store.transicoes" />
    </BaseCard>
  </div>
</template>
