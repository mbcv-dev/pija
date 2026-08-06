<script setup lang="ts">
import { computed } from 'vue'
import RankBar from '@/components/ui/RankBar.vue'
import { formatDuration, formatCasos } from '@/lib/format'
import { KPI_META } from '@/types/api.types'
import type { GargaloItem as GargaloItemType } from '@/types/api.types'

const props = defineProps<{ item: GargaloItemType; position: number; maxMedia: number }>()

/**
 * Cor única, de propósito. A escala por magnitude que existia aqui afirmava
 * "tempo maior = pior", e isso nem sempre é verdade: parte das unidades leva
 * mais tempo pela natureza do que faz, e isso é o hospital funcionando. O
 * comprimento da barra continua codificando o tempo — a informação não se
 * perde, só deixa de vir com julgamento embutido.
 */
const BARRA = 'bg-primary dark:bg-accent'

const transicaoLabel = computed(() => KPI_META[props.item.transicao]?.label ?? props.item.transicao)
</script>

<template>
  <RankBar
    :position="position"
    :label="item.dimensao"
    :value="formatDuration(item.media, 'dias')"
    :ratio="maxMedia > 0 ? item.media / maxMedia : 0"
    :bar-class="BARRA"
    :caption="`${transicaoLabel} · ${formatCasos(item.n)}`"
  />
</template>
