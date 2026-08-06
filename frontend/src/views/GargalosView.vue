<script setup lang="ts">
import FilterBar from '@/components/ui/FilterBar.vue'
import GargaloList from '@/components/gargalos/GargaloList.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-text dark:text-text-dark tracking-tight">Gargalos</h1>
      <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">
        Ranking dos piores tempos médios · pior para o melhor
      </p>
      <!-- Mesma ressalva que motivou tirar a cor por magnitude do ranking: a ordem
           é por tempo, não por culpa. Quem lê o ranking é quem precisa saber disso. -->
      <p class="text-xs text-text-muted dark:text-text-dark-muted max-w-prose mt-2">
        Ordenado por tempo médio. Tempo maior não significa necessariamente gargalo — parte das
        unidades leva mais tempo pela natureza do que faz.
      </p>
    </div>
    <FilterBar />
    <BaseCard :padding="false" class="overflow-hidden">
      <GargaloList />
    </BaseCard>
  </div>
</template>
