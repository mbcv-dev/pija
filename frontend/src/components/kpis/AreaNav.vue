<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { AREAS_JORNADA, type AreaId } from '@/lib/areas'
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

let observer: IntersectionObserver | null = null
let mutationObserver: MutationObserver | null = null
const observadas = new Set<AreaId>()

/**
 * Observa as seções `#area-<id>` ainda não observadas. O KpiGrid só cria essas
 * seções depois que o fetch dos KPIs resolve (antes disso mostra skeleton), então
 * no onMounted do AreaNav elas normalmente ainda não existem — por isso isto é
 * chamado de novo via MutationObserver sempre que o DOM muda, até achar todas.
 */
function observarSecoesDisponiveis(): void {
  if (!observer) return
  for (const area of AREAS_JORNADA) {
    if (observadas.has(area.id)) continue
    const el = document.getElementById(`area-${area.id}`)
    if (el) {
      observer.observe(el)
      observadas.add(area.id)
    }
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
    { rootMargin: '-96px 0px -60% 0px' },
  )
  observarSecoesDisponiveis()

  // Seções ainda não renderizadas (KpiGrid em skeleton): fica de olho no DOM até
  // achar todas; depois disso não há mais nada novo a observar.
  if (observadas.size < AREAS_JORNADA.length && typeof MutationObserver !== 'undefined') {
    mutationObserver = new MutationObserver(() => {
      observarSecoesDisponiveis()
      if (observadas.size === AREAS_JORNADA.length) {
        mutationObserver?.disconnect()
        mutationObserver = null
      }
    })
    mutationObserver.observe(document.body, { childList: true, subtree: true })
  }
})
onUnmounted(() => {
  observer?.disconnect()
  mutationObserver?.disconnect()
})
</script>

<template>
  <nav
    aria-label="Áreas da jornada"
    class="sticky top-0 z-20 -mx-1 px-1 py-2 bg-surface/95 dark:bg-surface-dark/95 backdrop-blur
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
