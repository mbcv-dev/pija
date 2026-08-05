import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HistogramaTempos from './HistogramaTempos.vue'
import type { KpiDistribuicao } from '@/types/api.types'

/**
 * Caso normal: 16 baldes lineares cobrindo 0 -> teto (=16) + 1 balde de cauda.
 * Aqui p95 e teto coincidem — e por isso este fixture NAO consegue flagrar uma
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
 * Formato do KPI-07B: >= 95% dos casos zerados, entao o backend joga o p95 em 0
 * e o `teto` cai no maximo observado. Qualquer formula que escale por p95 aqui
 * some com a mediana (divisao por zero) ou produz NaN.
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

/** p95 valido mas menor que o teto: escalar por p95 jogaria a mediana pro fim do eixo. */
const p95Curto: KpiDistribuicao = { ...p95Zerado, p95: 4 }

/** Degenerado: todos os casos em zero — um unico balde de cauda aberta, teto 0. */
const degenerado: KpiDistribuicao = {
  codigo: 'KPI-07B',
  unidade_tempo: 'horas',
  p50: 0,
  p95: 0,
  teto: 0,
  n_total: 42,
  buckets: [{ de: 0, ate: null, n: 42 }],
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
 * Geometria lida do <rect> alvo de hover, nao do path: o rect carrega x/largura
 * como atributos proprios, entao a assercao sobrevive a qualquer mudanca no
 * jeito de serializar o path (e um sinal negativo nao passa despercebido).
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
 * So o texto DESENHADO. `svg.text()` engloba tambem os <title> (tooltips), que
 * ja contem "N casos" — asserir sobre ele daria falso positivo justamente no
 * ponto em questao: se a contagem chega ou nao a quem esta olhando.
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
    // e e o ultimo — a cauda nunca aparece no meio do eixo
    const baldes = w.findAll('[data-balde]')
    expect(baldes[baldes.length - 1].attributes('data-cauda')).toBeDefined()
  })

  it('sem dados nao renderiza nada', () => {
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
    // p50 = 2 e os baldes tem largura 1 → a linha deve coincidir com o inicio do balde 2.
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

  it('ignora o p95 quando ele e menor que o teto', () => {
    const w = mount(HistogramaTempos, { props: { dist: p95Curto } })
    // Escalado por p95 (=4) a mediana iria pro fim do eixo; pelo teto (=8), pro meio.
    expect(xDaMediana(w)).toBeCloseTo(balde(w, 8).x, 2)
  })

  it('a cauda encosta na borda do plot: nem sobra, nem deixa buraco', () => {
    // Fecha os dois lados. O respiro antes da cauda ja foi codificado em dois
    // lugares independentes; se voltarem a divergir, a cauda escorrega pra fora
    // (bound superior) ou abre um vao de 4 unidades (bound inferior).
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

  it('balde minusculo mantem altura minima visivel', () => {
    // 1 caso contra um pico de 180: proporcional daria ~0,3px — hairline invisivel,
    // exatamente a falha que o piso existe pra evitar.
    const w = mount(HistogramaTempos, { props: { dist: p95Zerado } })
    expect(balde(w, 1).altura).toBe(3)
    expect(balde(w, 16).altura).toBe(3)
  })

  it('acima do piso a altura e estritamente proporcional a contagem', () => {
    // Fixa o outro lado da fronteira: o piso nao pode virar uma escala geral.
    const w = mount(HistogramaTempos, { props: { dist: base } })
    const pico = balde(w, 0).altura // n = 16, o maior
    expect(pico).toBe(56)
    expect(balde(w, 8).altura).toBeCloseTo((pico * 8) / 16, 2) // n = 8
    expect(balde(w, 12).altura).toBeCloseTo((pico * 4) / 16, 2) // n = 4
    // n = 1 → 3,5px: logo acima do piso, entao NAO pode ser achatado pra 3.
    expect(balde(w, 15).altura).toBeCloseTo(3.5, 2)
  })

  it('balde vazio tem altura zero — ausencia nao ganha piso', () => {
    const vazios: KpiDistribuicao = {
      ...base,
      buckets: base.buckets.map((b, i) => ({ ...b, n: i === 3 ? 0 : b.n })),
    }
    const w = mount(HistogramaTempos, { props: { dist: vazios } })
    expect(balde(w, 3).altura).toBe(0)
    expect(w.findAll('[data-balde]')[3].find('path').exists()).toBe(false)
    expect(w.findAll('[data-balde]')).toHaveLength(17)
  })

  // ── Rotulos do eixo ─────────────────────────────────────────────────────

  it('o rotulo de fim de eixo fica onde o eixo acaba, nao na borda do viewBox', () => {
    // Ancorar em W fazia o leitor calibrar a escala sobre 280 unidades quando o
    // eixo acaba em ~260 — todo valor lido do grafico saia ~7% menor.
    const w = mount(HistogramaTempos, { props: { dist: base } })
    const fim = w.find('[data-fim-eixo]')
    const x = Number(fim.attributes('x'))
    // O eixo linear acaba na borda direita do ultimo balde linear (indice 15),
    // a menos do respiro entre barras.
    expect(x).toBeCloseTo(balde(w, 15).direita + 1.5, 2)
    expect(x).toBeLessThan(larguraViewBox(w))
  })

  it('o rotulo de fim de eixo nomeia o valor do eixo, sem "≥"', () => {
    // "≥ 16 dias" e a identidade do balde de cauda, nao o valor do fim do eixo.
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(w.find('[data-fim-eixo]').text()).toBe('16 dias')
  })

  it('resposta malformada com teto nulo nao vira "sem dados" no eixo', () => {
    const tetoNulo: KpiDistribuicao = {
      ...base,
      teto: null,
      buckets: base.buckets.slice(0, 16),
      n_total: 96,
    }
    const w = mount(HistogramaTempos, { props: { dist: tetoNulo } })
    expect(w.find('[data-fim-eixo]').text()).toBe('16 dias')
  })

  // ── Contagem da cauda visivel ───────────────────────────────────────────

  it('anuncia a contagem da cauda tambem para quem enxerga', () => {
    // Sem isso o toco de 3px e indistinguivel dos baldes de 1 caso ao lado, e a
    // contagem so existia no aria-label.
    const w = mount(HistogramaTempos, { props: { dist: p95Zerado } })
    expect(textosVisiveis(w)).toContain('4 casos')
  })

  it('cauda alta empurra a contagem pra faixa de anotacoes, nunca pra dentro da barra', () => {
    // O rotulo e ~2x mais largo que a barra: escrito "por dentro" ele vaza pros
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
    // Acima do plot (a faixa de anotacoes), nao sobreposto a barra.
    expect(Number(rotulo.attributes('y'))).toBeLessThanOrEqual(13)
    // E sempre em tinta de texto — nunca clara, que dependeria de estar sobre a barra.
    expect(rotulo.classes()).toContain('fill-text-muted')
    expect(w.html()).not.toContain('fill-white')
  })

  it('nao rotula contagem quando nao ha cauda de verdade', () => {
    // O rotulo do eixo degenerado diz "todos os casos ..."; o que nao pode
    // aparecer e a ANOTACAO de contagem ("42 casos") sobre o balde unico.
    const w = mount(HistogramaTempos, { props: { dist: degenerado } })
    expect(textosVisiveis(w).join(' ')).not.toMatch(/\d+ casos/)
  })

  // ── Casos degenerados ───────────────────────────────────────────────────

  it('balde unico (tudo zerado) renderiza sem NaN e sem linha de mediana', () => {
    const w = mount(HistogramaTempos, { props: { dist: degenerado } })
    expect(w.findAll('[data-balde]')).toHaveLength(1)
    expect(w.findAll('[data-cauda]')).toHaveLength(1)
    // Sem eixo linear (teto = 0) nao existe posicao honesta pra mediana.
    expect(w.find('[data-mediana]').exists()).toBe(false)
    expect(w.html()).not.toContain('NaN')
    expect(w.html()).not.toContain('Infinity')
  })

  it('so pinta a cauda de alerta quando ela e o extremo de um eixo', () => {
    // Com eixo linear a cauda e "os mais lentos" → token de alerta.
    const comEixo = mount(HistogramaTempos, { props: { dist: base } })
    expect(comEixo.find('[data-cauda] path').classes()).toContain('fill-warning')
    // Sem eixo o unico balde e "todos os casos": pinta-lo de alerta seria mentir.
    const semEixo = mount(HistogramaTempos, { props: { dist: degenerado } })
    expect(semEixo.find('[data-cauda] path').classes()).not.toContain('fill-warning')
  })

  it('sem balde de cauda o eixo ainda cobre o ultimo balde inteiro', () => {
    // Resposta fora do formato esperado (todos os baldes fechados): o ultimo
    // balde nao pode encolher a zero por causa do `teto`.
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

  it('descreve o grafico sem mencionar p95', () => {
    const w = mount(HistogramaTempos, { props: { dist: p95Zerado } })
    const rotulo = w.find('svg').attributes('aria-label')!
    expect(rotulo).toMatch(/200 casos/)
    expect(rotulo).toMatch(/mediana/i)
    expect(rotulo).not.toMatch(/95/)
  })

  it('a descricao falada usa portugues acentuado', () => {
    // String lida por leitor de tela em pt-BR: sem acento ele pronuncia errado.
    const w = mount(HistogramaTempos, { props: { dist: base } })
    const rotulo = w.find('svg').attributes('aria-label')!
    expect(rotulo).toContain('Distribuição')
    expect(rotulo).toContain('última')
    expect(rotulo).toContain('reúne')
  })

  it('o texto visivel do caso degenerado tambem vem acentuado', () => {
    const w = mount(HistogramaTempos, { props: { dist: degenerado } })
    expect(textosVisiveis(w)).toContain('todos os casos numa única faixa')
  })

  it('oferece uma tabela equivalente para leitores de tela', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(w.findAll('table tbody tr')).toHaveLength(17)
    // A legenda nomeia a tabela, sem repetir a descricao inteira do grafico.
    expect(w.find('table caption').text()).not.toBe(
      w.find('svg').attributes('aria-label'),
    )
  })
})
