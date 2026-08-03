<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { AREAS_JORNADA, type AreaId } from '@/lib/areas'
import { useKpiStore } from '@/stores/useKpiStore'
import Icon from '@/components/ui/Icon.vue'

/**
 * Chips de atalho para as seções do dashboard (uma por área da jornada).
 * Clique rola até a seção; scroll-spy destaca a seção visível.
 * Sticky: fica à mão enquanto a página (que cresce com os gráficos) rola.
 */
const ATIVA_INICIAL = AREAS_JORNADA[0].id
const ativa = ref<AreaId>(ATIVA_INICIAL)

const AREA_IDS = new Set<AreaId>(AREAS_JORNADA.map((a) => a.id))

/** Estreita um id vindo do DOM (mundo externo) para AreaId, sem `as` cego. */
function paraAreaId(id: string): AreaId | null {
  return AREA_IDS.has(id as AreaId) ? (id as AreaId) : null
}

function irPara(id: AreaId): void {
  ativa.value = id
  document.getElementById(`area-${id}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
}

const kpiStore = useKpiStore()
let observer: IntersectionObserver | null = null

/**
 * Reobserva as seções `#area-<id>` do zero. Sempre `disconnect()` antes de
 * observar de novo: um filtro novo põe `store.loading` em `true` e o `v-else`
 * do KpiGrid DESMONTA as `<section>` antigas; quando `loading` volta a `false`
 * elas voltam como nós DOM novos. Só adicionar os que "faltam" deixaria o
 * observer preso em elementos desconectados e o scroll-spy morreria calado
 * no primeiro filtro.
 */
function sincronizarObservacoes(): void {
  if (!observer) return
  observer.disconnect()
  for (const area of AREAS_JORNADA) {
    const el = document.getElementById(`area-${area.id}`)
    if (el) observer.observe(el)
  }
}

onMounted(() => {
  // jsdom/browsers antigos: sem IntersectionObserver o spy degrada (chips seguem clicáveis).
  if (typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (entries) => {
      // A seção visível mais alta vira a ativa.
      const visiveis = entries.filter((e) => e.isIntersecting)
      if (visiveis.length === 0) return
      const topo = visiveis.reduce((a, b) =>
        a.boundingClientRect.top <= b.boundingClientRect.top ? a : b)
      const id = paraAreaId(topo.target.id.replace('area-', ''))
      if (id) ativa.value = id
    },
    // -100px = o que fica fixo no topo: AppHeader sticky (56px) + esta barra (44px).
    // As <section> do KpiGrid usam `scroll-mt-[104px]` (os 100px + 4px de respiro)
    // pro título não parar embaixo da barra ao clicar num chip. Mexer no `top-14`
    // daqui, na altura do header ou no scroll-mt exige revisar os três juntos.
    { rootMargin: '-100px 0px -60% 0px' },
  )
  // Apesar de o AreaNav vir ANTES do KpiGrid no template (ver DashboardView.vue),
  // os hooks `mounted` de toda a subárvore só disparam depois que o render
  // síncrono inteiro termina — então, se o estado do store já permitir, as
  // <section> do KpiGrid já existem no DOM quando este onMounted roda,
  // independente da ordem de declaração. Chamar aqui também protege contra um
  // futuro cache-skip no fetch ou uma reordenação dos componentes.
  sincronizarObservacoes()
})

// O KpiGrid mostra skeleton com `store.loading` e só renderiza as <section>
// no `v-else` (sem erro, sem lista vazia) quando ele vira `false` — é o gate
// que decide se as seções existem no DOM. Observar `loading` em vez de vasculhar
// o DOM (MutationObserver + subtree) dispara exatamente nessa transição, sem
// custo pra qualquer outra mutação da página (dropdown de filtro, tema, etc.).
// Se o fetch cair em erro ou lista vazia as seções não existem mesmo — reobservar
// aí só encontra 0 elementos, o que é inofensivo.
watch(
  () => kpiStore.loading,
  (loading) => {
    if (loading) return
    void nextTick().then(sincronizarObservacoes)
  },
)

onUnmounted(() => {
  // Zerar a variável (não só desconectar) importa: o `watch` acima agenda
  // `nextTick().then(sincronizarObservacoes)`, uma Promise comum que NÃO é
  // cancelada pelo unmount. Se ela resolver depois que o componente já saiu
  // (ex.: usuário navega logo após um filtro), `sincronizarObservacoes` só
  // não re-arma o observer desconectado porque o guard `if (!observer) return`
  // encontra `null` — sem isso, `observer` continuaria truthy e a função
  // reobservaria elementos num observer que nunca mais será desconectado.
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <nav
    aria-label="Áreas da jornada"
    class="sticky top-14 z-20 -mx-1 px-1 py-2 bg-surface/95 dark:bg-surface-dark/95 backdrop-blur
           flex gap-1.5 overflow-x-auto"
  >
    <button
      v-for="area in AREAS_JORNADA" :key="area.id" type="button" :data-chip-area="area.id"
      :aria-current="ativa === area.id ? 'location' : undefined"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
      :class="ativa === area.id
        ? 'bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent'
        : 'text-text-muted dark:text-text-dark-muted hover:bg-surface-offset dark:hover:bg-surface-dark-offset'"
      @click="irPara(area.id)"
    >
      <Icon :name="area.icon" :size="14" />
      {{ area.label }}
    </button>
  </nav>
</template>
