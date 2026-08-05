<script setup lang="ts">
import { computed } from 'vue'
import type { KpiDistribuicao } from '@/types/api.types'
import { formatCount, formatDuration } from '@/lib/format'

/**
 * Histograma compacto da distribuição de tempos de um KPI.
 *
 * POR QUE ELE EXISTE: o card mostra a mediana, e a mediana esconde a cauda.
 * No KPI-07B a mediana global é praticamente zero ("< 1 min") enquanto uma
 * unidade inteira passa das 6 h. O gráfico existe pra tornar essa cauda visível.
 *
 * Componente burro: recebe a distribuição pronta via prop, não busca nada nem
 * conhece store.
 */
const props = defineProps<{ dist: KpiDistribuicao }>()

// ── Geometria do desenho (unidades do viewBox) ───────────────────────────
const W = 280 // largura do plot
const H = 56 // altura do plot
const FONTE = 9 // corpo de todo texto do gráfico
const TOPO = FONTE + 4 // faixa acima do plot: rótulo da mediana — dimensionada por FONTE
const BASE = FONTE + 3 // faixa abaixo do plot: rótulos do eixo — idem
const GAP = 1.5 // respiro em cor de superfície entre barras vizinhas
const CAUDA_GAP = 4 // respiro extra antes da cauda: ela está noutra escala de eixo
const RAIO = 2 // topo arredondado; a base fica reta, ancorada na linha de base
// Piso de altura: mantém "existe algo aqui" legível para um balde minúsculo.
// Vale só pra n > 0 — balde vazio continua sem barra nenhuma, a distinção entre
// zero e não-zero é absoluta (há teste fixando os dois lados dessa fronteira).
const ALTURA_MIN = 3

/** Arredonda pra 2 casas e serializa — evita `1.2000000000000002` no path. */
function n2(v: number): string {
  return String(Number(v.toFixed(2)))
}

const temDados = computed(() => props.dist.n_total > 0 && props.dist.buckets.length > 0)

/** A cauda aberta (`ate === null`), quando existe, é sempre o último balde. */
const temCauda = computed(() => {
  const bs = props.dist.buckets
  return bs.length > 0 && bs[bs.length - 1].ate === null
})

const nLinear = computed(() => props.dist.buckets.length - (temCauda.value ? 1 : 0))

/**
 * Domínio do eixo linear. Por contrato `teto` é o limite superior das faixas
 * fechadas — escalar por `p95` está ERRADO: os dois coincidem no caso comum,
 * mas quando >= 95% dos casos são zero o backend zera o p95 e cai no máximo
 * observado; escalar por p95 ali daria divisão por zero e apagaria a cauda,
 * que é justamente o objeto do gráfico.
 * O fallback só cobre uma resposta malformada (teto ausente com baldes presentes).
 */
const dominio = computed(() => {
  const teto = props.dist.teto
  // Caso do contrato: com cauda, `teto` (= `buckets[last].de`) fecha o eixo linear.
  if (temCauda.value && teto !== null && teto > 0) return teto
  // Sem cauda (resposta fora do formato esperado) o eixo vai até o maior limite
  // fechado — usar `teto` ali encolheria o último balde a zero.
  const fechados = props.dist.buckets
    .map((b) => b.ate)
    .filter((a): a is number => a !== null)
  return fechados.length > 0 ? Math.max(...fechados) : (teto ?? 0)
})

/**
 * Respiro antes da cauda. UMA definição só: o desconto na largura do slot e o
 * deslocamento da barra de cauda são o mesmo fato, e mantê-los como duas
 * expressões independentes deixava a cauda escorregar pra fora (ou abrir um
 * buraco) se só uma fosse alterada.
 */
const respiroCauda = computed(() => (temCauda.value && nLinear.value > 0 ? CAUDA_GAP : 0))

/** Largura nominal de um balde. Cada balde ocupa uma fatia igual da largura. */
const larguraSlot = computed(() => {
  const total = props.dist.buckets.length
  if (total === 0) return 0
  return (W - respiroCauda.value) / total
})

/** Faixa horizontal ocupada pelo eixo linear (0 -> domínio). */
const larguraLinear = computed(() => larguraSlot.value * nLinear.value)

