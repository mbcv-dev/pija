import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HistogramaTempos from './HistogramaTempos.vue'
import type { KpiDistribuicao } from '@/types/api.types'

/**
 * Caso normal: 16 baldes lineares cobrindo 0 -> teto (=16) + 1 balde de cauda.
 * Aqui p95 e teto coincidem — e por isso este fixture NÃO consegue flagrar uma
 * escala errada. Os fixtures `p95Zerado`/`p95Curto` abaixo existem exatamente
 * para isso.
 */
const base: KpiDistribuicao = {
  codigo: 'KPI-05',
  unidade_tempo: 'dias',
  p50: 2,
  p95: 16,
  teto: 16,
  n_total: 100,
  buckets: [
    ...Array.from({ length: 16 }, (_, i) => ({ de: i, ate: i + 1, n: 16 - i })),
    { de: 16, ate: null, n: 5 },
  ],
}

/**
 * Formato do KPI-07B: >= 95% dos casos zerados, então o backend joga o p95 em 0
 * e o `teto` cai no máximo observado. Qualquer fórmula que escale por p95 aqui
 * some com a mediana (divisão por zero) ou produz NaN.
 */
const p95Zerado: KpiDistribuicao = {
  codigo: 'KPI-07B',
  unidade_tempo: 'horas',
  p50: 4,
  p95: 0,
  teto: 8,
  n_total: 200,
  buckets: [
    ...Array.from({ length: 16 }, (_, i) => ({ de: i * 0.5, ate: (i + 1) * 0.5, n: i === 0 ? 180 : 1 })),
    { de: 8, ate: null, n: 4 },
  ],
}

/** p95 válido mas menor que o teto: escalar por p95 jogaria a mediana pro fim do eixo. */
const p95Curto: KpiDistribuicao = { ...p95Zerado, p95: 4 }

/** Degenerado: todos os casos em zero — um único balde de cauda aberta, teto 0. */
const degenerado: KpiDistribuicao = {
  codigo: 'KPI-07B',
  unidade_tempo: 'horas',
  p50: 0,
  p95: 0,
  teto: 0,
  n_total: 42,
  buckets: [{ de: 0, ate: null, n: 42 }],
}

/**
 * Forma REAL do KPI-07B em produção: 80% da massa no primeiro balde (99.710 de
 * ~122 mil), decaimento de ~1.658 até ~574 ao longo de 8,27 h e cauda de 6.231.
 * Em escala linear de altura todo o decaimento desabava no piso de 3px — este
 * fixture existe pra fixar que ele voltou a ser legível.
 */
const decaimento = Array.from({ length: 15 }, (_, k) =>
  Math.round(1658 - ((1658 - 574) * k) / 14),
)
const real07b: KpiDistribuicao = {
  codigo: 'KPI-07B',
  unidade_tempo: 'horas',
  p50: 0,
  p95: 8.2667,
  teto: 8.2667,
  n_total: 99710 + decaimento.reduce((a, b) => a + b, 0) + 6231,
  buckets: [
    { de: 0, ate: 8.2667 / 16, n: 99710 },
    ...decaimento.map((n, k) => ({
      de: ((k + 1) * 8.2667) / 16,
      ate: ((k + 2) * 8.2667) / 16,
      n,
    })),
    { de: 8.2667, ate: null, n: 6231 },
  ],
}

/**
 * Pico extremo o bastante pra que até a raiz quadrada caia no piso: 1 caso
 * contra 100 mil da sqrt ~0,18px.
 */
const picoExtremo: KpiDistribuicao = {
  codigo: 'KPI-01',
  unidade_tempo: 'dias',
  p50: 0,
  p95: 4,
  teto: 4,
  n_total: 100003,
  buckets: [
    { de: 0, ate: 1, n: 100000 },
    { de: 1, ate: 2, n: 1 },
    { de: 2, ate: 3, n: 2 },
    { de: 3, ate: 4, n: 0 },
    { de: 4, ate: null, n: 0 },
  ],
}

/**
 * Métrica quase constante num recorte filtrado: p50 = p95 = teto, então TODOS
 * os casos caem no balde de cauda. A cauda vira o pico e a mediana vai pro
 * extremo direito ao mesmo tempo — a forma que faz os dois rótulos da faixa de
 * anotações disputarem o mesmo espaço.
 */
