<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useGargaloStore } from '@/stores/useGargaloStore'
import GargaloItem from './GargaloItem.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'

const gargaloStore = useGargaloStore()

const maxMedia = computed(() =>
  gargaloStore.items.length > 0
    ? Math.max(...gargaloStore.items.map((g) => g.media))
    : 1,
)

onMounted(() => {
  gargaloStore.initWatcher()
  if (gargaloStore.items.length === 0 && !gargaloStore.loading) {
    void gargaloStore.fetchGargalos()
  }
})
</script>

<template>
  <section>
    <!-- Loading -->
    <div v-if="gargaloStore.loading" class="space-y-2 p-4">
      <div
        v-for="i in 8"
        :key="i"
        class="h-12 rounded-xl bg-border dark:bg-border-dark animate-pulse-soft"
        :style="{ opacity: 1 - i * 0.08 }"
      />
    </div>

    <!-- Error -->
    <ErrorState
      v-else-if="gargaloStore.error"
      :message="gargaloStore.error"
      @retry="gargaloStore.fetchGargalos()"
    />

    <!-- Empty -->
    <EmptyState
      v-else-if="gargaloStore.items.length === 0"
      icon="🎉"
      title="Nenhum gargalo identificado"
      description="Não foram encontrados gargalos nos filtros selecionados."
    />

    <!-- Lista com stagger animation -->
    <div v-else class="space-y-1">
      <!-- Legenda de intensidade -->
      <div class="flex items-center gap-3 px-3 pb-2 border-b border-border dark:border-border-dark">
        <span class="text-xs text-text-muted dark:text-text-dark-muted">Intensidade:</span>
        <div class="flex items-center gap-3 text-xs">
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-danger" /> Crítico (≥80%)
          </span>
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-warning" /> Alto (≥60%)
          </span>
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-caution" /> Médio (≥40%)
          </span>
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-success" /> Baixo
          </span>
        </div>
      </div>

      <GargaloItem
        v-for="(item, idx) in gargaloStore.items"
        :key="`${item.dimensao}-${item.transicao}`"
        :item="item"
        :rank="idx + 1"
        :max-media="maxMedia"
        :style="{ animationDelay: `${idx * 60}ms` }"
        class="animate-slide-up"
      />

      <!-- Controle de limit -->
      <div class="pt-3 flex justify-center gap-2">
        <button
          v-for="n in [10, 20, 30]"
          :key="n"
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
          :class="gargaloStore.limit === n
            ? 'bg-primary text-white border-primary'
            : 'border-border dark:border-border-dark text-text-muted dark:text-text-dark-muted hover:border-primary hover:text-primary'"
          @click="gargaloStore.setLimit(n)"
        >
          Top {{ n }}
        </button>
      </div>
    </div>
  </section>
</template>