/**
 * Única função de escala do componente: valor do KPI -> x no viewBox.
 * Barras, linha da mediana E rótulos do eixo passam por aqui, então tudo cai
 * por construção onde o valor cai — não há duas contas pra divergir.
 */
function escalaX(valor: number): number {
  if (dominio.value <= 0 || larguraLinear.value <= 0) return 0
  const preso = Math.min(Math.max(valor, 0), dominio.value)
  return (preso / dominio.value) * larguraLinear.value
}

const maiorN = computed(() => Math.max(1, ...props.dist.buckets.map((b) => b.n)))

/**
 * Altura da barra em ESCALA DE RAIZ QUADRADA — troca deliberada de
 * proporcionalidade por legibilidade, e o motivo está no dado real.
 *
 * No KPI-07B de produção o primeiro balde concentra 80% da massa (99.710 de
 * 124.558 casos). Em escala linear todo o resto desaba no piso de 3px: a cauda
 * (6.231 casos) sairia a 3,5px e baldes de 574 e 1.805 casos ficariam com
 * altura idêntica. O canal de altura não ficaria só mudo — ficaria
 * contra-informativo, sugerindo "depois do zero é tudo igualmente raro" quando
 * a distribuição de fato decai de 1.658 para 574 ao longo de 8 horas. E este é
 * exatamente o gráfico que motivou a feature. KPI-01 e KPI-05 degeneram igual.
 *
 * O custo é real: altura deixa de ser proporcional à contagem, então o gráfico
 * DECLARA isso (nota visível, aria-label e legenda da tabela) em vez de deixar
 * o leitor supor. As contagens exatas seguem no tooltip e na tabela.
 */
function alturaBarra(n: number): number {
  if (n <= 0) return 0
  return Math.max(ALTURA_MIN, Math.sqrt(n / maiorN.value) * H)
}

/**
 * Topo arredondado + base reta. `rx` num <rect> arredondaria também a base e a
 * barra pareceria flutuar acima da linha de base — por isso o path à mão.
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

/** "caso" no singular só quando n é exatamente 1 — "1 casos" denuncia gerador. */
function pluralCasos(n: number): string {
  return n === 1 ? 'caso' : 'casos'
}

/**
 * Largura aproximada de um texto no viewBox. SVG não mede texto sem renderizar,
 * então a estimativa é deliberadamente generosa: ela decide se dois rótulos se
 * atropelam, e errar pra mais só custa um rótulo escondido a mais.
 */
function larguraTexto(t: string): number {
  return t.length * FONTE * 0.62
}

function faixaLegivel(de: number, ate: number | null): string {
  const u = props.dist.unidade_tempo
  return ate === null
    ? `≥ ${formatDuration(de, u)}`
    : `${formatDuration(de, u)} – ${formatDuration(ate, u)}`
}

const barras = computed(() =>
  props.dist.buckets.map((b) => {
    const cauda = b.ate === null
    // A cauda não tem limite superior: ocupa um slot fixo depois do eixo linear.
    const x = cauda ? larguraLinear.value + respiroCauda.value : escalaX(b.de)
    const fim = cauda ? x + larguraSlot.value : escalaX(b.ate as number)
    const largura = Math.max(0.5, fim - x - GAP)
    const altura = alturaBarra(b.n)
    return {
      cauda,
      // Cor de alerta só quando a cauda é de fato o extremo lento de um eixo.
      // No caso degenerado o único balde é "todos os casos" — pintá-lo de laranja
      // diria "isto está ruim" sobre a situação mais saudável possível.
      lenta: cauda && nLinear.value > 0,
      x,
      largura,
      altura,
      d: altura > 0 ? caminhoBarra(x, largura, altura) : null,
      faixa: faixaLegivel(b.de, b.ate),
      n: b.n,
      titulo: `${faixaLegivel(b.de, b.ate)} · ${b.n.toLocaleString('pt-BR')} ${pluralCasos(b.n)}`,
    }
  }),
)

/**
 * x da mediana no eixo linear. `null` quando não há eixo (caso degenerado: todos
 * os casos zerados, teto = 0) — ali não existe posição honesta pra desenhar.
 */
