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

function larguraViewBox(w: Wrapper): number {
  return Number(w.find('svg').attributes('viewBox')!.split(' ')[2])
}

/**
 * Só o texto DESENHADO. `svg.text()` engloba também os <title> (tooltips), que
 * já contém "N casos" — asserir sobre ele daria falso positivo justamente no
 * ponto em questão: se a contagem chega ou não a quem está olhando.
 */
function textosVisiveis(w: Wrapper): string[] {
  return w.findAll('svg text').map((t) => t.text())
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

  it('a escala de altura não mexe na posição da mediana', () => {
    // A escala X é independente da Y; este teste tranca as duas coisas separadas.
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(xDaMediana(w)).toBeCloseTo(balde(w, 2).x, 2)
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

  it('cauda alta empurra a contagem pra faixa de anotações, nunca pra dentro da barra', () => {
    // O rótulo é ~2x mais largo que a barra: escrito "por dentro" ele vaza pros
    // lados e, em tinta clara, some no fundo do card.
    const caudaAlta: KpiDistribuicao = {
      ...base,
      p50: 14,
      n_total: 300,
      buckets: [
        ...Array.from({ length: 16 }, (_, i) => ({ de: i, ate: i + 1, n: i + 1 })),
        { de: 16, ate: null, n: 120 },
      ],
    }
    const w = mount(HistogramaTempos, { props: { dist: caudaAlta } })
    const rotulo = w.find('[data-cauda-n]')
    expect(rotulo.text()).toBe('120 casos')
    // Acima do plot (a faixa de anotações), não sobreposto a barra.
    expect(Number(rotulo.attributes('y'))).toBeLessThanOrEqual(13)
    // E sempre em tinta de texto — nunca clara, que dependeria de estar sobre a barra.
    expect(rotulo.classes()).toContain('fill-text-muted')
    expect(w.html()).not.toContain('fill-white')
  })

  it('não rotula contagem quando não há cauda de verdade', () => {
    // O rótulo do eixo degenerado diz "todos os casos ..."; o que não pode
    // aparecer é a ANOTAÇÃO de contagem ("42 casos") sobre o balde único.
    const w = mount(HistogramaTempos, { props: { dist: degenerado } })
    expect(textosVisiveis(w).join(' ')).not.toMatch(/\d+ casos/)
  })

  it('a contagem da cauda é pintada por cima das barras', () => {
    // Em SVG quem vem depois fica por cima. O rótulo é mais largo que o slot da
    // cauda e sempre invade a coluna do último balde linear — que um filtro
    // estreito (uma unidade só, dezenas de casos) deixa alto o bastante pra
    // ocultar o texto. A escala de raiz TORNA isso mais provável, não menos.
    const filtrado: KpiDistribuicao = {
      codigo: 'KPI-07B', unidade_tempo: 'horas', p50: 2, p95: 8, teto: 8, n_total: 40,
      buckets: [
        ...Array.from({ length: 16 }, (_, i) => ({
          de: i * 0.5, ate: (i + 1) * 0.5, n: i === 0 ? 12 : i === 15 ? 9 : 1,
        })),
        { de: 8, ate: null, n: 4 },
      ],
    }
    const w = mount(HistogramaTempos, { props: { dist: filtrado } })
    // O balde vizinho é mesmo alto o bastante pra alcançar o rótulo — e mais
    // alto que a própria cauda, então só olhar pra altura da cauda não bastava.
    expect(balde(w, 15).altura).toBeGreaterThan(40)
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

  // ── Divulgação da escala comprimida ─────────────────────────────────────

  it('declara a escala comprimida no desenho, na fala e na tabela', () => {
    // A raiz quadrada compra legibilidade vendendo proporcionalidade — o gráfico
    // tem que dizer isso, senão o leitor supoe que altura e contagem.
    const w = mount(HistogramaTempos, { props: { dist: real07b } })
    expect(textosVisiveis(w)).toContain('alturas comprimidas')
    expect(w.find('svg').attributes('aria-label')).toContain('raiz quadrada')
    expect(w.find('table caption').text()).toContain('raiz quadrada')
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
    // Com eixo linear a cauda e "os mais lentos" → token de alerta.
    const comEixo = mount(HistogramaTempos, { props: { dist: base } })
    expect(comEixo.find('[data-cauda] path').classes()).toContain('fill-warning')
    // Sem eixo o único balde e "todos os casos": pinta-lo de alerta seria mentir.
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

  it('oferece uma tabela equivalente para leitores de tela', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(w.findAll('table tbody tr')).toHaveLength(17)
    // A legenda nomeia a tabela, sem repetir a descrição inteira do gráfico.
    expect(w.find('table caption').text()).not.toBe(
      w.find('svg').attributes('aria-label'),
    )
  })
})
