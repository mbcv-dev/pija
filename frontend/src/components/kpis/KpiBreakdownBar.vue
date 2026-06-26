<script setup lang="ts">
import { computed } from 'vue'
import BarRow from '@/components/ui/BarRow.vue'
import { formatDuration } from '@/lib/format'
import type { BreakdownItem } from '@/types/api.types'

const props = withDefaults(defineProps<{ items: BreakdownItem[]; maxItems?: number; unit?: 'dias' | 'horas' }>(), {
  maxItems: 5, unit: 'dias',
})

const top = computed(() => props.items.slice(0, props.maxItems))
const max = computed(() => Math.max(...props.items.map((i) => i.media), 0.0001))
</script>

<template>
  <div class="flex flex-col gap-2">
    <BarRow
      v-for="item in top" :key="item.dimensao"
      :label="item.dimensao"
      :value="formatDuration(item.media, unit)"
      :ratio="item.media / max"
    />
  </div>
</template>