const medianaX = computed(() => {
  if (props.dist.p50 === null || larguraLinear.value <= 0) return null
  return escalaX(props.dist.p50)
})

/** Mantém o rótulo dentro do viewBox mesmo com a mediana colada numa das pontas. */
const medianaAncora = computed(() => {
  const x = medianaX.value
  if (x === null) return 'middle'
  if (x < W * 0.25) return 'start'
  if (x > W * 0.75) return 'end'
  return 'middle'
})

const rotuloMediana = computed(
  () => `mediana · ${formatDuration(props.dist.p50, props.dist.unidade_tempo)}`,
)

/**
 * Marca o FIM DO EIXO, não a identidade da cauda — por isso sem "≥" e ancorada
 * em `larguraLinear`, não na borda do viewBox. Fixá-la em W fazia o leitor
 * calibrar a escala mental sobre 280 unidades quando o eixo acaba em ~260, e
 * todo valor lido do gráfico saía ~7% menor. A cauda continua identificada pela
 * cor, pelo respiro, pelo rótulo de contagem e pelo tooltip.
 */
const rotuloFimEixo = computed(() =>
  formatDuration(dominio.value, props.dist.unidade_tempo),
)

/** A barra de cauda, quando ela é o extremo lento de um eixo de verdade. */
const barraCauda = computed(() => {
  const b = barras.value[barras.value.length - 1]
  return b && b.lenta && b.n > 0 ? b : null
})

/**
 * Rótulo de contagem da cauda. Sem ele o leitor vidente recebe um toco de 3px
 * indistinguível dos baldes de 1 caso ao lado e precisa passar o mouse pra
 * saber de quanta gente se trata — justamente o dado que o componente existe
 * pra mostrar, e que só o leitor de tela estava recebendo.
 */
const rotuloCauda = computed(() => {
  const b = barraCauda.value
  if (!b) return null
  const texto = `${formatCount(b.n)} ${pluralCasos(b.n)}`
  // O rótulo é bem mais largo que o slot da cauda (~15 un.), então ele sempre
  // invade as colunas vizinhas. Por isso a altura que importa não é a da cauda,
  // e sim a da barra MAIS ALTA que ele cobre — um filtro estreito deixa o
  // último balde linear alto e era ele que engolia o texto. Escrever "por
  // dentro" não resolve: o rótulo transborda a barra e a tinta clara sumiria no
  // fundo do card. Não cabendo acima de todas, ele sobe pra faixa de anotações
  // — onde não há barra, mas onde o rótulo da mediana também mora (ver
  // `medianaOculta`, que resolve a disputa entre os dois).
  const bordaEsquerda = b.x + b.largura - larguraTexto(texto)
  const alturaCoberta = Math.max(
    ...barras.value.filter((o) => o.x + o.largura > bordaEsquerda).map((o) => o.altura),
  )
  const acima = H - alturaCoberta - 3
  const naFaixa = acima < FONTE
  return {
    texto,
    x: b.x + b.largura,
    y: naFaixa ? TOPO - 4 : TOPO + acima,
    naFaixa,
  }
})

/**
 * Some com o TEXTO da mediana (a linha tracejada fica) quando ele bateria no
 * rótulo da cauda na faixa de anotações.
 *
 * Isto é alcançável, não teórico: numa métrica quase constante dentro de um
 * recorte filtrado todos os casos caem no balde de cauda, então a cauda vira o
 * pico (e sobe pra faixa) enquanto `p50 ≈ teto` empurra a mediana pro extremo
 * direito. As duas condições passaram a ser a MESMA forma de distribuição
 * quando o gatilho da faixa passou a olhar a altura do vizinho — antes eram
 * quase independentes, e por isso se excluíam.
 *
 * Esconder o texto é barato: o card de KPI logo acima já mostra a mediana. É a
 * premissa fundadora do componente — o card dá a mediana, o histograma mostra
 * o que ela esconde.
 */
