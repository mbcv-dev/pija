<script setup lang="ts">
import { computed } from 'vue'
import type { KpiDistribuicao } from '@/types/api.types'
import { formatDuration } from '@/lib/format'

/**
 * Histograma compacto da distribuicao de tempos de um KPI.
 *
 * POR QUE ELE EXISTE: o card mostra a mediana, e a mediana esconde a cauda.
 * No KPI-07B a mediana global e praticamente zero ("< 1 min") enquanto uma
 * unidade inteira passa das 6 h. O grafico existe pra tornar essa cauda visivel.
 *
 * Componente burro: recebe a distribuicao pronta via prop, nao busca nada nem
 * conhece store.
 */
const props = defineProps<{ dist: KpiDistribuicao }>()

// ── Geometria do desenho (unidades do viewBox) ───────────────────────────
const W = 280 // largura do plot
const H = 56 // altura do plot
const TOPO = 13 // faixa acima do plot: rotulo da mediana
const BASE = 12 // faixa abaixo do plot: rotulos do eixo
const GAP = 1.5 // respiro em cor de superficie entre barras vizinhas
const CAUDA_GAP = 4 // respiro extra antes da cauda: ela esta noutra escala de eixo
const RAIO = 2 // topo arredondado; a base fica reta, ancorada na linha de base
// Piso de altura: com 99% dos casos num balde so (KPI-07B), os demais viram
// hairline e a cauda — o objeto do grafico — some. 3px mantem "existe algo aqui"
// legivel sem inflar a leitura: as alturas continuam proporcionais a contagem.
const ALTURA_MIN = 3

/** Arredonda pra 2 casas e serializa — evita `1.2000000000000002` no path. */
function n2(v: number): string {
  return String(Number(v.toFixed(2)))
}

const temDados = computed(() => props.dist.n_total > 0 && props.dist.buckets.length > 0)

/** A cauda aberta (`ate === null`), quando existe, e sempre o ultimo balde. */
const temCauda = computed(() => {
  const bs = props.dist.buckets
  return bs.length > 0 && bs[bs.length - 1].ate === null
})

const nLinear = computed(() => props.dist.buckets.length - (temCauda.value ? 1 : 0))

/**
 * Dominio do eixo linear. Por contrato `teto` e o limite superior das faixas
 * fechadas — escalar por `p95` esta ERRADO: os dois coincidem no caso comum,
 * mas quando >= 95% dos casos sao zero o backend zera o p95 e cai no maximo
 * observado; escalar por p95 ali daria divisao por zero e apagaria a cauda,
 * que e justamente o objeto do grafico.
 * O fallback so cobre uma resposta malformada (teto ausente com baldes presentes).
 */
const dominio = computed(() => {
  const teto = props.dist.teto
  // Caso do contrato: com cauda, `teto` (= `buckets[last].de`) fecha o eixo linear.
  if (temCauda.value && teto !== null && teto > 0) return teto
  // Sem cauda (resposta fora do formato esperado) o eixo vai ate o maior limite
  // fechado — usar `teto` ali encolheria o ultimo balde a zero.
  const fechados = props.dist.buckets
    .map((b) => b.ate)
    .filter((a): a is number => a !== null)
  return fechados.length > 0 ? Math.max(...fechados) : (teto ?? 0)
})

/** Largura nominal de um balde. Cada balde ocupa uma fatia igual da largura. */
const larguraSlot = computed(() => {
  const total = props.dist.buckets.length
  if (total === 0) return 0
  // O respiro da cauda so e descontado quando existe eixo linear antes dela.
  const respiro = temCauda.value && nLinear.value > 0 ? CAUDA_GAP : 0
  return (W - respiro) / total
})

/** Faixa horizontal ocupada pelo eixo linear (0 -> teto). */
const larguraLinear = computed(() => larguraSlot.value * nLinear.value)

/**
 * Unica funcao de escala do componente: valor do KPI -> x no viewBox.
 * Barras E linha da mediana passam por aqui, entao a linha cai por construcao
 * exatamente onde o valor cai entre as barras — nao ha duas contas pra divergir.
 */
