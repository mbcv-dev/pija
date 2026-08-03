import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import AreaNav from './AreaNav.vue'
import { useKpiStore } from '@/stores/useKpiStore'

// jsdom não tem IntersectionObserver nem scrollIntoView — o componente precisa
// degradar sem quebrar (feature-detect) e o clique usa scrollIntoView se existir.

let pinia: Pinia

function montar(attachTo?: Element | string) {
  return mount(AreaNav, { attachTo, global: { plugins: [pinia] } })
}

function AREA_IDS_HTML(): string {
  return ['entrada', 'consultas', 'exames', 'internacao', 'cirurgias']
    .map((id) => `<section id="area-${id}"></section>`)
    .join('')
}

/** Fake mínimo de IntersectionObserver: guarda o callback e os elementos observados,
 * para os testes poderem simular entries e assertar quem está sendo observado. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  observed: Element[] = []
  /** Contadores cumulativos (não zeram em disconnect()) — usados pra provar que
   * NADA acontece depois do unmount, mesmo quando `observed` já foi limpo. */
  observeCallCount = 0
  disconnectCallCount = 0
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb
    FakeIntersectionObserver.instances.push(this)
  }
  observe(el: Element): void {
    this.observed.push(el)
    this.observeCallCount++
  }
  unobserve(el: Element): void {
    this.observed = this.observed.filter((e) => e !== el)
  }
  disconnect(): void {
    this.observed = []
    this.disconnectCallCount++
  }
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

function entry(el: Element, top: number, isIntersecting = true): IntersectionObserverEntry {
  return {
    isIntersecting,
    target: el,
    boundingClientRect: { top } as DOMRectReadOnly,
  } as IntersectionObserverEntry
}

