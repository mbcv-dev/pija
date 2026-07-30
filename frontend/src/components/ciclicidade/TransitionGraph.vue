<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { NoItem, TransicaoItem } from '@/types/api.types'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import FilterSelect from '@/components/ui/FilterSelect.vue'

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

// ── Controle "Quais transições você quer ver?" ──
// Só no agregado (no individual todo volume é 1 e a ordem cronológica é o que importa).
// A partir de 4 transições já há o que escolher — e o slider (min=3) continua válido.
const temControles = computed(() => props.escopo === 'agregado' && props.transicoes.length > 3)
const topN = ref(Math.min(10, props.transicoes.length))
// Critério do corte top-N: volume desc (default) ou tempo médio asc (mais rápido → mais lento).
type Ordenacao = 'volume' | 'tempo'
const ordenacao = ref<Ordenacao>('volume')
const OPCOES_ORDENACAO: { value: Ordenacao; label: string }[] = [
  { value: 'volume', label: 'Mais casos' },
  { value: 'tempo', label: 'Mais rápido → mais lento' },
]
const ordenadas = computed(() => {
  const arr = [...props.transicoes]
  if (ordenacao.value === 'tempo') {
    arr.sort((a, b) => (a.tempo_medio_s ?? Infinity) - (b.tempo_medio_s ?? Infinity))
  } else {
    arr.sort((a, b) => b.volume - a.volume)
  }
  return arr
})

// ── Modo "Escolher": o usuário marca exatamente quais transições quer no grafo ──
// "As principais" = corte automático (top-N). "Escolher" = seleção explícita.
type Modo = 'principais' | 'escolher'
const OPCOES_MODO: { value: Modo; label: string }[] = [
  { value: 'principais', label: 'As principais' },
  { value: 'escolher', label: 'Escolher' },
]
const modo = ref<Modo>('principais')
const modoEscolher = computed(() => temControles.value && modo.value === 'escolher')

// Os três movimentos que o grafo mostra — o vocabulário que os atalhos ensinam.
type Movimento = 'avanco' | 'retorno' | 'repeticao'
const MOVIMENTOS: { tipo: Movimento; titulo: string }[] = [
  { tipo: 'avanco', titulo: 'Avanços — segue para a etapa seguinte' },
  { tipo: 'retorno', titulo: 'Retornos — volta para uma etapa anterior' },
  { tipo: 'repeticao', titulo: 'Repetições — fica na mesma etapa' },
]
function movimento(t: TransicaoItem): Movimento {
  if (t.origem === t.destino) return 'repeticao'
  return ordemIndex(t.destino) > ordemIndex(t.origem) ? 'avanco' : 'retorno'
}

const chaveTransicao = (t: TransicaoItem) => `${t.origem}>${t.destino}`
const escolhidas = ref<string[]>([])
const escolhidasSet = computed(() => new Set(escolhidas.value))

// Opções do seletor, agrupadas por movimento e com volume/tempo à vista.
const opcoesTransicoes = computed(() =>
  MOVIMENTOS.map(({ tipo, titulo }) => ({
    label: titulo,
    options: ordenadas.value
      .filter((t) => movimento(t) === tipo)
      .map((t) => ({
        value: chaveTransicao(t),
        label: `${PLENO[t.origem] ?? t.origem} → ${PLENO[t.destino] ?? t.destino} · ${fmtVol(t.volume)} · ${fmtTempo(t.tempo_medio_s)}`,
      })),
  })).filter((g) => g.options.length > 0),
)

// Transições marcadas, na ordem de desenho. Independe do foco por clique — os
// chips têm que refletir a escolha, não o recorte temporário de um clique.
const escolhidasVisiveis = computed(() =>
  ordenadas.value.filter((t) => escolhidasSet.value.has(chaveTransicao(t))),
)