function escalaX(valor: number): number {
  if (dominio.value <= 0 || larguraLinear.value <= 0) return 0
  const preso = Math.min(Math.max(valor, 0), dominio.value)
  return (preso / dominio.value) * larguraLinear.value
}

const maiorN = computed(() => Math.max(1, ...props.dist.buckets.map((b) => b.n)))

/**
 * Topo arredondado + base reta. `rx` num <rect> arredondaria tambem a base e a
 * barra pareceria flutuar acima da linha de base — por isso o path a mao.
 */
function caminhoBarra(x: number, largura: number, altura: number): string {
  const r = Math.min(RAIO, largura / 2, altura)
  const y = H - altura
  const d = x + largura
  return (
    `M${n2(x)},${n2(H)}` +
    `L${n2(x)},${n2(y + r)}Q${n2(x)},${n2(y)} ${n2(x + r)},${n2(y)}` +
    `L${n2(d - r)},${n2(y)}Q${n2(d)},${n2(y)} ${n2(d)},${n2(y + r)}` +
    `L${n2(d)},${n2(H)}Z`
  )
}

function faixaLegivel(de: number, ate: number | null): string {
  const u = props.dist.unidade_tempo
  return ate === null
    ? `≥ ${formatDuration(de, u)}`
    : `${formatDuration(de, u)} – ${formatDuration(ate, u)}`
}

const barras = computed(() =>
  props.dist.buckets.map((b, i) => {
    const cauda = b.ate === null
    // A cauda nao tem limite superior: ocupa um slot fixo depois do eixo linear.
    const x = cauda
      ? larguraLinear.value + (nLinear.value > 0 ? CAUDA_GAP : 0)
      : escalaX(b.de)
    const fim = cauda ? x + larguraSlot.value : escalaX(b.ate as number)
    const largura = Math.max(0.5, fim - x - GAP)
    const altura = b.n > 0 ? Math.max(ALTURA_MIN, (b.n / maiorN.value) * H) : 0
    return {
      chave: `${i}-${b.de}`,
      cauda,
      // Cor de alerta so quando a cauda e de fato o extremo lento de um eixo.
      // No caso degenerado o unico balde e "todos os casos" — pinta-lo de laranja
      // diria "isto esta ruim" sobre a situacao mais saudavel possivel.
      lenta: cauda && nLinear.value > 0,
      x,
      largura,
      altura,
      d: altura > 0 ? caminhoBarra(x, largura, altura) : null,
      faixa: faixaLegivel(b.de, b.ate),
      n: b.n,
      titulo: `${faixaLegivel(b.de, b.ate)} · ${b.n.toLocaleString('pt-BR')} casos`,
    }
  }),
)

/**
 * x da mediana no eixo linear. `null` quando nao ha eixo (caso degenerado: todos
 * os casos zerados, teto = 0) — ali nao existe posicao honesta pra desenhar.
 */
const medianaX = computed(() => {
  if (props.dist.p50 === null || larguraLinear.value <= 0) return null
  return escalaX(props.dist.p50)
})

/** Mantem o rotulo dentro do viewBox mesmo com a mediana colada numa das pontas. */
const medianaAncora = computed(() => {
  const x = medianaX.value
  if (x === null) return 'middle'
  if (x < W * 0.25) return 'start'
  if (x > W * 0.75) return 'end'
  return 'middle'
})

const rotuloMediana = computed(() =>
  `mediana · ${formatDuration(props.dist.p50, props.dist.unidade_tempo)}`,
)

const rotuloTeto = computed(() =>
  `≥ ${formatDuration(props.dist.teto, props.dist.unidade_tempo)}`,
)

const casosNaCauda = computed(() => {
  const bs = props.dist.buckets
  return temCauda.value ? bs[bs.length - 1].n : 0
})

/**
 * Descricao textual honesta: fala de mediana e do teto do eixo, nunca de p95
 * (que nao escala nada aqui). No KPI-07B a mediana sai como "< 1 min" — e o
 * ponto do grafico e justamente contrastar isso com a cauda.
 */
