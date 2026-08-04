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

/** x inicial de uma barra: o path comeca sempre em `M<x>,<baseline>`. */
function xDaBarra(html: string): number {
  const m = html.match(/d="M([\d.]+),/)
  if (!m) throw new Error(`path sem coordenada inicial: ${html}`)
  return Number(m[1])
}

function xDaBalde(w: ReturnType<typeof mount>, i: number): number {
  return xDaBarra(w.findAll('[data-balde]')[i].html())
}

function xDaMediana(w: ReturnType<typeof mount>): number {
  return Number(w.find('[data-mediana]').attributes('x1'))
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

  // ── Geometria ───────────────────────────────────────────────────────────

  it('a mediana cai exatamente na borda esquerda do balde correspondente', () => {
    // p50 = 2 e os baldes tem largura 1 → a linha deve coincidir com o inicio do balde 2.
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(xDaMediana(w)).toBeCloseTo(xDaBalde(w, 2), 2)
  })

  it('escala o eixo pelo teto mesmo com p95 zerado (formato KPI-07B)', () => {
    const w = mount(HistogramaTempos, { props: { dist: p95Zerado } })
    // p50 = 4 num eixo 0..8 com baldes de 0,5 → borda esquerda do balde 8.
    expect(w.find('[data-mediana]').exists()).toBe(true)
    expect(xDaMediana(w)).toBeCloseTo(xDaBalde(w, 8), 2)
    expect(w.findAll('[data-cauda]')).toHaveLength(1)
    expect(w.html()).not.toContain('NaN')
  })

  it('ignora o p95 quando ele e menor que o teto', () => {
    const w = mount(HistogramaTempos, { props: { dist: p95Curto } })
    // Escalado por p95 (=4) a mediana iria pro fim do eixo; pelo teto (=8), pro meio.
    expect(xDaMediana(w)).toBeCloseTo(xDaBalde(w, 8), 2)
  })

  it('nenhuma barra ultrapassa a largura do viewBox', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    const largura = Number(w.find('svg').attributes('viewBox')!.split(' ')[2])
    for (const b of w.findAll('[data-balde]')) {
      const xs = [...b.html().matchAll(/[ML]([\d.]+),/g)].map((m) => Number(m[1]))
      expect(Math.max(...xs)).toBeLessThanOrEqual(largura + 0.01)
    }
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

  it('balde com contagem zero nao vira barra, mas continua contando como balde', () => {
    const vazios: KpiDistribuicao = {
      ...base,
      buckets: base.buckets.map((b, i) => ({ ...b, n: i === 3 ? 0 : b.n })),
    }
    const w = mount(HistogramaTempos, { props: { dist: vazios } })
    expect(w.findAll('[data-balde]')).toHaveLength(17)
    expect(w.findAll('[data-balde]')[3].find('path').exists()).toBe(false)
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
    const xs = [...w.findAll('[data-balde]')[15].html().matchAll(/[ML]([\d.]+),/g)].map((m) => Number(m[1]))
    // A ultima barra ocupa a faixa final do eixo, nao um sliver colado no fim.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(5)
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

  it('oferece uma tabela equivalente para leitores de tela', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(w.findAll('table tbody tr')).toHaveLength(17)
  })

  it('so pinta a cauda de alerta quando ela e o extremo de um eixo', () => {
    // Com eixo linear a cauda e "os mais lentos" → token de alerta.
    const comEixo = mount(HistogramaTempos, { props: { dist: base } })
    expect(comEixo.find('[data-cauda] path').classes()).toContain('fill-warning')
    // Sem eixo o unico balde e "todos os casos": pinta-lo de alerta seria mentir.
    const semEixo = mount(HistogramaTempos, { props: { dist: degenerado } })
    expect(semEixo.find('[data-cauda] path').classes()).not.toContain('fill-warning')
  })
})
