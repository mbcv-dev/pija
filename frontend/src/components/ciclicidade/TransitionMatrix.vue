<script setup lang="ts">
import { computed } from 'vue'
import type { NoItem, TransicaoItem } from '@/types/api.types'

const props = defineProps<{ nos: NoItem[]; transicoes: TransicaoItem[] }>()

// Ordem fixa das etapas (as presentes nos dados, na ordem canônica da jornada).
const ORDEM = ['PRONTUARIO', 'CONSULTA', 'PROCEDIMENTO', 'EXAME', 'INTERNACAO', 'CIRURGIA', 'ALTA']
const tipos = computed(() => {
  const presentes = new Set(props.nos.map((n) => n.tipo))
  return ORDEM.filter((t) => presentes.has(t as never))
})

const mapa = computed(() => {
  const m = new Map<string, TransicaoItem>()
  for (const t of props.transicoes) m.set(`${t.origem}→${t.destino}`, t)
  return m
})
const maxVol = computed(() => Math.max(1, ...props.transicoes.map((t) => t.volume)))

function cell(origem: string, destino: string): TransicaoItem | undefined {
  return mapa.value.get(`${origem}→${destino}`)
}
function intensidade(vol: number): number {
  return 0.12 + 0.88 * (vol / maxVol.value) // 0.12–1.0 (evita célula invisível)
}
function tempoLabel(s: number | null): string {
  if (s === null) return 'tempo n/d'
  const dias = s / 86400
  return dias >= 1 ? `${dias.toFixed(1)} d` : `${(s / 3600).toFixed(1)} h`
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="border-collapse text-xs">
      <thead>
        <tr>
          <th class="p-2 text-left text-text-muted dark:text-text-dark-muted">de \ para</th>
          <th v-for="d in tipos" :key="d" class="p-2 font-medium text-text dark:text-text-dark whitespace-nowrap">{{ d }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="o in tipos" :key="o">
          <th class="p-2 text-left font-medium text-text dark:text-text-dark whitespace-nowrap">{{ o }}</th>
          <td v-for="d in tipos" :key="d" class="p-0">
            <div
              class="h-10 w-16 flex items-center justify-center rounded"
              :class="cell(o, d) ? 'text-white font-semibold' : 'text-text-faint'"
              :style="cell(o, d) ? { backgroundColor: `rgba(37, 99, 235, ${intensidade(cell(o, d)!.volume)})` } : {}"
              :title="cell(o, d) ? `${o} → ${d}: ${cell(o, d)!.volume} · ${tempoLabel(cell(o, d)!.tempo_medio_s)}` : ''"
            >
              {{ cell(o, d)?.volume ?? '·' }}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
