<script setup lang="ts">
import { computed } from 'vue'
import type { NoItem, TransicaoItem } from '@/types/api.types'

const props = defineProps<{ nos: NoItem[]; transicoes: TransicaoItem[] }>()

const ORDEM = ['PRONTUARIO', 'CONSULTA', 'PROCEDIMENTO', 'EXAME', 'INTERNACAO', 'CIRURGIA', 'ALTA']
const W = 420
const H = 420
const R = 150   // raio do círculo dos nós
const CX = W / 2
const CY = H / 2

const tipos = computed(() => {
  const presentes = new Set(props.nos.map((n) => n.tipo))
  return ORDEM.filter((t) => presentes.has(t as never))
})

// Posição fixa de cada nó no círculo.
const pos = computed(() => {
  const m = new Map<string, { x: number; y: number }>()
  const n = tipos.value.length
  tipos.value.forEach((t, i) => {
    const ang = (-Math.PI / 2) + (2 * Math.PI * i) / n
    m.set(t, { x: CX + R * Math.cos(ang), y: CY + R * Math.sin(ang) })
  })
  return m
})

const maxVol = computed(() => Math.max(1, ...props.transicoes.map((t) => t.volume)))
function largura(vol: number): number {
  return 1 + 6 * (vol / maxVol.value) // 1–7 px
}
function tempoLabel(s: number | null): string {
  if (s === null) return 'tempo n/d'
  const dias = s / 86400
  return dias >= 1 ? `${dias.toFixed(1)} d` : `${(s / 3600).toFixed(1)} h`
}

interface Edge {
  key: string; d: string; w: number; title: string; selfLoop: boolean; mx: number; my: number
}

const edges = computed<Edge[]>(() => {
  const out: Edge[] = []
  for (const t of props.transicoes) {
    const a = pos.value.get(t.origem)
    const b = pos.value.get(t.destino)
    if (!a || !b) continue
    const title = `${t.origem} → ${t.destino}: ${t.volume} · ${tempoLabel(t.tempo_medio_s)}`
    if (t.origem === t.destino) {
      // Auto-laço: pequeno arco saindo e voltando ao nó, apontando pra fora do centro.
      const ox = a.x - CX, oy = a.y - CY
      const len = Math.hypot(ox, oy) || 1
      const ux = ox / len, uy = oy / len
      const tipx = a.x + ux * 34, tipy = a.y + uy * 34
      const d = `M ${a.x - uy * 6} ${a.y + ux * 6} Q ${tipx} ${tipy} ${a.x + uy * 6} ${a.y - ux * 6}`
      out.push({ key: `${t.origem}-self`, d, w: largura(t.volume), title, selfLoop: true, mx: tipx, my: tipy })
    } else {
      // Curva quadrática levemente arqueada (assimetria distingue A→B de B→A).
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
      const nx = -(b.y - a.y), ny = (b.x - a.x)
      const nlen = Math.hypot(nx, ny) || 1
      const bend = 28
      const cx = mx + (nx / nlen) * bend, cy = my + (ny / nlen) * bend
      const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`
      out.push({ key: `${t.origem}-${t.destino}`, d, w: largura(t.volume), title, selfLoop: false, mx: cx, my: cy })
    }
  }
  return out
})
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" class="w-full max-w-md mx-auto text-primary dark:text-accent" role="img" aria-label="Grafo de transições entre etapas">
    <defs>
      <!-- markerUnits=userSpaceOnUse: seta com tamanho FIXO, independente do stroke-width.
           Sem isso, a aresta de maior volume (stroke grosso) ganharia uma ponta gigante,
           pois o padrão markerUnits=strokeWidth escala o marker pela espessura. -->
      <marker id="cic-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" fill="currentColor" />
      </marker>
    </defs>

    <!-- Arestas -->
    <g fill="none" stroke="currentColor">
      <path
        v-for="e in edges" :key="e.key" data-edge
        class="cic-edge"
        :d="e.d" :stroke-width="e.w" marker-end="url(#cic-arrow)"
      >
        <title>{{ e.title }}</title>
      </path>
    </g>

    <!-- Nós -->
    <g>
      <g v-for="t in tipos" :key="t" data-node :transform="`translate(${pos.get(t)!.x}, ${pos.get(t)!.y})`">
        <circle r="22" class="fill-surface-2 dark:fill-surface-dark-2" stroke="currentColor" stroke-width="1.75" />
        <text text-anchor="middle" dy="0.32em" class="fill-text dark:fill-text-dark" font-size="8" font-weight="600">
          {{ t.slice(0, 5) }}
        </text>
      </g>
    </g>
  </svg>
</template>

<style scoped>
/* Camada de hover: destaca a aresta sob o cursor (o resto recua via opacidade do grupo). */
.cic-edge {
  opacity: 0.65;
  transition: opacity 0.12s ease;
}
.cic-edge:hover {
  opacity: 1;
}
</style>
