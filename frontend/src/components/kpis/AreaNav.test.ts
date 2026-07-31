import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AreaNav from './AreaNav.vue'

// jsdom não tem IntersectionObserver nem scrollIntoView — o componente precisa
// degradar sem quebrar (feature-detect) e o clique usa scrollIntoView se existir.

describe('AreaNav', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="area-exames"></div>'
  })

  it('renderiza um chip por área, na ordem', () => {
    const w = mount(AreaNav)
    const labels = w.findAll('[data-chip-area]').map((c) => c.text())
    expect(labels).toEqual(['Entrada', 'Consultas', 'Exames', 'Internação', 'Cirurgias'])
  })

  it('clicar num chip rola até a seção correspondente', async () => {
    const alvo = document.getElementById('area-exames')!
    const spy = vi.fn()
    ;(alvo as unknown as { scrollIntoView: typeof spy }).scrollIntoView = spy
    const w = mount(AreaNav, { attachTo: document.body })
    await w.findAll('[data-chip-area]')[2].trigger('click')
    expect(spy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    w.unmount()
  })

  it('monta sem IntersectionObserver (jsdom) sem lançar erro', () => {
    expect(() => mount(AreaNav)).not.toThrow()
  })

  describe('scroll-spy com IntersectionObserver disponível (stub)', () => {
    let observeCalls: string[]
    let disconnectCalls: number

    class FakeIntersectionObserver {
      constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
      observe(el: Element): void {
        observeCalls.push(el.id)
      }
      unobserve(): void {}
      disconnect(): void {
        disconnectCalls++
      }
      takeRecords(): IntersectionObserverEntry[] {
        return []
      }
    }

    beforeEach(() => {
      observeCalls = []
      disconnectCalls = 0
      vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('observa as seções já presentes no DOM ao montar', () => {
      document.body.innerHTML = AREA_IDS_HTML()
      const w = mount(AreaNav, { attachTo: document.body })
      expect(observeCalls.sort()).toEqual(
        ['area-cirurgias', 'area-consultas', 'area-entrada', 'area-exames', 'area-internacao'].sort(),
      )
      w.unmount()
      expect(disconnectCalls).toBe(1)
    })

    it('passa a observar seções que aparecem depois da montagem (fetch assíncrono do KpiGrid)', async () => {
      // Simula o caso real: KpiGrid mostra skeleton no mount e só cria as
      // <section id="area-*"> depois que a Promise do fetch resolve.
      document.body.innerHTML = ''
      const w = mount(AreaNav, { attachTo: document.body })
      expect(observeCalls).toEqual([])

      const secao = document.createElement('section')
      secao.id = 'area-entrada'
      document.body.appendChild(secao)

      // MutationObserver despacha no microtask queue.
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(observeCalls).toContain('area-entrada')
      w.unmount()
    })
  })
})

function AREA_IDS_HTML(): string {
  return ['entrada', 'consultas', 'exames', 'internacao', 'cirurgias']
    .map((id) => `<section id="area-${id}"></section>`)
    .join('')
}
