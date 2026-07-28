<script setup lang="ts">
import { ref, computed } from 'vue'
import type { NoItem, TransicaoItem } from '@/types/api.types'

// No escopo individual cada transição carrega `ordem` (o passo cronológico).
type EntradaTransicao = TransicaoItem & { ordem?: number }

const props = withDefaults(
  defineProps<{ nos: NoItem[]; transicoes: EntradaTransicao[]; escopo?: 'agregado' | 'paciente' }>(),
  { escopo: 'agregado' },
)

// Ordem canônica da jornada. O índice define "avanço" (frente) vs "retorno" (volta).
const ORDEM = ['PRONTUARIO', 'CONSULTA', 'PROCEDIMENTO', 'EXAME', 'INTERNACAO', 'CIRURGIA', 'ALTA']
const CURTO: Record<string, string> = {
  PRONTUARIO: 'Pront.', CONSULTA: 'Consulta', PROCEDIMENTO: 'Proced.',
  EXAME: 'Exame', INTERNACAO: 'Intern.', CIRURGIA: 'Cirurgia', ALTA: 'Alta',
}
const PLENO: Record<string, string> = {
  PRONTUARIO: 'Prontuário', CONSULTA: 'Consulta', PROCEDIMENTO: 'Procedimento',
  EXAME: 'Exame', INTERNACAO: 'Internação', CIRURGIA: 'Cirurgia', ALTA: 'Alta',
}

// viewBox largo (elipse): o card é largo, então espalhamos os nós numa elipse
// para ocupar a largura. Altura extra p/ os auto-laços de baixo não cortarem.
const W = 1360
const H = 840
const CX = W / 2
const CY = H / 2
const RX = 480
const RY = 250

const ordemIndex = (t: string) => ORDEM.indexOf(t)

const tipos = computed(() => {
  const presentes = new Set(props.nos.map((n) => n.tipo))
  return ORDEM.filter((t) => presentes.has(t as never))
})

const pos = computed(() => {
  const m = new Map<string, { x: number; y: number }>()
  const n = tipos.value.length
  tipos.value.forEach((t, i) => {
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / n
    m.set(t, { x: CX + RX * Math.cos(ang), y: CY + RY * Math.sin(ang) })
  })
  return m
})

// ── Nós: raio ∝ throughput (escala log — os volumes variam ordens de grandeza) ──
const noPorTipo = computed(() => new Map<string, NoItem>(props.nos.map((n) => [n.tipo, n])))
const throughput = (t: string) => {
  const n = noPorTipo.value.get(t)
  return n ? n.total_entradas + n.total_saidas : 0
}
const maxThroughput = computed(() => Math.max(1, ...props.nos.map((n) => n.total_entradas + n.total_saidas)))
function raioNo(t: string): number {
  const f = Math.log1p(throughput(t)) / Math.log1p(maxThroughput.value)
  return 30 + 26 * f // 30–56
}

// ── Espessura ∝ volume, escala LOG (5 … 926k na mesma imagem) ──
const volumes = computed(() => props.transicoes.map((t) => t.volume))
const minVol = computed(() => Math.min(1, ...volumes.value))
const maxVol = computed(() => Math.max(2, ...volumes.value))
function largura(vol: number): number {
  const lo = Math.log(minVol.value)
  const hi = Math.log(maxVol.value)
  const f = hi > lo ? (Math.log(Math.max(1, vol)) - lo) / (hi - lo) : 1
  return 1.5 + 10 * f // 1.5–11.5 px
}

const retorno = (t: TransicaoItem) => t.origem === t.destino || ordemIndex(t.destino) < ordemIndex(t.origem)

// ── Formatação compacta ──
function fmtVol(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(v)
}
function fmtTempo(s: number | null): string {
  if (s === null) return '—'
  const d = s / 86400
  if (d >= 1) return `${d >= 10 ? Math.round(d) : d.toFixed(1)}d`
  return `${Math.round(s / 3600)}h`
}

// ── Controle top-N (só quando há muitas transições) ──
// Top-N só faz sentido no agregado (no individual todo volume é 1 e a ordem é o que importa).
const temControles = computed(() => props.escopo === 'agregado' && props.transicoes.length > 12)
const topN = ref(Math.min(10, props.transicoes.length))
const ordenadas = computed(() => [...props.transicoes].sort((a, b) => b.volume - a.volume))

