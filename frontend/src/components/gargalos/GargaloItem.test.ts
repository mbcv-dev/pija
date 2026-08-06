import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GargaloItem from './GargaloItem.vue'
import type { GargaloItem as Item } from '@/types/api.types'

const item = (media: number): Item => ({
  dimensao_tipo: 'unidade',
  dimensao: 'UAC: BIOQUIMICA',
  transicao: 'KPI-05',
  media,
  n: 100,
})

describe('GargaloItem — cor sem julgamento', () => {
  it('barras de tempos muito diferentes usam a MESMA cor', () => {
    // Tempo maior nem sempre é gargalo: parte das unidades demora mais pela
    // natureza do que faz. O comprimento codifica o tempo; a cor não opina.
    const curto = mount(GargaloItem, { props: { item: item(1), position: 1, maxMedia: 100 } })
    const longo = mount(GargaloItem, { props: { item: item(100), position: 2, maxMedia: 100 } })

    const classe = (w: ReturnType<typeof mount>) =>
      w.find('[data-barra]').attributes('class') ?? ''

    expect(classe(curto)).toBe(classe(longo))
    expect(classe(curto)).not.toMatch(/intensity/)
  })

  it('o comprimento continua codificando o tempo', () => {
    const curto = mount(GargaloItem, { props: { item: item(25), position: 1, maxMedia: 100 } })
    const longo = mount(GargaloItem, { props: { item: item(100), position: 2, maxMedia: 100 } })
    const largura = (w: ReturnType<typeof mount>) =>
      parseFloat((w.find('[data-barra]').attributes('style') ?? '').replace(/[^\d.]/g, ''))
    expect(largura(longo)).toBeGreaterThan(largura(curto))
  })
})