type Preset = 'todas' | 'avancos' | 'retornos' | 'repeticoes' | 'nenhuma'
const PRESETS: { value: Preset; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'avancos', label: 'Só avanços' },
  { value: 'retornos', label: 'Só retornos' },
  { value: 'repeticoes', label: 'Só repetições' },
  { value: 'nenhuma', label: 'Nenhuma' },
]
// Os atalhos PREENCHEM a seleção (não são um segundo filtro) — uma só fonte de verdade.
function aplicarPreset(p: Preset) {
  if (p === 'nenhuma') { escolhidas.value = []; return }
  const alvo: Movimento | null =
    p === 'avancos' ? 'avanco' : p === 'retornos' ? 'retorno' : p === 'repeticoes' ? 'repeticao' : null
  const alvos = alvo === null ? props.transicoes : props.transicoes.filter((t) => movimento(t) === alvo)
  escolhidas.value = [...new Set(alvos.map(chaveTransicao))]
}
function removerEscolhida(t: TransicaoItem) {
  const k = chaveTransicao(t)
  escolhidas.value = escolhidas.value.filter((x) => x !== k)
}
// Ao entrar no modo, semeia com o que já estava no grafo: você ajusta a partir
// do que está vendo, em vez de começar de um grafo vazio.
function semearEscolha() {
  escolhidas.value = ordenadas.value.slice(0, topN.value).map(chaveTransicao)
}
function irParaModo(m: Modo) {
  modo.value = m
  if (m === 'escolher' && escolhidas.value.length === 0) semearEscolha()
}
// Trocar a coorte (filtros) pode zerar a escolha se nenhum par sobreviver. Em vez
// de um grafo vazio que parece bug, volta a mostrar as principais da coorte nova.
watch(() => props.transicoes, () => {
  if (modoEscolher.value && escolhidasVisiveis.value.length === 0 && props.transicoes.length > 0) {
    semearEscolha()
  }
})

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
  if (modoEscolher.value) return escolhidasVisiveis.value
  return temControles.value ? ordenadas.value.slice(0, topN.value) : ordenadas.value
})

interface Edge {
  key: string; d: string; w: number; ret: boolean; self: boolean
  lx: number; ly: number; label: string; tempoLabel: string; ordem?: number; title: string; t: EntradaTransicao
  // Seta no meio da aresta (direção inequívoca): posição + ângulo. Ausente nos auto-laços.
  ax?: number; ay?: number; aang?: number
  // Geometria da curva (usada pelo passe de de-overlap dos rótulos).
  curva?: { p0: Pt; c: Pt; p1: Pt }
}

type Pt = { x: number; y: number }
// Ponto e tangente da Bézier quadrática (usados p/ posicionar rótulo e seta do meio).
function qPonto(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }
}
function qTangente(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t
  return { x: 2 * (u * (c.x - a.x) + t * (b.x - c.x)), y: 2 * (u * (c.y - a.y) + t * (b.y - c.y)) }
}
// Recua `from` na direção de `toward` em `dist` (apara a aresta na borda do nó).
function recuar(from: Pt, toward: Pt, dist: number): Pt {
  const dx = toward.x - from.x, dy = toward.y - from.y
  const len = Math.hypot(dx, dy) || 1
  return { x: from.x + (dx / len) * dist, y: from.y + (dy / len) * dist }
}

// Variação determinística por par: desalinha arestas quase-colineares de pares diferentes.
function variacaoPar(o: string, d: string): number {
  let h = 0
  for (const ch of `${o}>${d}`) h = (h * 31 + ch.charCodeAt(0)) % 997
  return (h % 4) * 9 // 0 · 9 · 18 · 27
}

// A curva passa por cima de algum nó que não é extremo?
function cruzaNo(a: Pt, c: Pt, b: Pt, origem: string, destino: string, posicoes: Map<string, Pt>, raio: (t: string) => number): boolean {
  for (const [tipo, p] of posicoes) {
    if (tipo === origem || tipo === destino) continue
    const folga = raio(tipo) + 22
    for (let s = 0.1; s <= 0.9; s += 0.08) {
      const q = qPonto(a, c, b, s)
      if (Math.hypot(q.x - p.x, q.y - p.y) < folga) return true
    }
  }
  return false
}

