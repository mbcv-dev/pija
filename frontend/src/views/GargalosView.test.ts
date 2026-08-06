// @vitest-environment jsdom
// O vite.config só liga jsdom para src/components/**; esta é a primeira view
// com teste, então declara o ambiente aqui em vez de alargar o glob global.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import GargalosView from './GargalosView.vue'

// A view é casca: FilterBar e GargaloList carregam store, rota e HTTP próprios e
// já têm testes dedicados. Aqui interessa só o texto que a própria view escreve.
function montar() {
  return mount(GargalosView, {
    global: { stubs: { FilterBar: true, GargaloList: true } },
  })
}

describe('GargalosView', () => {
  it('a tela avisa que tempo maior nem sempre e gargalo', () => {
    expect(montar().text()).toMatch(/nem sempre|natureza/i)
  })
})