const medianaOculta = computed(() => {
  const rc = rotuloCauda.value
  const mx = medianaX.value
  if (!rc || !rc.naFaixa || mx === null) return false
  const largura = larguraTexto(rotuloMediana.value)
  const direitaMediana =
    medianaAncora.value === 'start'
      ? mx + largura
      : medianaAncora.value === 'middle'
        ? mx + largura / 2
        : mx
  return direitaMediana > rc.x - larguraTexto(rc.texto)
})

/**
 * A escala comprimida só precisa ser declarada quando há mais de uma barra pra
 * comparar — com uma barra só não existe proporção entre alturas pra distorcer.
 */
const temEscalaComprimida = computed(() => barras.value.length > 1)

const AVISO_ESCALA =
  'Alturas em escala de raiz quadrada: comprimem as diferenças para manter as faixas raras visíveis, então não são proporcionais às contagens'

const casosNaCauda = computed(() => {
  const bs = props.dist.buckets
  return temCauda.value ? bs[bs.length - 1].n : 0
})

/**
 * Descrição falada do gráfico: fala de mediana e do fim do eixo, nunca de p95
 * (que não escala nada aqui). No KPI-07B a mediana sai como "< 1 min" — e o
 * ponto do gráfico é justamente contrastar isso com a cauda.
 * Acentuada de propósito: é string falada por leitor de tela em pt-BR.
 */
const descricao = computed(() => {
  const u = props.dist.unidade_tempo
  const partes = [
    `Distribuição de ${props.dist.n_total.toLocaleString('pt-BR')} ${pluralCasos(props.dist.n_total)}`,
    `mediana ${formatDuration(props.dist.p50, u)}`,
  ]
  if (nLinear.value > 0) {
    partes.push(`eixo de zero a ${formatDuration(dominio.value, u)}`)
    partes.push(
      `última barra reúne ${casosNaCauda.value.toLocaleString('pt-BR')} ${pluralCasos(casosNaCauda.value)} ${casosNaCauda.value === 1 ? 'igual' : 'iguais'} ou acima desse limite`,
    )
  } else {
    partes.push('todos os casos numa única faixa')
  }
  if (temEscalaComprimida.value) partes.push(AVISO_ESCALA)
  return `${partes.join('. ')}.`
})

/** A tabela já traz os números; a legenda só a nomeia, sem repetir a descrição. */
const legendaTabela = computed(() => {
  const base = `Casos por faixa de tempo (${props.dist.n_total.toLocaleString('pt-BR')} no total).`
  // A tabela é a via que preserva a proporção — vale dizer que o desenho não preserva.
  return temEscalaComprimida.value
    ? `${base} No gráfico as alturas usam escala de raiz quadrada; os números abaixo são as contagens exatas.`
    : base
})
</script>