const constante: KpiDistribuicao = {
  codigo: 'KPI-03',
  unidade_tempo: 'dias',
  p50: 8,
  p95: 8,
  teto: 8,
  n_total: 50,
  buckets: [
    ...Array.from({ length: 16 }, (_, i) => ({ de: i * 0.5, ate: (i + 1) * 0.5, n: 0 })),
    { de: 8, ate: null, n: 50 },
  ],
}

/** Recorte estreito: poucos casos, e um balde linear alto colado na cauda. */
const filtrado: KpiDistribuicao = {
  codigo: 'KPI-07B',
  unidade_tempo: 'horas',
  p50: 2,
  p95: 8,
  teto: 8,
  n_total: 40,
  buckets: [
    ...Array.from({ length: 16 }, (_, i) => ({
      de: i * 0.5, ate: (i + 1) * 0.5, n: i === 0 ? 12 : i === 15 ? 9 : 1,
    })),
    { de: 8, ate: null, n: 4 },
  ],
}

/** Cauda que é o próprio pico: empurra o rótulo dela pra faixa de anotações. */
const caudaAlta: KpiDistribuicao = {
  codigo: 'KPI-05',
  unidade_tempo: 'dias',
  p50: 14,
  p95: 16,
  teto: 16,
  n_total: 300,
  buckets: [
    ...Array.from({ length: 16 }, (_, i) => ({ de: i, ate: i + 1, n: i + 1 })),
    { de: 16, ate: null, n: 120 },
  ],
}

const semDados: KpiDistribuicao = {
  codigo: 'KPI-05',
  unidade_tempo: 'dias',
  p50: null,
  p95: null,
  teto: null,
  n_total: 0,
  buckets: [],
}

type Wrapper = ReturnType<typeof mount>

/**
 * Geometria lida do <rect> alvo de hover, não do path: o rect carrega x/largura
 * como atributos próprios, então a asserção sobrevive a qualquer mudança no
 * jeito de serializar o path (e um sinal negativo não passa despercebido).
 */
function balde(w: Wrapper, i: number) {
  const g = w.findAll('[data-balde]')[i]
  const r = g.find('rect')
  const x = Number(r.attributes('x'))
  const largura = Number(r.attributes('width'))
  return { x, largura, direita: x + largura, altura: Number(g.attributes('data-altura')) }
}

function xDaMediana(w: Wrapper): number {
  return Number(w.find('[data-mediana]').attributes('x1'))
}

/**
 * Caixa horizontal de um <text>, a partir de x + text-anchor. Usa a MESMA
 * estimativa de largura de glifo do componente (0,62 do corpo): SVG não mede
 * texto sem renderizar, e o que importa aqui é a decisão de sobreposição, que
 * é tomada com esse mesmo número dos dois lados.
 */
function caixaDeTexto(t: ReturnType<Wrapper['find']>) {
  const x = Number(t.attributes('x'))
  const largura = (t.text().length * 9) * 0.62
  const ancora = t.attributes('text-anchor') ?? 'start'
  const esquerda = ancora === 'end' ? x - largura : ancora === 'middle' ? x - largura / 2 : x
  return { esquerda, direita: esquerda + largura }
}

function larguraViewBox(w: Wrapper): number {
  return Number(w.find('svg').attributes('viewBox')!.split(' ')[2])
}

/**
 * Só o texto DESENHADO. `svg.text()` engloba também os <title> (tooltips), que
 * já contém "N casos" — asserir sobre ele daria falso positivo justamente no
 * ponto em questão: se a contagem chega ou não a quem está olhando.
 */
function textosVisiveis(w: Wrapper): string[] {
  return w.findAll('svg text').map((t) => {
    // <title> pode ser filho de um <text> (o aviso de escala tem um), e aí ele
    // entra no textContent — tem que sair pra sobrar só o que é desenhado.
    const clone = t.element.cloneNode(true) as SVGElement
    clone.querySelectorAll('title').forEach((n) => n.remove())
    return (clone.textContent ?? '').trim()
  })
}