// ── Seleção: clicar filtra o grafo ao contexto (ego-fluxo do nó / uma transição) ──
type Sel = { kind: 'node'; tipo: string } | { kind: 'edge'; origem: string; destino: string } | null
const sel = ref<Sel>(null)

const selLabel = computed(() => {
  if (!sel.value) return ''
  if (sel.value.kind === 'node') return `Fluxo de ${PLENO[sel.value.tipo] ?? sel.value.tipo}`
  return `${PLENO[sel.value.origem]} → ${PLENO[sel.value.destino]}`
})

const transicoesVisiveis = computed(() => {
  if (sel.value?.kind === 'node') {
    const t = sel.value.tipo
    return props.transicoes.filter((x) => x.origem === t || x.destino === t)
  }
  if (sel.value?.kind === 'edge') {
    const s = sel.value
    return props.transicoes.filter((x) => x.origem === s.origem && x.destino === s.destino)
  }
  return temControles.value ? ordenadas.value.slice(0, topN.value) : ordenadas.value
})

interface Edge {
  key: string; d: string; w: number; ret: boolean; self: boolean
  lx: number; ly: number; label: string; tempoLabel: string; ordem?: number; title: string; t: EntradaTransicao
}

const edges = computed<Edge[]>(() => {
  const out: Edge[] = []
  for (const t of transicoesVisiveis.value) {
    const a = pos.value.get(t.origem)
    const b = pos.value.get(t.destino)
    if (!a || !b) continue
    const ret = retorno(t)
    const label = `${fmtVol(t.volume)} · ${fmtTempo(t.tempo_medio_s)}`
    const tempoLabel = fmtTempo(t.tempo_medio_s)
    const title = t.ordem != null
      ? `Passo ${t.ordem}: ${PLENO[t.origem]} → ${PLENO[t.destino]} · ${tempoLabel}`
      : `${PLENO[t.origem]} → ${PLENO[t.destino]}: ${t.volume.toLocaleString('pt-BR')} transições · tempo médio ${tempoLabel}`
    if (t.origem === t.destino) {
      // Laço maior e arredondado (cubic) saindo/voltando pela borda do nó, apontando pra fora.
      const ox = a.x - CX, oy = a.y - CY
      const len = Math.hypot(ox, oy) || 1
      const ux = ox / len, uy = oy / len
      const px = -uy, py = ux // perpendicular
      const rr = raioNo(t.origem)
      const spread = rr * 0.62
      const loop = rr + 76
      const s1x = a.x + ux * rr * 0.6 + px * spread, s1y = a.y + uy * rr * 0.6 + py * spread
      const s2x = a.x + ux * rr * 0.6 - px * spread, s2y = a.y + uy * rr * 0.6 - py * spread
      const c1x = a.x + ux * loop + px * spread, c1y = a.y + uy * loop + py * spread
      const c2x = a.x + ux * loop - px * spread, c2y = a.y + uy * loop - py * spread
      const d = `M ${s1x} ${s1y} C ${c1x} ${c1y} ${c2x} ${c2y} ${s2x} ${s2y}`
      out.push({ key: `${t.origem}-self-${t.ordem ?? ''}`, d, w: largura(t.volume), ret: true, self: true,
        lx: a.x + ux * (loop + 20), ly: a.y + uy * (loop + 20), label, tempoLabel, ordem: t.ordem, title, t })
    } else {
      const nx = -(b.y - a.y), ny = b.x - a.x
      const nlen = Math.hypot(nx, ny) || 1
      const bend = 46 * (ret ? -1 : 1) // avanço e retorno arqueiam para lados opostos
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
      const cx = mx + (nx / nlen) * bend, cy = my + (ny / nlen) * bend
      const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`
      // ponto médio da quadrática (t=0.5) = (A + 2C + B) / 4
      out.push({ key: `${t.origem}-${t.destino}-${t.ordem ?? ''}`, d, w: largura(t.volume), ret, self: false,
        lx: (a.x + 2 * cx + b.x) / 4, ly: (a.y + 2 * cy + b.y) / 4, label, tempoLabel, ordem: t.ordem, title, t })
    }
  }
  return out
})

// Nós que continuam ativos sob a seleção (para apagar o resto).
const nosAtivos = computed(() => {
  if (!sel.value) return null
  const s = new Set<string>()
  for (const e of edges.value) { s.add(e.t.origem); s.add(e.t.destino) }
  return s
})
const noApagado = (t: string) => nosAtivos.value !== null && !nosAtivos.value.has(t)

// ── Zoom / pan ──
const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
const arrastando = ref(false)
let lx0 = 0, ly0 = 0
const viewTransform = computed(
  () => `translate(${tx.value} ${ty.value}) translate(${CX} ${CY}) scale(${scale.value}) translate(${-CX} ${-CY})`,
)
function onWheel(e: WheelEvent) {
  const f = e.deltaY < 0 ? 1.15 : 1 / 1.15
  scale.value = Math.min(4, Math.max(0.6, scale.value * f))
}
function onDown(e: MouseEvent) { arrastando.value = true; lx0 = e.clientX; ly0 = e.clientY }
function onMove(e: MouseEvent) {
  if (!arrastando.value) return
  tx.value += e.clientX - lx0; ty.value += e.clientY - ly0
  lx0 = e.clientX; ly0 = e.clientY
}
function onUp() { arrastando.value = false }
const zoomAlterado = computed(() => scale.value !== 1 || tx.value !== 0 || ty.value !== 0)
function reporZoom() { scale.value = 1; tx.value = 0; ty.value = 0 }

function clicarNo(t: string) {
  sel.value = sel.value?.kind === 'node' && sel.value.tipo === t ? null : { kind: 'node', tipo: t }
}
function clicarAresta(e: Edge) {
  const s = sel.value
  sel.value = s?.kind === 'edge' && s.origem === e.t.origem && s.destino === e.t.destino
    ? null : { kind: 'edge', origem: e.t.origem, destino: e.t.destino }
}
function limpar() { sel.value = null }

function larguraPilula(label: string) { return label.length * 7.2 + 14 }
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Controles -->
    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      <div v-if="temControles" class="flex items-center gap-2">
        <label for="cic-topn" class="text-text-muted dark:text-text-dark-muted whitespace-nowrap">
          Transições mais fortes
        </label>
        <input
          id="cic-topn" v-model.number="topN" type="range" min="3" :max="transicoes.length" step="1"
          class="cic-slider" :disabled="!!sel"
        />
        <span class="tabular-nums font-semibold text-text dark:text-text-dark w-8">{{ sel ? '—' : topN }}</span>
      </div>

      <button
        v-if="zoomAlterado" type="button" @click="reporZoom"
        class="text-primary dark:text-accent hover:underline"
      >Repor zoom</button>

      <!-- Legenda -->
      <div class="flex items-center gap-3 ml-auto text-text-muted dark:text-text-dark-muted">
        <span class="flex items-center gap-1.5"><span class="inline-block w-4 h-[3px] rounded bg-primary dark:bg-accent"></span> avanço</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-4 h-[3px] rounded bg-caution"></span> retorno / ciclo</span>
        <span class="hidden sm:inline">espessura = volume (log)</span>
      </div>
    </div>

    <!-- Chip de seleção -->
    <div v-if="sel" class="flex items-center gap-2 text-xs">
      <span class="px-2.5 py-1 rounded-full bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent font-medium">
        {{ selLabel }}
      </span>
      <button type="button" @click="limpar" class="text-text-muted dark:text-text-dark-muted hover:text-text dark:hover:text-text-dark">
        limpar ✕
      </button>
    </div>

    <!-- Grafo -->
    <svg
      :viewBox="`0 0 ${W} ${H}`" class="w-full rounded-xl select-none"
      :class="arrastando ? 'cursor-grabbing' : 'cursor-grab'"
      style="aspect-ratio: 1360 / 840; touch-action: none"
      role="img" aria-label="Grafo de transições entre etapas da jornada"
      @wheel.prevent="onWheel" @mousedown="onDown" @mousemove="onMove"
      @mouseup="onUp" @mouseleave="onUp"
    >
      <defs>
        <marker id="cic-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9"
                markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <!-- context-stroke: a ponta herda a cor da aresta (cyan/âmbar) -->
          <path d="M0 0L10 5L0 10z" fill="context-stroke" />
        </marker>
      </defs>

      <rect x="0" y="0" :width="W" :height="H" rx="16" class="fill-surface-2 dark:fill-surface-dark-2" @click="limpar" />

      <g :transform="viewTransform">
        <!-- Arestas -->
        <g fill="none">
          <g v-for="e in edges" :key="e.key" data-edge class="cic-edge" @click.stop="clicarAresta(e)">
            <title>{{ e.title }}</title>
            <!-- alvo de clique invisível, mais largo -->
            <path :d="e.d" fill="none" stroke="transparent" :stroke-width="Math.max(e.w + 14, 18)" />
            <path
              :d="e.d" :stroke-width="e.w" marker-end="url(#cic-arrow)"
              :class="e.ret ? 'text-caution' : 'text-primary dark:text-accent'"
              stroke="currentColor" stroke-linecap="round"
            />
          </g>
        </g>

        <!-- Rótulos das arestas -->
        <g class="pointer-events-none">
          <g v-for="e in edges" :key="`lbl-${e.key}`" :transform="`translate(${e.lx} ${e.ly})`">
            <!-- Individual: selo com o PASSO (ordem cronológica) + tempo abaixo. -->
            <template v-if="e.ordem != null">
              <g transform="translate(0 -13)">
                <circle r="15" stroke="#fff" stroke-width="1.5"
                        :class="e.ret ? 'fill-caution' : 'fill-primary dark:fill-accent'" />
                <text text-anchor="middle" dy="0.34em" font-size="15" font-weight="800" fill="#fff">{{ e.ordem }}</text>
              </g>
              <g transform="translate(0 15)">
                <rect :x="-larguraPilula(e.tempoLabel) / 2" y="-9" :width="larguraPilula(e.tempoLabel)" height="18" rx="9"
                      class="fill-surface dark:fill-surface-dark" />
                <text text-anchor="middle" dy="0.34em" font-size="11"
                      class="tabular-nums fill-text-muted dark:fill-text-dark-muted">{{ e.tempoLabel }}</text>
              </g>
            </template>
            <!-- Agregado: pílula volume · dias. -->
            <template v-else>
              <rect
                :x="-larguraPilula(e.label) / 2" y="-11" :width="larguraPilula(e.label)" height="22" rx="11"
                class="fill-surface dark:fill-surface-dark" stroke="currentColor"
                :class="e.ret ? 'text-caution/40' : 'text-primary/30 dark:text-accent/30'"
                stroke-width="1"
              />
              <text text-anchor="middle" dy="0.34em" font-size="13" font-weight="600"
                    class="tabular-nums fill-text dark:fill-text-dark">{{ e.label }}</text>
            </template>
          </g>
        </g>

        <!-- Nós -->
        <g>
          <g
            v-for="t in tipos" :key="t" data-node class="cic-node"
            :transform="`translate(${pos.get(t)!.x} ${pos.get(t)!.y})`"
            :class="{ 'cic-dim': noApagado(t) }"
            @click.stop="clicarNo(t)"
          >
            <title>{{ PLENO[t] }} · {{ throughput(t).toLocaleString('pt-BR') }} eventos no fluxo</title>
            <circle
              :r="raioNo(t)"
              class="fill-surface-offset dark:fill-surface-dark-offset stroke-border dark:stroke-border-dark"
              :class="{ 'cic-node-sel': sel?.kind === 'node' && sel.tipo === t }"
              stroke-width="2"
            />
            <text text-anchor="middle" dy="0.34em" font-size="15" font-weight="700"
                  class="fill-text dark:fill-text-dark">{{ CURTO[t] }}</text>
          </g>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.cic-edge { cursor: pointer; opacity: 0.72; transition: opacity 0.12s ease; }
.cic-edge:hover { opacity: 1; }
.cic-node { cursor: pointer; transition: opacity 0.15s ease; }
.cic-node:hover circle { filter: brightness(1.06); }
.cic-dim { opacity: 0.28; }
.cic-node-sel { stroke: currentColor; color: var(--cic-sel, #0f4c81); }

/* Slider enxuto na cor da marca. */
.cic-slider { accent-color: #0f4c81; height: 4px; width: 130px; cursor: pointer; }
:global(.dark) .cic-slider, :global([data-theme='dark']) .cic-slider { accent-color: #2bb3d9; }
.cic-slider:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
