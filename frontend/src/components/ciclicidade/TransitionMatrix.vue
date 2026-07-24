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

// Escala sequencial de hue único (azul da marca), light→dark, em degraus DISCRETOS.
// Cada degrau é sólido (não usa alpha sobre a superfície, portanto legível em light e
// dark de forma idêntica) e traz a tinta de texto validada em ≥ 4.5:1 de contraste.
// Os degraus pulam a faixa de luminância intermediária onde nenhuma tinta atingiria 4.5.
const STEPS = [
  { bg: '#CDDCEA', ink: '#14223A' }, // muito baixo  (contraste 11.4)
  { bg: '#A9C4DC', ink: '#14223A' }, // baixo        (8.8)
  { bg: '#7B9EBD', ink: '#14223A' }, // médio        (5.7)
  { bg: '#3A6D99', ink: '#FFFFFF' }, // alto         (5.5)
  { bg: '#0F4C81', ink: '#FFFFFF' }, // máximo       (8.9)
] as const

function cell(origem: string, destino: string): TransicaoItem | undefined {
  return mapa.value.get(`${origem}→${destino}`)
}
function step(vol: number): (typeof STEPS)[number] {
  // buckets iguais: (0,0.2]→0 (0.2,0.4]→1 (0.4,0.6]→2 (0.6,0.8]→3 (0.8,1]→4
  const t = vol / maxVol.value // 0–1
  const i = Math.min(STEPS.length - 1, Math.max(0, Math.ceil(t * STEPS.length) - 1))
  return STEPS[i]
}
function tempoLabel(s: number | null): string {
  if (s === null) return 'tempo n/d'
  const dias = s / 86400
  return dias >= 1 ? `${dias.toFixed(1)} d` : `${(s / 3600).toFixed(1)} h`
}
</script>

<template>
  <div class="flex flex-col gap-3">
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
            <td v-for="d in tipos" :key="d" class="p-0.5">
              <div
                class="h-10 w-16 flex items-center justify-center rounded transition-transform duration-100 hover:scale-105 hover:ring-2 hover:ring-primary/40 dark:hover:ring-accent/40"
                :class="cell(o, d) ? 'font-semibold' : 'text-text-faint dark:text-text-dark-muted bg-surface-offset/40 dark:bg-surface-dark-offset/40'"
                :style="cell(o, d) ? { backgroundColor: step(cell(o, d)!.volume).bg, color: step(cell(o, d)!.volume).ink } : {}"
                :title="cell(o, d) ? `${o} → ${d}: ${cell(o, d)!.volume} · ${tempoLabel(cell(o, d)!.tempo_medio_s)}` : ''"
              >
                {{ cell(o, d)?.volume ?? '·' }}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Legenda da escala sequencial -->
    <div class="flex items-center gap-2 text-xs text-text-muted dark:text-text-dark-muted">
      <span>menor volume</span>
      <span class="inline-flex overflow-hidden rounded border border-border dark:border-border-dark">
        <span
          v-for="s in STEPS"
          :key="s.bg"
          class="h-3 w-6"
          :style="{ backgroundColor: s.bg }"
          aria-hidden="true"
        />
      </span>
      <span>maior volume</span>
    </div>
  </div>
</template>