type Rect = { x1: number; y1: number; x2: number; y2: number }
function intersecta(r1: Rect, r2: Rect): boolean {
  return r1.x1 < r2.x2 && r1.x2 > r2.x1 && r1.y1 < r2.y2 && r1.y2 > r2.y1
}

const edges = computed<Edge[]>(() => {
  const out: Edge[] = []
  // Repetições do mesmo par (comum no individual: passos 2 e 7 podem ser a mesma dupla):
  // cada ocorrência ganha uma curvatura maior pra nenhuma cobrir a anterior.
  const vistos = new Map<string, number>()
  for (const t of transicoesVisiveis.value) {
    const chavePar = `${t.origem}>${t.destino}`
    const repeticao = vistos.get(chavePar) ?? 0
    vistos.set(chavePar, repeticao + 1)
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
      const spread = rr * 0.62 + repeticao * 10
      const loop = rr + 76 + repeticao * 28
      const s1x = a.x + ux * rr * 0.6 + px * spread, s1y = a.y + uy * rr * 0.6 + py * spread
      const s2x = a.x + ux * rr * 0.6 - px * spread, s2y = a.y + uy * rr * 0.6 - py * spread
      const c1x = a.x + ux * loop + px * spread, c1y = a.y + uy * loop + py * spread
      const c2x = a.x + ux * loop - px * spread, c2y = a.y + uy * loop - py * spread
      const d = `M ${s1x} ${s1y} C ${c1x} ${c1y} ${c2x} ${c2y} ${s2x} ${s2y}`
      out.push({ key: `${t.origem}-self-${t.ordem ?? ''}`, d, w: largura(t.volume), ret: true, self: true,
        lx: a.x + ux * (loop + 20), ly: a.y + uy * (loop + 20), label, tempoLabel, ordem: t.ordem, title, t })
    } else {
      // Curva sempre à ESQUERDA do sentido de percurso: A→B e B→A caem em lados
      // opostos da corda — nunca uma cobre a outra por inteiro.
      const dx = b.x - a.x, dy = b.y - a.y
      const dist = Math.hypot(dx, dy) || 1
      const nx = -dy / dist, ny = dx / dist
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
      let bend = Math.max(42, dist * 0.1) + variacaoPar(t.origem, t.destino) + repeticao * 34
      let c = { x: mx + nx * bend, y: my + ny * bend }
      // Afasta a curva de nós intermediários (não passar por cima de um terceiro nó).
      for (let iter = 0; iter < 8 && cruzaNo(a, c, b, t.origem, t.destino, pos.value, raioNo); iter++) {
        bend += 38
        c = { x: mx + nx * bend, y: my + ny * bend }
      }
      // Apara nas bordas: a ponta da seta fica visível na borda do nó (não escondida embaixo dele).
      const p0 = recuar(a, c, raioNo(t.origem) + 2)
      const p1 = recuar(b, c, raioNo(t.destino) + 5)
      const d = `M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p1.x} ${p1.y}`
      const lp = qPonto(p0, c, p1, 0.5)
      const ap = qPonto(p0, c, p1, 0.28)
      const at = qTangente(p0, c, p1, 0.28)
      out.push({ key: `${t.origem}-${t.destino}-${t.ordem ?? ''}`, d, w: largura(t.volume), ret, self: false,
        lx: lp.x, ly: lp.y, label, tempoLabel, ordem: t.ordem, title, t,
        ax: ap.x, ay: ap.y, aang: (Math.atan2(at.y, at.x) * 180) / Math.PI,
        curva: { p0, c, p1 } })
    }
  }
  posicionarRotulos(out)
  return out
})

