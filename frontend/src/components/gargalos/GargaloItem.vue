<script setup lang="ts">
import { computed } from 'vue'
import RankBar from '@/components/ui/RankBar.vue'
import { formatDuration, formatCount } from '@/lib/format'
import { intensityLevel, intensityBarClass } from '@/lib/intensity'
import { KPI_META } from '@/types/api.types'
import type { GargaloItem as GargaloItemType } from '@/types/api.types'

const props = defineProps<{ item: GargaloItemType; position: number; maxMedia: number }>()

const barClass = computed(() => intensityBarClass(intensityLevel(props.item.media, 0, props.maxMedia)))
const transicaoLabel = computed(() => KPI_META[props.item.transicao]?.label ?? props.item.transicao)
</script>

<template>
  <RankBar
    :position="position"
    :label="item.dimensao"
    :value="formatDuration(item.media, 'dias')"
    :ratio="maxMedia > 0 ? item.media / maxMedia : 0"
    :bar-class="barClass"
    :caption="`${transicaoLabel} · ${formatCount(item.n)} casos`"
  />
</template>
