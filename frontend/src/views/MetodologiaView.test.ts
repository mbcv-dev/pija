// @vitest-environment jsdom
// O vite.config só liga jsdom para src/components/** — views declaram o ambiente
// aqui, como já faz GargalosView.test.ts.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MetodologiaView from './MetodologiaView.vue'
import { KPI_META } from '@/types/api.types'

// A página itera sobre um array `ordem` escrito à mão, não sobre `KPI_META`.
// Um KPI novo com metadados prontos mas ausente dali não gera erro nenhum — a
// página apenas deixa de documentá-lo, e ninguém percebe. Este teste é a única
// coisa que transforma esse esquecimento silencioso em falha visível.
describe('MetodologiaView', () => {
  it('documenta TODO KPI que tem metadados, sem esquecer nenhum', () => {
    const texto = mount(MetodologiaView).text()
    for (const [codigo, meta] of Object.entries(KPI_META)) {
      expect(texto, `código ${codigo} não listado`).toContain(codigo)
      expect(texto, `regras do ${codigo} não listadas`).toContain(meta.label)
    }
  })
})