// ── Rótulos nunca sobrepostos: tenta posições ao longo da curva; clampa no viewBox ──
function rectRotulo(e: Edge, x: number, y: number): Rect {
  // Individual: selo (r=11) em cima + pílula embaixo ≈ 44 de altura; agregado: pílula 24.
  const w = e.ordem != null ? Math.max(26, larguraPilula(e.tempoLabel)) : larguraPilula(e.label)
  const h = e.ordem != null ? 46 : 24
  return { x1: x - w / 2, y1: y - h / 2, x2: x + w / 2, y2: y + h / 2 }
}
function clampRotulo(e: Edge, x: number, y: number): Pt {
  const w = e.ordem != null ? Math.max(26, larguraPilula(e.tempoLabel)) : larguraPilula(e.label)
  const h = e.ordem != null ? 46 : 24
  return {
    x: Math.min(W - w / 2 - 8, Math.max(w / 2 + 8, x)),
    y: Math.min(H - h / 2 - 6, Math.max(h / 2 + 6, y)),
  }
}
function posicionarRotulos(lista: Edge[]) {
  const ocupados: Rect[] = []
  // Auto-laços primeiro: posição fixa (só clampa); as demais desviam deles.
  const ordenados = [...lista].sort((a, b) => Number(b.self) - Number(a.self))
  for (const e of ordenados) {
    if (e.self || !e.curva) {
      const p = clampRotulo(e, e.lx, e.ly)
      e.lx = p.x; e.ly = p.y
      ocupados.push(rectRotulo(e, e.lx, e.ly))
      continue
    }
    const { p0, c, p1 } = e.curva
    let melhor: Pt | null = null
    for (const t of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74]) {
      const q = clampRotulo(e, qPonto(p0, c, p1, t).x, qPonto(p0, c, p1, t).y)
      if (!ocupados.some((r) => intersecta(r, rectRotulo(e, q.x, q.y)))) { melhor = q; break }
      if (!melhor) melhor = q
    }
    e.lx = melhor!.x; e.ly = melhor!.y
    ocupados.push(rectRotulo(e, e.lx, e.ly))
  }
}

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
      <div v-if="temControles" class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span class="font-semibold text-text dark:text-text-dark whitespace-nowrap">
          Quais transições você quer ver?
        </span>
        <SegmentedControl
          :model-value="modo" :options="OPCOES_MODO" option-attr="data-modo"
          @update:model-value="irParaModo($event as Modo)"
        />
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

    <!-- Painel do modo ativo -->
    <div v-if="temControles" class="flex flex-col gap-2 text-xs">
      <!-- Modo automático: quantas ver + por qual critério cortar -->
      <div v-if="modo === 'principais'" class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div class="flex items-center gap-2">
          <label for="cic-topn" class="text-text-muted dark:text-text-dark-muted whitespace-nowrap">
            Quantidade
          </label>
          <input
            id="cic-topn" v-model.number="topN" type="range" min="3" :max="transicoes.length" step="1"
            class="cic-slider" :disabled="!!sel"
          />
          <span class="tabular-nums font-semibold text-text dark:text-text-dark w-8">{{ sel ? '—' : topN }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-text-muted dark:text-text-dark-muted whitespace-nowrap">Ordenar por</span>
          <SegmentedControl
            :model-value="ordenacao"
            :options="OPCOES_ORDENACAO"
            @update:model-value="ordenacao = $event as Ordenacao"
          />
        </div>
      </div>

      <!-- Modo manual: atalhos + seletor item a item + o que está escolhido -->
      <template v-else>
        <div class="flex flex-wrap items-end gap-x-4 gap-y-2">
          <div class="flex flex-col gap-1">
            <span class="font-medium text-text-muted dark:text-text-dark-muted">Atalhos</span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="p in PRESETS" :key="p.value" type="button" :data-preset="p.value"
                class="px-2.5 py-1 rounded-full border border-border dark:border-border-dark text-text-muted dark:text-text-dark-muted hover:border-primary hover:text-primary dark:hover:border-accent dark:hover:text-accent transition-colors"
                @click="aplicarPreset(p.value)"
              >{{ p.label }}</button>
            </div>
          </div>
          <FilterSelect
            v-model="escolhidas" label="Transições" placeholder="Nenhuma"
            :options="[]" :groups="opcoesTransicoes"
          />
          <span data-contador class="text-text-faint dark:text-text-dark-muted pb-2">
            mostrando {{ escolhidasVisiveis.length }} de {{ transicoes.length }} transições
          </span>
        </div>

        <!-- O que está escolhido fica à vista: dá pra tirar uma a uma sem abrir o seletor -->
        <div v-if="escolhidasVisiveis.length > 0" class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          <button
            v-for="t in escolhidasVisiveis" :key="chaveTransicao(t)" type="button" data-chip
            class="group flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-full font-medium transition-colors"
            :class="movimento(t) === 'retorno' || movimento(t) === 'repeticao'
              ? 'bg-caution/10 text-caution hover:bg-caution/20'
              : 'bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent hover:bg-primary/20 dark:hover:bg-accent/25'"
            :title="`Remover ${PLENO[t.origem]} → ${PLENO[t.destino]} do grafo`"
            @click="removerEscolhida(t)"
          >
            {{ CURTO[t.origem] ?? t.origem }} → {{ CURTO[t.destino] ?? t.destino }}
            <span class="opacity-50 group-hover:opacity-100" aria-hidden="true">✕</span>
            <span class="sr-only">Remover do grafo</span>
          </button>
        </div>
        <p v-else data-vazio class="text-text-muted dark:text-text-dark-muted">
          Nenhuma transição escolhida — use um atalho acima ou marque as que quiser no seletor.
        </p>
      </template>
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
        <!-- Um marker por cor: `context-stroke` não herda a cor da aresta de forma confiável no Chromium. -->
        <marker id="cic-arrow-av" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="17" markerHeight="17"
                markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" class="fill-primary dark:fill-accent" />
        </marker>
        <marker id="cic-arrow-ret" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="17" markerHeight="17"
                markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" class="fill-caution" />
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
              :d="e.d" :stroke-width="e.w" :marker-end="e.ret ? 'url(#cic-arrow-ret)' : 'url(#cic-arrow-av)'"
              :class="e.ret ? 'text-caution' : 'text-primary dark:text-accent'"
              stroke="currentColor" stroke-linecap="round"
            />
            <!-- Seta no meio da aresta: reforça a direção mesmo quando as pontas ficam longe.
                 Escala com a espessura pra não sumir dentro de arestas grossas. -->
            <path
              v-if="e.aang != null"
              d="M -8 -6 L 10 0 L -8 6 Z" fill="currentColor" stroke="none"
              :class="e.ret ? 'text-caution' : 'text-primary dark:text-accent'"
              :transform="`translate(${e.ax} ${e.ay}) rotate(${e.aang}) scale(${Math.max(1.1, e.w / 5.5)})`"
            />
          </g>
        </g>

        <!-- Rótulos das arestas -->
        <g class="pointer-events-none">
          <g v-for="e in edges" :key="`lbl-${e.key}`" :transform="`translate(${e.lx} ${e.ly})`">
            <!-- Individual: selo com o PASSO (ordem cronológica) + tempo abaixo. -->
            <!-- Selo discreto: contorno colorido + fundo neutro, em vez de disco cheio berrante. -->
            <template v-if="e.ordem != null">
              <g transform="translate(0 -11)">
                <circle r="11" stroke-width="1.5"
                        class="fill-surface dark:fill-surface-dark"
                        :class="e.ret ? 'stroke-caution' : 'stroke-primary dark:stroke-accent'" />
                <text text-anchor="middle" dy="0.34em" font-size="11" font-weight="700"
                      :class="e.ret ? 'fill-caution' : 'fill-primary dark:fill-accent'">{{ e.ordem }}</text>
              </g>
              <g transform="translate(0 13)">
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
