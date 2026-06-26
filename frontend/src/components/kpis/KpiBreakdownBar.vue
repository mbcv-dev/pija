<script setup lang="ts">
import { computed } from 'vue'
import type { BreakdownItem } from '@/types/api.types'

const props = defineProps<{
  items: BreakdownItem[]
  maxItems?: number
}>()

const maxItems = computed(() => props.maxItems ?? 6)
const displayed = computed(() => props.items.slice(0, maxItems.value))

const maxMedia = computed(() =>
  displayed.value.length > 0
    ? Math.max(...displayed.value.map((i) => i.media))
    : 1,
)

function barWidth(media: number): string {
  const pct = maxMedia.value > 0 ? (media / maxMedia.value) * 100 : 0
  return `${Math.max(pct, 2)}%`
}

function formatMedia(m: number): string {
  return m % 1 === 0 ? `${m}d` : `${m.toFixed(1)}d`
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="item in displayed"
      :key="item.dimensao"
      class="flex items-center gap-2 group"
    >
      <!-- Nome da dimensão -->
      <div
        class="w-28 flex-shrink-0 text-xs text-text-muted dark:text-text-dark-muted
               truncate group-hover:text-text dark:group-hover:text-text-dark transition-colors"
        :title="item.dimensao"
      >
        {{ item.dimensao }}
      </div>

      <!-- Barra -->
      <div class="flex-1 h-2.5 bg-surface-offset dark:bg-surface-dark-offset rounded-full overflow-hidden">
        <div
          class="h-full bg-primary/70 rounded-full transition-all duration-700 ease-out"
          :style="{ width: barWidth(item.media) }"
        />
      </div>

      <!-- Valor -->
      <div class="w-9 flex-shrink-0 text-right text-xs font-mono font-medium text-text dark:text-text-dark">
        {{ formatMedia(item.media) }}
      </div>
    </div>

    <!-- Indicador "e mais N..." -->
    <p
      v-if="items.length > maxItems"
      class="text-xs text-text-faint dark:text-text-dark-muted text-right"
    >
      e mais {{ items.length - maxItems }} dimensões
    </p>
  </div>
</template>