describe('AreaNav', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="area-exames"></div>'
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('renderiza um chip por área, na ordem', () => {
    const w = montar()
    const labels = w.findAll('[data-chip-area]').map((c) => c.text())
    expect(labels).toEqual(['Entrada', 'Consultas', 'Exames', 'Internação', 'Cirurgias'])
  })

  it('a primeira área começa ativa', () => {
    const w = montar()
    const chips = w.findAll('[data-chip-area]')
    expect(chips[0]!.attributes('aria-current')).toBe('location')
    expect(chips.slice(1).every((c) => c.attributes('aria-current') === undefined)).toBe(true)
  })

  it('clicar num chip rola até a seção correspondente e o chip vira o ativo', async () => {
    const alvo = document.getElementById('area-exames')!
    const spy = vi.fn()
    ;(alvo as unknown as { scrollIntoView: typeof spy }).scrollIntoView = spy
    const w = montar(document.body)
    const chipExames = w.findAll('[data-chip-area]')[2]!
    await chipExames.trigger('click')
    expect(spy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(chipExames.attributes('aria-current')).toBe('location')
    w.unmount()
  })

  it('monta sem IntersectionObserver (jsdom) sem lançar erro', () => {
    expect(() => montar()).not.toThrow()
  })

  describe('scroll-spy com IntersectionObserver disponível (stub)', () => {
    beforeEach(() => {
      FakeIntersectionObserver.instances = []
      vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('observa as seções já presentes no DOM ao montar', () => {
      document.body.innerHTML = AREA_IDS_HTML()
      const w = montar(document.body)
      const fake = FakeIntersectionObserver.instances[0]!
      expect(fake.observed.map((el) => el.id).sort()).toEqual(
        ['area-cirurgias', 'area-consultas', 'area-entrada', 'area-exames', 'area-internacao'].sort(),
      )
      w.unmount()
    })

    it('reobserva quando o store sai do skeleton (loading true -> false)', async () => {
      // Simula o caso real: KpiGrid mostra skeleton no mount e só cria as
      // <section id="area-*"> depois que a Promise do fetch resolve.
      document.body.innerHTML = ''
      const w = montar(document.body)
      const fake = FakeIntersectionObserver.instances[0]!
      expect(fake.observed).toEqual([])

      const store = useKpiStore()
      store.loading = true
      await nextTick()
      document.body.innerHTML = AREA_IDS_HTML()
      store.loading = false
      await nextTick()
      await nextTick() // watch (post-flush) + nextTick() interno do componente

      expect(fake.observed.map((el) => el.id)).toContain('area-entrada')
      w.unmount()
    })

    it('troca de filtro destrói e recria as <section>: reobserva os nós NOVOS, não os antigos', async () => {
      document.body.innerHTML = AREA_IDS_HTML()
      const w = montar(document.body)
      const fake = FakeIntersectionObserver.instances[0]!
      const exameAntigo = document.getElementById('area-exames')!
      expect(fake.observed).toContain(exameAntigo)

      const store = useKpiStore()
      // Filtro mudou: KpiGrid volta ao skeleton e desmonta as seções antigas.
      store.loading = true
      await nextTick()
      document.body.innerHTML = ''
      // Fetch resolveu: seções voltam como nós DOM NOVOS (não os mesmos objetos).
      document.body.innerHTML = AREA_IDS_HTML()
      store.loading = false
      await nextTick()
      await nextTick()

      const exameNovo = document.getElementById('area-exames')!
      expect(exameNovo).not.toBe(exameAntigo)
      expect(fake.observed).toContain(exameNovo)
      expect(fake.observed).not.toContain(exameAntigo)
      w.unmount()
    })

    it('destaca a área correspondente quando a seção entra na viewport', async () => {
      document.body.innerHTML = AREA_IDS_HTML()
      const w = montar(document.body)
      const fake = FakeIntersectionObserver.instances[0]!
      const secaoExames = document.getElementById('area-exames')!

      fake.callback([entry(secaoExames, 40)], fake as unknown as IntersectionObserver)
      await nextTick()

      const chip = w.find('[data-chip-area="exames"]')
      expect(chip.attributes('aria-current')).toBe('location')
      w.unmount()
    })

    it('quando várias seções intersectam, a mais alta (menor top) vence', async () => {
      document.body.innerHTML = AREA_IDS_HTML()
      const w = montar(document.body)
      const fake = FakeIntersectionObserver.instances[0]!
      const secaoConsultas = document.getElementById('area-consultas')!
      const secaoExames = document.getElementById('area-exames')!

      fake.callback(
        [entry(secaoConsultas, 120), entry(secaoExames, 40)],
        fake as unknown as IntersectionObserver,
      )
      await nextTick()

      expect(w.find('[data-chip-area="exames"]').attributes('aria-current')).toBe('location')
      expect(w.find('[data-chip-area="consultas"]').attributes('aria-current')).toBeUndefined()
      w.unmount()
    })

    it('nao reobserva depois de desmontar, mesmo com uma resync ja agendada (race de nextTick)', async () => {
      // O watch de `loading` agenda `nextTick().then(sincronizarObservacoes)` —
      // uma Promise comum, que NAO é cancelada quando o componente desmonta.
      // Reproduz a janela exata do bug: deixa o watch callback rodar e agendar
      // essa Promise (um `await Promise.resolve()` é suficiente pra isso, já
      // que o flush do Vue roda antes da nossa continuação), desmonta ANTES
      // dela resolver, e só depois deixa o resto da fila de microtasks drenar.
      document.body.innerHTML = AREA_IDS_HTML()
      const w = montar(document.body)
      const fake = FakeIntersectionObserver.instances[0]!
      const store = useKpiStore()

      store.loading = true
      await nextTick()
      store.loading = false
      await Promise.resolve() // deixa o watch callback rodar (agenda a resync, ainda pendente)
      w.unmount()

      const chamadasAntesDoUnmount = fake.observeCallCount
      // Drena o resto da fila — inclui a resync pendente, se ela ainda existir.
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(fake.observeCallCount).toBe(chamadasAntesDoUnmount)
    })

    it('ignora um id desconhecido (fora do contrato de areas.ts) sem alterar o destaque', async () => {
      document.body.innerHTML = AREA_IDS_HTML()
      const w = montar(document.body)
      const fake = FakeIntersectionObserver.instances[0]!
      const elemento = document.createElement('section')
      elemento.id = 'area-bogus'
      document.body.appendChild(elemento)

      fake.callback([entry(elemento, 0)], fake as unknown as IntersectionObserver)
      await nextTick()

      // Continua na área inicial (entrada) — nada mudou.
      expect(w.find('[data-chip-area="entrada"]').attributes('aria-current')).toBe('location')
      w.unmount()
    })
  })
})