describe('HistogramaTempos', () => {
  it('renderiza uma barra por balde', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(w.findAll('[data-balde]')).toHaveLength(17)
  })

  it('marca a linha da mediana', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(w.find('[data-mediana]').exists()).toBe(true)
  })

  it('o balde de cauda tem estilo distinto', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(w.findAll('[data-cauda]')).toHaveLength(1)
    // e é o último — a cauda nunca aparece no meio do eixo
    const baldes = w.findAll('[data-balde]')
    expect(baldes[baldes.length - 1].attributes('data-cauda')).toBeDefined()
  })

  it('sem dados não renderiza nada', () => {
    const w = mount(HistogramaTempos, { props: { dist: semDados } })
    expect(w.find('svg').exists()).toBe(false)
  })

  it('tooltip do balde traz faixa e contagem', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(w.find('[data-balde] title').text()).toMatch(/casos/)
  })

  it('tooltip da cauda anuncia o intervalo aberto', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(w.find('[data-cauda] title').text()).toMatch(/^≥/)
  })

  // ── Geometria horizontal ────────────────────────────────────────────────

  it('a mediana cai exatamente na borda esquerda do balde correspondente', () => {
    // p50 = 2 e os baldes têm largura 1 → a linha deve coincidir com o início do balde 2.
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(xDaMediana(w)).toBeCloseTo(balde(w, 2).x, 2)
  })

  it('escala o eixo pelo teto mesmo com p95 zerado (formato KPI-07B)', () => {
    const w = mount(HistogramaTempos, { props: { dist: p95Zerado } })
    // p50 = 4 num eixo 0..8 com baldes de 0,5 → borda esquerda do balde 8.
    expect(w.find('[data-mediana]').exists()).toBe(true)
    expect(xDaMediana(w)).toBeCloseTo(balde(w, 8).x, 2)
    expect(w.findAll('[data-cauda]')).toHaveLength(1)
    expect(w.html()).not.toContain('NaN')
  })

  it('ignora o p95 quando ele é menor que o teto', () => {
    const w = mount(HistogramaTempos, { props: { dist: p95Curto } })
    // Escalado por p95 (=4) a mediana iria pro fim do eixo; pelo teto (=8), pro meio.
    expect(xDaMediana(w)).toBeCloseTo(balde(w, 8).x, 2)
  })

  it('a cauda encosta na borda do plot: nem sobra, nem deixa buraco', () => {
    // Fecha os dois lados. O respiro antes da cauda já foi codificado em dois
    // lugares independentes; se voltarem a divergir, a cauda escorrega pra fora
    // (bound superior) ou abre um vão de 4 unidades (bound inferior).
    const w = mount(HistogramaTempos, { props: { dist: base } })
    const largura = larguraViewBox(w)
    const ultima = balde(w, 16)
    expect(ultima.direita).toBeLessThanOrEqual(largura + 0.01)
    expect(ultima.direita).toBeGreaterThan(largura - 3)
  })

  it('nenhuma barra ultrapassa a largura do viewBox', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    const largura = larguraViewBox(w)
    for (let i = 0; i < 17; i++) {
      expect(balde(w, i).x).toBeGreaterThanOrEqual(0)
      expect(balde(w, i).direita).toBeLessThanOrEqual(largura + 0.01)
    }
  })

  // ── Geometria vertical (o piso de altura) ───────────────────────────────

  it('balde minúsculo mantém altura mínima visível', () => {
    // 1 e 2 casos contra um pico de 100 mil: mesmo pela raiz dariam 0,18 e
    // 0,25px — hairline invisível, a falha que o piso existe pra evitar.
    const w = mount(HistogramaTempos, { props: { dist: picoExtremo } })
    expect(balde(w, 1).altura).toBe(3)
    expect(balde(w, 2).altura).toBe(3)
  })

  it('acima do piso a altura segue a RAIZ da contagem, não a contagem', () => {
    // Fixa o outro lado da fronteira: o piso não pode virar uma escala geral, e
    // a escala tem que ser mesmo a da raiz (uma asserção que passasse nos dois
    // regimes não provaria nada).
    const w = mount(HistogramaTempos, { props: { dist: base } })
    const pico = balde(w, 0).altura // n = 16, o maior
    expect(pico).toBe(56)
    // n = 8 → sqrt(1/2) do pico ≈ 39,6 (em escala linear seriam 28)
    expect(balde(w, 8).altura).toBeCloseTo(pico * Math.SQRT1_2, 2)
    expect(balde(w, 8).altura).not.toBeCloseTo((pico * 8) / 16, 1)
    // n = 4 → metade do pico (linear daria um quarto)
    expect(balde(w, 12).altura).toBeCloseTo(pico / 2, 2)
    // n = 1 → um quarto do pico; bem acima do piso, então não pode ser achatado
    expect(balde(w, 15).altura).toBeCloseTo(pico / 4, 2)
  })

  it('o decaimento real do KPI-07B fica discriminável', () => {
    // O caso âncora: 80% da massa no balde 0. Em escala linear os baldes de
    // 1.658 e 574 casos saíam AMBOS no piso de 3px — altura idêntica pra
    // contagens que diferem ~3x, sugerindo "depois do zero é tudo igualmente
    // raro" quando na verdade a distribuição decai.
    const w = mount(HistogramaTempos, { props: { dist: real07b } })
    const primeiro = balde(w, 1).altura // 1.658 casos
    const ultimo = balde(w, 15).altura // 574 casos
    expect(primeiro).toBeGreaterThan(3)
    expect(ultimo).toBeGreaterThan(3)
    expect(primeiro).toBeGreaterThan(ultimo + 2)
    // A cauda (6.231) tem que se destacar claramente dos baldes menores.
    expect(balde(w, 16).altura).toBeGreaterThan(ultimo + 5)
    // E o pico continua sendo o pico.
    expect(balde(w, 0).altura).toBe(56)
  })

  it('mudar as contagens mexe nas alturas e em mais nada', () => {
    // Prova de independência entre os eixos: dois fixtures com as MESMAS faixas
    // (mesmo `de`/`ate`, mesmo p50, mesmo teto) e contagens completamente
    // diferentes. Tudo que é horizontal — mediana, x e largura das barras —
    // tem que sair idêntico; só as alturas podem mudar. Comparar um fixture
    // consigo mesmo não prova nada disso.
    const invertido: KpiDistribuicao = {
      ...base,
      buckets: base.buckets.map((b, i) => ({ ...b, n: i + 1 })),
    }
    const a = mount(HistogramaTempos, { props: { dist: base } })
    const b = mount(HistogramaTempos, { props: { dist: invertido } })

    expect(xDaMediana(b)).toBeCloseTo(xDaMediana(a), 5)
    let alturasDiferentes = 0
    for (let i = 0; i < 17; i++) {
      expect(balde(b, i).x, `x do balde ${i}`).toBeCloseTo(balde(a, i).x, 5)
      expect(balde(b, i).largura, `largura do balde ${i}`).toBeCloseTo(balde(a, i).largura, 5)
      if (balde(b, i).altura !== balde(a, i).altura) alturasDiferentes++
    }
    // E a premissa do teste: as contagens realmente mudaram as alturas.
    expect(alturasDiferentes).toBeGreaterThan(10)
  })

  it('balde vazio tem altura zero — ausência não ganha piso', () => {
    const vazios: KpiDistribuicao = {
      ...base,
      buckets: base.buckets.map((b, i) => ({ ...b, n: i === 3 ? 0 : b.n })),
    }
    const w = mount(HistogramaTempos, { props: { dist: vazios } })
    expect(balde(w, 3).altura).toBe(0)
    expect(w.findAll('[data-balde]')[3].find('path').exists()).toBe(false)
    expect(w.findAll('[data-balde]')).toHaveLength(17)
  })

  // ── Rótulos do eixo ─────────────────────────────────────────────────────

  it('o rótulo de fim de eixo fica onde o eixo acaba, não na borda do viewBox', () => {
    // Ancorar em W fazia o leitor calibrar a escala sobre 280 unidades quando o
    // eixo acaba em ~260 — todo valor lido do gráfico saía ~7% menor.
    const w = mount(HistogramaTempos, { props: { dist: base } })
    const fim = w.find('[data-fim-eixo]')
    const x = Number(fim.attributes('x'))
    // O eixo linear acaba na borda direita do último balde linear (índice 15),
    // a menos do respiro entre barras.
    expect(x).toBeCloseTo(balde(w, 15).direita + 1.5, 2)
    expect(x).toBeLessThan(larguraViewBox(w))
  })

  it('o rótulo de fim de eixo nomeia o valor do eixo, sem "≥"', () => {
    // "≥ 16 dias" é a identidade do balde de cauda, não o valor do fim do eixo.
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(w.find('[data-fim-eixo]').text()).toBe('16 dias')
  })

  it('resposta malformada com teto nulo não vira "sem dados" no eixo', () => {
    const tetoNulo: KpiDistribuicao = {
      ...base,
      teto: null,
      buckets: base.buckets.slice(0, 16),
      n_total: 96,
    }
    const w = mount(HistogramaTempos, { props: { dist: tetoNulo } })
    expect(w.find('[data-fim-eixo]').text()).toBe('16 dias')
  })

  // ── Contagem da cauda visível ───────────────────────────────────────────

  it('anuncia a contagem da cauda também para quem enxerga', () => {
    // Sem isso o toco de 3px é indistinguível dos baldes de 1 caso ao lado, e a
    // contagem só existia no aria-label.
    const w = mount(HistogramaTempos, { props: { dist: p95Zerado } })
    expect(textosVisiveis(w)).toContain('4 casos')
  })

  it('com cauda baixa o rótulo fica DENTRO do plot, logo acima da barra', () => {
    // O outro lado da regra de posição: subir pra faixa de anotações é a exceção
    // (cauda ou vizinho altos). Sem esta asserção, uma regressão que mandasse
    // todo rótulo pra faixa — ou que errasse `acima` — passaria a suíte inteira.
    for (const [nome, dist] of [
      ['base', base],
      ['p95Zerado', p95Zerado],
      ['real07b', real07b],
    ] as Array<[string, KpiDistribuicao]>) {
      const y = Number(
        mount(HistogramaTempos, { props: { dist } }).find('[data-cauda-n]').attributes('y'),
      )
      // TOPO (13) é o topo do plot; a faixa de anotações fica acima disso.
      expect(y, nome).toBeGreaterThan(13)
      expect(y, nome).toBeLessThanOrEqual(13 + 56) // e dentro da altura do plot
    }
  })

  it('cauda alta empurra a contagem pra faixa de anotações, nunca pra dentro da barra', () => {
    // O rótulo é ~2x mais largo que a barra: escrito "por dentro" ele vaza pros
    // lados e, em tinta clara, some no fundo do card.
    const w = mount(HistogramaTempos, { props: { dist: caudaAlta } })
    const rotulo = w.find('[data-cauda-n]')
    expect(rotulo.text()).toBe('120 casos')
    // Acima do plot (a faixa de anotações), não sobreposto a barra.
    expect(Number(rotulo.attributes('y'))).toBeLessThanOrEqual(13)
  })

  it('o rótulo da cauda usa tinta de texto em qualquer posição', () => {
    // O que interessa é que ele nunca dependa de estar sobre a barra pra ser
    // legível — asserir `not.toContain('fill-white')` não guardava nada, porque
    // essa classe nunca existiu no componente.
    for (const [nome, dist] of [
      ['cauda alta (na faixa)', caudaAlta],
      ['cauda baixa (no plot)', real07b],
      ['recorte estreito', filtrado],
    ] as Array<[string, KpiDistribuicao]>) {
      const classes = mount(HistogramaTempos, { props: { dist } })
        .find('[data-cauda-n]')
        .classes()
      expect(classes, nome).toContain('fill-text-muted')
      expect(classes, nome).toContain('stroke-surface')
    }
  })

  it('um caso so e "1 caso", nao "1 casos"', () => {
    const umCaso: KpiDistribuicao = {
      ...base,
      n_total: 2,
      buckets: [
        { de: 0, ate: 1, n: 1 },
        ...Array.from({ length: 15 }, (_, i) => ({ de: i + 1, ate: i + 2, n: 0 })),
        { de: 16, ate: null, n: 1 },
      ],
    }
    const w = mount(HistogramaTempos, { props: { dist: umCaso } })
    // Anotacao da cauda
    expect(w.find('[data-cauda-n]').text()).toBe('1 caso')
    // Tooltip do balde
    expect(w.find('[data-balde] title').text()).toMatch(/1 caso$/)
    // E o plural continua valendo pra qualquer outro numero
    const w2 = mount(HistogramaTempos, { props: { dist: base } })
    expect(w2.find('[data-cauda-n]').text()).toBe('5 casos')
    expect(w2.find('[data-balde] title').text()).toMatch(/16 casos$/)
  })

  it('a fala tambem concorda em numero', () => {
    const umCaso: KpiDistribuicao = {
      ...base,
      n_total: 1,
      buckets: [
        ...Array.from({ length: 16 }, (_, i) => ({ de: i, ate: i + 1, n: 0 })),
        { de: 16, ate: null, n: 1 },
      ],
    }
    const rotulo = mount(HistogramaTempos, { props: { dist: umCaso } })
      .find('svg')
      .attributes('aria-label')!
    expect(rotulo).toContain('Distribuição de 1 caso.')
    expect(rotulo).toContain('1 caso igual ou acima')
  })

  it('não rotula contagem quando não há cauda de verdade', () => {
    // O rótulo do eixo degenerado diz "todos os casos ..."; o que não pode
    // aparecer é a ANOTAÇÃO de contagem ("42 casos") sobre o balde único.
    const w = mount(HistogramaTempos, { props: { dist: degenerado } })
    // Âncora positiva primeiro: sem ela, um `temDados` quebrado zeraria o SVG e
    // a negativa abaixo passaria por vacuidade.
    expect(w.find('svg').exists()).toBe(true)
    expect(textosVisiveis(w)).toContain('todos os casos numa única faixa')
    expect(w.find('[data-cauda-n]').exists()).toBe(false)
    expect(textosVisiveis(w).join(' ')).not.toMatch(/\d+ casos/)
  })

  it('a contagem da cauda é pintada por cima das barras', () => {
    // Em SVG quem vem depois fica por cima. O rótulo é mais largo que o slot da
    // cauda e sempre invade a coluna do último balde linear — que um filtro
    // estreito (uma unidade só, dezenas de casos) deixa alto o bastante pra
    // ocultar o texto. A escala de raiz TORNA isso mais provável, não menos.
    const w = mount(HistogramaTempos, { props: { dist: filtrado } })
    // O vizinho tem que ser alto o bastante pra DISPARAR a subida do rótulo, e
    // o gatilho real é `H - altura - 3 < FONTE`, ou seja altura > 44 (não 40, o
    // valor da era linear: uma barra de 41 a 44 satisfaria o `>40` enquanto o
    // gatilho virava falso e a asserção de verdade, logo abaixo, quebrava).
    expect(balde(w, 15).altura).toBeGreaterThan(44)
    // E mais alto que a própria cauda: só olhar pra altura da cauda não bastava.
    expect(balde(w, 15).altura).toBeGreaterThan(balde(w, 16).altura)

    // Primeira linha de defesa: o rótulo sobe pra faixa de anotações, acima de
    // TODAS as barras que ele cobre — não só acima da cauda.
    expect(Number(w.find('[data-cauda-n]').attributes('y'))).toBeLessThanOrEqual(13)

    const filhos = Array.from(w.find('svg').element.children)
    const iPlot = filhos.findIndex((e) => e.tagName.toLowerCase() === 'g')
    const iRotulo = filhos.findIndex((e) => e.hasAttribute('data-cauda-n'))
    expect(iPlot).toBeGreaterThanOrEqual(0)
    expect(iRotulo).toBeGreaterThan(iPlot)

    // E carrega o halo na cor da superfície, como a linha da mediana.
    const rotulo = w.find('[data-cauda-n]')
    expect(rotulo.attributes('paint-order')).toBe('stroke')
    expect(rotulo.classes()).toContain('stroke-surface')
  })

  // ── Disputa entre os dois rótulos da faixa de anotações ─────────────────

  it('metrica quase constante: a mediana cede o texto, mas nao a linha', () => {
    // Forma alcancavel por filtro: com p50 = p95 = teto todos os casos caem no
    // balde de cauda, entao a cauda VIRA o pico (sobe pra faixa) e ao mesmo
    // tempo a mediana vai pro extremo direito. Depois que o gatilho da faixa
    // passou a olhar a altura do VIZINHO, essas duas condicoes viraram a mesma
    // forma de distribuicao — deixaram de ser mutuamente exclusivas.
    const w = mount(HistogramaTempos, { props: { dist: constante } })
    expect(w.find('[data-cauda-n]').exists()).toBe(true)
    expect(Number(w.find('[data-cauda-n]').attributes('y'))).toBeLessThanOrEqual(13)
    // O texto some...
    expect(w.find('[data-mediana-rotulo]').exists()).toBe(false)
    // ...mas a linha tracejada continua marcando a posicao.
    expect(w.find('[data-mediana]').exists()).toBe(true)
  })

  it('os dois rotulos da faixa nunca se sobrepoem, em nenhuma forma', () => {
    // Fixa a CLASSE do defeito, nao a instancia: a regra de posicao vertical tem
    // tres entradas que se cruzam (altura da cauda, altura do vizinho, posicao
    // da mediana) e nada garantia a interacao entre os dois rotulos.
    const formas: Array<[string, KpiDistribuicao]> = [
      ['base', base],
      ['real07b', real07b],
      ['p95Zerado', p95Zerado],
      ['constante', constante],
      ['quase constante', { ...constante, p50: 7.7 }],
      ['mediana a 96% do teto', { ...constante, p50: 7.68 }],
      ['filtrado', filtrado],
      ['cauda dominante', caudaAlta],
    ]
    let comparacoes = 0
    let suprimidas = 0
    for (const [nome, dist] of formas) {
      const w = mount(HistogramaTempos, { props: { dist } })
      const mediana = w.find('[data-mediana-rotulo]')
      const cauda = w.find('[data-cauda-n]')
      if (!cauda.exists()) continue
      if (!mediana.exists()) {
        // Rótulo escondido: é a outra forma legítima de não colidir.
        suprimidas++
        continue
      }
      const yM = Number(mediana.attributes('y'))
      const yC = Number(cauda.attributes('y'))
      if (yM !== yC) continue // alturas diferentes: não disputam espaço
      comparacoes++
      expect(caixaDeTexto(mediana).direita, nome).toBeLessThanOrEqual(
        caixaDeTexto(cauda).esquerda,
      )
    }
    // SEM ISTO O TESTE MENTE: com 6 das 8 formas saindo pelo `continue`, qualquer
    // mudança que faça os rótulos nunca dividirem a faixa — ou que esconda um
    // deles sempre — deixa o laço verde sem ter verificado nada.
    expect(comparacoes, 'formas que realmente compararam caixas').toBeGreaterThan(0)
    expect(suprimidas, 'formas que resolveram por supressão').toBeGreaterThan(0)
  })

  // ── Divulgação da escala comprimida ─────────────────────────────────────

  it('declara a escala comprimida no desenho, na fala e na tabela', () => {
    // A raiz quadrada compra legibilidade vendendo proporcionalidade — o gráfico
    // tem que dizer isso, senão o leitor supõe que altura é contagem.
    const w = mount(HistogramaTempos, { props: { dist: real07b } })
    // A nota tem que carregar a CONSEQUÊNCIA (alturas não são contagens), não
    // só informar que algo foi feito com elas.
    expect(textosVisiveis(w)).toContain('alturas não proporcionais')
    expect(w.find('svg').attributes('aria-label')).toContain('raiz quadrada')
    expect(w.find('table caption').text()).toContain('raiz quadrada')
    // A frase inteira fica a um hover de distância, sem custar layout.
    expect(w.find('[data-aviso-escala] title').text()).toContain('raiz quadrada')
  })

  it('não declara escala com uma barra só — não há proporção pra distorcer', () => {
    const w = mount(HistogramaTempos, { props: { dist: degenerado } })
    expect(w.find('[data-aviso-escala]').exists()).toBe(false)
    expect(w.find('svg').attributes('aria-label')).not.toContain('raiz quadrada')
  })

  it('o aviso de escala fica no meio do eixo, longe das duas pontas rotuladas', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    const x = Number(w.find('[data-aviso-escala]').attributes('x'))
    const fimEixo = Number(w.find('[data-fim-eixo]').attributes('x'))
    expect(x).toBeCloseTo(fimEixo / 2, 2)
  })

  // ── Casos degenerados ───────────────────────────────────────────────────

  it('balde único (tudo zerado) renderiza sem NaN e sem linha de mediana', () => {
    const w = mount(HistogramaTempos, { props: { dist: degenerado } })
    expect(w.findAll('[data-balde]')).toHaveLength(1)
    expect(w.findAll('[data-cauda]')).toHaveLength(1)
    // Sem eixo linear (teto = 0) não existe posição honesta pra mediana.
    expect(w.find('[data-mediana]').exists()).toBe(false)
    expect(w.html()).not.toContain('NaN')
    expect(w.html()).not.toContain('Infinity')
  })

  it('só pinta a cauda de alerta quando ela é o extremo de um eixo', () => {
    // Com eixo linear a cauda é "os mais lentos" → token de alerta.
    const comEixo = mount(HistogramaTempos, { props: { dist: base } })
    expect(comEixo.find('[data-cauda] path').classes()).toContain('fill-warning')
    // Sem eixo o único balde é "todos os casos": pintá-lo de alerta seria mentir.
    const semEixo = mount(HistogramaTempos, { props: { dist: degenerado } })
    expect(semEixo.find('[data-cauda] path').classes()).not.toContain('fill-warning')
  })

  it('sem balde de cauda o eixo ainda cobre o último balde inteiro', () => {
    // Resposta fora do formato esperado (todos os baldes fechados): o último
    // balde não pode encolher a zero por causa do `teto`.
    const semCauda: KpiDistribuicao = {
      ...base,
      buckets: base.buckets.slice(0, 16),
      n_total: 96,
    }
    const w = mount(HistogramaTempos, { props: { dist: semCauda } })
    expect(w.findAll('[data-balde]')).toHaveLength(16)
    expect(w.findAll('[data-cauda]')).toHaveLength(0)
    expect(balde(w, 15).largura).toBeGreaterThan(5)
    expect(w.html()).not.toContain('NaN')
  })

  // ── Acessibilidade ──────────────────────────────────────────────────────

  it('descreve o gráfico sem mencionar p95', () => {
    const w = mount(HistogramaTempos, { props: { dist: p95Zerado } })
    const rotulo = w.find('svg').attributes('aria-label')!
    expect(rotulo).toMatch(/200 casos/)
    expect(rotulo).toMatch(/mediana/i)
    expect(rotulo).not.toMatch(/95/)
  })

  it('a descrição falada usa português acentuado', () => {
    // String lida por leitor de tela em pt-BR: sem acento ele pronuncia errado.
    const w = mount(HistogramaTempos, { props: { dist: base } })
    const rotulo = w.find('svg').attributes('aria-label')!
    expect(rotulo).toContain('Distribuição')
    expect(rotulo).toContain('última')
    expect(rotulo).toContain('reúne')
  })

  it('o texto visível do caso degenerado também vem acentuado', () => {
    const w = mount(HistogramaTempos, { props: { dist: degenerado } })
    expect(textosVisiveis(w)).toContain('todos os casos numa única faixa')
  })

  // ── Layout: a tabela sr-only não pode esticar a pagina ──────────────────

  it('a tabela sr-only fica DENTRO de um wrapper, nunca com a classe nela', () => {
    // Numa <table> o width:1px do sr-only vale so como minimo: ela cresce ate
    // caber a legenda (nowrap), e o box absoluto largo estica a area rolavel do
    // documento — overflow horizontal invisivel. Num <div> a largura e obedecida.
    const w = mount(HistogramaTempos, { props: { dist: real07b } })
    const tabela = w.find('table')
    expect(tabela.exists()).toBe(true)
    expect(tabela.classes()).not.toContain('sr-only')
    const pai = tabela.element.parentElement
    expect(pai?.tagName.toLowerCase()).toBe('div')
    expect(pai?.classList.contains('sr-only')).toBe(true)
  })

  it('a legenda longa continua inteira — o conserto e estrutural, nao encurtar texto', () => {
    const w = mount(HistogramaTempos, { props: { dist: real07b } })
    expect(w.find('table caption').text().length).toBeGreaterThan(100)
  })

  it('oferece uma tabela equivalente para leitores de tela', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(w.findAll('table tbody tr')).toHaveLength(17)
    // A legenda nomeia a tabela, sem repetir a descrição inteira do gráfico.
    expect(w.find('table caption').text()).not.toBe(
      w.find('svg').attributes('aria-label'),
    )
  })
})