<template>
  <!--
    Série única (contagem por faixa), então sem legenda: o card já diz o que
    está plotado. A cauda usa o token `warning` porque não é "outra série" — é o
    extremo lento da mesma medida, coerente com o termômetro de tempos do resto
    do app — e vem acompanhada do rótulo de contagem e do tooltip, nunca só pela cor.
  -->
  <div v-if="temDados" class="w-full">
    <svg
      :viewBox="`0 0 ${W} ${TOPO + H + BASE}`"
      class="w-full h-auto select-none"
      role="img"
      :aria-label="descricao"
    >
      <!--
        Rótulo da mediana mora acima do plot pra nunca colidir com o eixo. Cede
        a vez pro rótulo da cauda quando os dois disputam a faixa: a linha
        tracejada continua marcando a posição, e o valor já está no card acima.
      -->
      <text
        v-if="medianaX !== null && !medianaOculta"
        data-mediana-rotulo
        :x="medianaX"
        :y="TOPO - 4"
        :text-anchor="medianaAncora"
        :font-size="FONTE"
        class="fill-text-muted dark:fill-text-dark-muted"
      >{{ rotuloMediana }}</text>

      <g :transform="`translate(0, ${TOPO})`">
        <!-- Linha de base: hairline sólida, recessiva -->
        <line
          :x1="0" :x2="W" :y1="H" :y2="H"
          class="stroke-border dark:stroke-border-dark" stroke-width="1"
        />

        <g
          v-for="(b, i) in barras"
          :key="i"
          data-balde
          :data-cauda="b.cauda ? '' : undefined"
          :data-altura="n2(b.altura)"
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
          Anotação (não gridline): tracejada de propósito, e com um traço de
          fundo pra continuar legível ao cruzar uma barra. O traço assume que o
          host pinta `bg-surface`/`bg-surface-dark` (é o caso do BaseCard, onde
          este gráfico vive); noutro fundo ele apareceria como um vinco claro.
        -->
        <template v-if="medianaX !== null">
          <!-- 3,5 = os 1,5 da linha + 1 de halo de cada lado -->
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

      <!--
        Contagem da cauda: o toco sozinho não diz nada a quem enxerga. Pintada
        DEPOIS do grupo do plot (em SVG quem vem depois fica por cima): o rótulo
        é bem mais largo que o slot da cauda e sempre invade a coluna do último
        balde linear, que um filtro estreito o bastante deixa alto. O halo (fino:
        a 9px um traço grosso engole o miolo da letra) é a segunda linha de
        defesa — a primeira é o rótulo subir acima da barra mais alta que cobre.
      -->
      <text
        v-if="rotuloCauda"
        data-cauda-n
        :x="rotuloCauda.x" :y="rotuloCauda.y" text-anchor="end" :font-size="FONTE"
        paint-order="stroke"
        stroke-width="1.5"
        class="fill-text-muted dark:fill-text-dark-muted stroke-surface dark:stroke-surface-dark"
      >{{ rotuloCauda.texto }}</text>

      <!--
        Eixo: só as duas extremidades, ancoradas onde o eixo realmente começa e
        acaba. O resto dos valores vive no tooltip e na tabela.
      -->
      <template v-if="nLinear > 0">
        <text
          x="0" :y="TOPO + H + FONTE" text-anchor="start" :font-size="FONTE"
          class="fill-text-muted dark:fill-text-dark-muted"
        >0</text>
        <text
          data-fim-eixo
          :x="larguraLinear" :y="TOPO + H + FONTE" text-anchor="end" :font-size="FONTE"
          class="fill-text-muted dark:fill-text-dark-muted"
        >{{ rotuloFimEixo }}</text>
        <!--
          Declaração da escala comprimida: sem ela o leitor supõe que altura é
          contagem. Fica no centro do eixo, longe das duas pontas rotuladas, e
          numa posição fixa — não se move com o dado, então nunca colide.
        -->
        <text
          v-if="temEscalaComprimida"
          data-aviso-escala
          :x="larguraLinear / 2" :y="TOPO + H + FONTE" text-anchor="middle" :font-size="FONTE"
          font-style="italic"
          class="fill-text-muted dark:fill-text-dark-muted"
        ><title>{{ AVISO_ESCALA }}</title>alturas não proporcionais</text>
      </template>
      <text
        v-else
        :x="W / 2" :y="TOPO + H + FONTE" text-anchor="middle" :font-size="FONTE"
        class="fill-text-muted dark:fill-text-dark-muted"
      >todos os casos numa única faixa</text>
    </svg>

    <!--
      Equivalente textual: o gráfico nunca é a única via de acesso ao dado.

      O `sr-only` vai no WRAPPER, nunca na <table> — e mexer nisso volta a
      quebrar o layout. Numa tabela com `table-layout: auto` o `width: 1px` do
      sr-only vale só como MÍNIMO: ela cresce até caber seu conteúdo, e o
      `white-space: nowrap` (também do sr-only) faz essa largura ser a da linha
      mais longa — a legenda. O `clip` esconde o desenho, mas não encolhe a
      caixa, e como ela é `position: absolute` esse box largo estica a área
      rolável do documento: overflow horizontal invisível na página inteira.
      Num <div> o `width: 1px` é respeitado de verdade e o overflow some.
    -->
    <div class="sr-only">
      <table>
        <caption>{{ legendaTabela }}</caption>
        <thead>
          <tr><th scope="col">Faixa de tempo</th><th scope="col">Casos</th></tr>
        </thead>
        <tbody>
          <tr v-for="(b, i) in barras" :key="i">
            <td>{{ b.faixa }}</td>
            <td>{{ b.n.toLocaleString('pt-BR') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
