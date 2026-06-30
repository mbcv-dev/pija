<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { KpiItem } from '@/types/api.types'
import { KPI_META } from '@/types/api.types'
import { formatDuration, formatCount } from '@/lib/format'
import { intensityLevel, intensityBarClass } from '@/lib/intensity'
import Icon from '@/components/ui/Icon.vue'
import RankBar from '@/components/ui/RankBar.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const props = defineProps<{ kpi: KpiItem }>()
const emit = defineEmits<{ close: [] }>()

const PAGE_SIZE = 8

const busca = ref('')
const ordem = ref<'desc' | 'asc'>('desc') // desc = maior tempo primeiro (default)
const pagina = ref(1)

const meta = computed(() => KPI_META[props.kpi.codigo])

// Máximo sobre o breakdown completo → barras comparáveis entre páginas.
const maxMedia = computed(() => Math.max(...props.kpi.breakdown.map((i) => i.media), 0.0001))

const filtrados = computed(() => {
  const termo = busca.value.trim().toLowerCase()
  const base = termo
    ? props.kpi.breakdown.filter((i) => i.dimensao.toLowerCase().includes(termo))
    : props.kpi.breakdown
  const fator = ordem.value === 'asc' ? 1 : -1
  return [...base].sort((a, b) => (a.media - b.media) * fator)
})

const totalPaginas = computed(() => Math.max(1, Math.ceil(filtrados.value.length / PAGE_SIZE)))
const inicio = computed(() => (pagina.value - 1) * PAGE_SIZE)
const paginados = computed(() => filtrados.value.slice(inicio.value, inicio.value + PAGE_SIZE))

// Reset de página quando o recorte muda.
watch([busca, ordem], () => { pagina.value = 1 })
// Clamp se a lista encolher.
watch(totalPaginas, (t) => { if (pagina.value > t) pagina.value = t })

function barClass(media: number): string {
  return intensityBarClass(intensityLevel(media, 0, maxMedia.value))
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      @click.self="emit('close')"
    >
      <div
        role="dialog" aria-modal="true" :aria-label="kpi.descricao"
        class="flex w-full sm:max-w-lg max-h-[90vh] flex-col rounded-t-2xl sm:rounded-2xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark shadow-card-hover"
      >
        <!-- Cabeçalho -->
        <header class="flex items-start gap-3 px-5 py-4 border-b border-border dark:border-border-dark">
          <span class="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon :name="meta.icon" :size="18" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="text-sm font-semibold text-text dark:text-text-dark leading-snug">{{ kpi.descricao }}</h2>
            <p class="text-xs text-text-muted dark:text-text-dark-muted mt-0.5">
              <span class="font-mono tabular-nums font-semibold text-text dark:text-text-dark">{{ formatDuration(kpi.media_global, kpi.unidade_tempo) }}</span>
              · {{ formatCount(kpi.n_global) }} casos · {{ kpi.breakdown.length }} dimensões
            </p>
          </div>
          <button
            type="button" aria-label="Fechar"
            class="shrink-0 text-text-faint hover:text-text dark:text-text-dark-muted dark:hover:text-text-dark transition-colors"
            @click="emit('close')"
          >
            <Icon name="close" :size="20" />
          </button>
        </header>

        <!-- Controles: busca + ordenação -->
        <div class="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border dark:border-border-dark">
          <div class="relative flex-1 min-w-[10rem]">
            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint dark:text-text-dark-muted">
              <Icon name="search" :size="15" />
            </span>
            <input
              v-model="busca" type="text" placeholder="Filtrar dimensão…"
              class="w-full pl-8 pr-3 py-1.5 rounded-xl text-sm bg-surface-offset dark:bg-surface-dark-offset border border-transparent focus:border-primary focus:outline-none text-text dark:text-text-dark placeholder:text-text-faint dark:placeholder:text-text-dark-muted"
            />
          </div>
          <SegmentedControl
            :model-value="ordem"
            :options="[{ value: 'desc', label: 'Maior tempo' }, { value: 'asc', label: 'Menor tempo' }]"
            @update:model-value="ordem = $event as 'desc' | 'asc'"
          />
        </div>

        <!-- Lista -->
        <div class="flex-1 overflow-y-auto">
          <EmptyState
            v-if="filtrados.length === 0"
            title="Nenhuma dimensão" description="Nenhum resultado para o filtro." icon="gargalos"
          />
          <RankBar
            v-for="(item, idx) in paginados" :key="item.dimensao"
            :position="inicio + idx + 1"
            :label="item.dimensao"
            :value="formatDuration(item.media, kpi.unidade_tempo)"
            :ratio="item.media / maxMedia"
            :bar-class="barClass(item.media)"
            :caption="`${formatCount(item.n)} casos`"
          />
        </div>

        <!-- Paginação -->
        <footer
          v-if="filtrados.length > 0"
          class="flex items-center justify-between gap-2 px-5 py-3 border-t border-border dark:border-border-dark"
        >
          <span class="text-xs text-text-muted dark:text-text-dark-muted tabular-nums">
            {{ inicio + 1 }}–{{ Math.min(inicio + PAGE_SIZE, filtrados.length) }} de {{ filtrados.length }}
          </span>
          <div class="flex items-center gap-1">
            <button
              type="button" aria-label="Página anterior" :disabled="pagina <= 1"
              class="p-1.5 rounded-lg text-text-muted dark:text-text-dark-muted hover:bg-surface-offset dark:hover:bg-surface-dark-offset disabled:opacity-40 disabled:pointer-events-none transition-colors"
              @click="pagina--"
            >
              <Icon name="chevron" :size="16" class="rotate-180" />
            </button>
            <span class="text-xs font-medium text-text dark:text-text-dark tabular-nums px-1">{{ pagina }}/{{ totalPaginas }}</span>
            <button
              type="button" aria-label="Próxima página" :disabled="pagina >= totalPaginas"
              class="p-1.5 rounded-lg text-text-muted dark:text-text-dark-muted hover:bg-surface-offset dark:hover:bg-surface-dark-offset disabled:opacity-40 disabled:pointer-events-none transition-colors"
              @click="pagina++"
            >
              <Icon name="chevron" :size="16" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