const descricao = computed(() => {
  const u = props.dist.unidade_tempo
  const partes = [
    `Distribuicao de ${props.dist.n_total.toLocaleString('pt-BR')} casos`,
    `mediana ${formatDuration(props.dist.p50, u)}`,
  ]
  if (nLinear.value > 0) {
    partes.push(`eixo de zero a ${formatDuration(props.dist.teto, u)}`)
    partes.push(
      `ultima barra reune ${casosNaCauda.value.toLocaleString('pt-BR')} casos iguais ou acima desse limite`,
    )
  } else {
    partes.push('todos os casos numa unica faixa')
  }
  return `${partes.join('. ')}.`
})
</script>

<template>
  <!--
    Serie unica (contagem por faixa), entao sem legenda: o card ja diz o que
    esta plotado. A cauda usa o token `warning` porque nao e "outra serie" — e o
    extremo lento da mesma medida, coerente com o termometro de tempos do resto
    do app — e vem acompanhada do rotulo "≥ X" no eixo, nunca so pela cor.
  -->
  <div v-if="temDados" class="w-full">
    <svg
      :viewBox="`0 0 ${W} ${TOPO + H + BASE}`"
      class="w-full h-auto select-none"
      role="img"
      :aria-label="descricao"
    >
      <!-- Rotulo da mediana mora acima do plot pra nunca colidir com o eixo -->
      <text
        v-if="medianaX !== null"
        :x="medianaX"
        :y="TOPO - 4"
        :text-anchor="medianaAncora"
        font-size="9"
        class="fill-text-muted dark:fill-text-dark-muted"
      >{{ rotuloMediana }}</text>

      <g :transform="`translate(0, ${TOPO})`">
        <!-- Linha de base: hairline solida, recessiva -->
        <line
          :x1="0" :x2="W" :y1="H" :y2="H"
          class="stroke-border dark:stroke-border-dark" stroke-width="1"
        />

        <g
          v-for="b in barras"
          :key="b.chave"
          data-balde
          :data-cauda="b.cauda ? '' : undefined"
        >
          <title>{{ b.titulo }}</title>
          <!-- Alvo de hover da coluna inteira: a barra curta seria pequena demais -->
          <rect :x="b.x" y="0" :width="b.largura" :height="H" fill="transparent" />
          <path
            v-if="b.d"
            :d="b.d"
            :class="b.lenta ? 'fill-warning' : 'fill-primary dark:fill-accent'"
          />
        </g>

        <!--
          Anotacao (nao gridline): tracejada de proposito, e com um traco de
          fundo na cor da superficie pra continuar legivel ao cruzar uma barra.
        -->
        <template v-if="medianaX !== null">
          <line
            :x1="medianaX" :x2="medianaX" y1="0" :y2="H"
            class="stroke-surface dark:stroke-surface-dark" stroke-width="3.5"
          />
          <line
            data-mediana
            :x1="medianaX" :x2="medianaX" y1="0" :y2="H"
            class="stroke-text dark:stroke-text-dark"
            stroke-width="1.5" stroke-dasharray="3 2"
          />
        </template>
      </g>

      <!-- Eixo: so as duas extremidades; o resto vive no tooltip e na tabela -->
      <template v-if="nLinear > 0">
        <text
          x="0" :y="TOPO + H + 9" text-anchor="start" font-size="9"
          class="fill-text-muted dark:fill-text-dark-muted"
        >0</text>
        <text
          :x="W" :y="TOPO + H + 9" text-anchor="end" font-size="9"
          class="fill-text-muted dark:fill-text-dark-muted"
        >{{ rotuloTeto }}</text>
      </template>
      <text
        v-else
        :x="W / 2" :y="TOPO + H + 9" text-anchor="middle" font-size="9"
        class="fill-text-muted dark:fill-text-dark-muted"
      >todos os casos numa unica faixa</text>
    </svg>

    <!-- Equivalente textual: o grafico nunca e a unica via de acesso ao dado -->
    <table class="sr-only">
      <caption>{{ descricao }}</caption>
      <thead>
        <tr><th scope="col">Faixa de tempo</th><th scope="col">Casos</th></tr>
      </thead>
      <tbody>
        <tr v-for="b in barras" :key="b.chave">
          <td>{{ b.faixa }}</td>
          <td>{{ b.n.toLocaleString('pt-BR') }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
