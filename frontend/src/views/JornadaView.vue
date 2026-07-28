<script setup lang="ts">
import { ref, computed } from 'vue'
import { useJornadaStore } from '@/stores/useJornadaStore'
import { elapsedLabel } from '@/lib/timeline'
import type { TipoEntidade, NoItem, TransicaoItem } from '@/types/api.types'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import TimelineItem from '@/components/ui/TimelineItem.vue'
import TimelineConnector from '@/components/ui/TimelineConnector.vue'
import TransitionGraph from '@/components/ciclicidade/TransitionGraph.vue'

const store = useJornadaStore()
const input = ref('')

// Mini-grafo do paciente: sequência ORDENADA de transições derivada da própria
// timeline (store.eventos já vem em ordem cronológica). Diferente do agregado, aqui
// cada transição carrega `ordem` = o passo cronológico, para se ler a sequência no grafo.
const ciclo = computed<{ nos: NoItem[]; transicoes: (TransicaoItem & { ordem: number })[] }>(() => {
  const evs = store.eventos
  const transicoes: (TransicaoItem & { ordem: number })[] = []
  const entradas: Record<string, number> = {}
  const saidas: Record<string, number> = {}
  for (let i = 1; i < evs.length; i++) {
    const origem = evs[i - 1].tipo_entidade
    const destino = evs[i].tipo_entidade
    const t0 = Date.parse(evs[i - 1].timestamp_principal)
    const t1 = Date.parse(evs[i].timestamp_principal)
    const tempo = Number.isNaN(t0) || Number.isNaN(t1) ? null : Math.max(0, (t1 - t0) / 1000)
    transicoes.push({ origem, destino, volume: 1, tempo_medio_s: tempo, n: 1, ordem: i })
    saidas[origem] = (saidas[origem] ?? 0) + 1
    entradas[destino] = (entradas[destino] ?? 0) + 1
  }
  const tipos = new Set<string>([...Object.keys(entradas), ...Object.keys(saidas)])
  const nos: NoItem[] = [...tipos].map((tipo) => ({
    tipo: tipo as TipoEntidade,
    total_entradas: entradas[tipo] ?? 0,
    total_saidas: saidas[tipo] ?? 0,
  }))
  return { nos, transicoes }
})

const TIPOS: TipoEntidade[] = ['CONSULTA', 'EXAME', 'INTERNACAO', 'CIRURGIA', 'PROCEDIMENTO', 'ALTA', 'PRONTUARIO']

const visiveis = computed(() =>
  store.tipoFiltro ? store.eventos.filter((e) => e.tipo_entidade === store.tipoFiltro) : store.eventos,
)

function submit(): void {
  void store.buscar(input.value)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-text dark:text-text-dark tracking-tight">Jornada do paciente</h1>
      <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">
        Busque um prontuário para ver a linha do tempo dos eventos assistenciais
      </p>
    </div>

    <!-- Busca por prontuário -->
    <form class="flex gap-2 max-w-md" @submit.prevent="submit">
      <div class="relative flex-1">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"><Icon name="search" :size="18" /></span>
        <input
          v-model="input" inputmode="numeric"
          placeholder="Número do prontuário"
          class="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm bg-surface dark:bg-surface-dark border border-border dark:border-border-dark text-text dark:text-text-dark"
        />
      </div>
      <BaseButton type="submit" variant="primary">Buscar</BaseButton>
    </form>

    <!-- Estados -->
    <EmptyState
      v-if="!store.searched"
      title="Digite um número de prontuário"
      description="A jornada mostra os eventos do paciente em ordem cronológica, com o intervalo entre cada etapa."
    />
    <BaseCard v-else-if="store.loading" class="flex flex-col gap-4">
      <Skeleton v-for="n in 5" :key="n" height="h-10" />
    </BaseCard>
    <ErrorState v-else-if="store.error" :message="store.error" @retry="store.buscar(store.pacienteId ?? '')" />
    <EmptyState v-else-if="store.eventos.length === 0" title="Nenhum evento encontrado" :description="`Prontuário ${store.pacienteId} sem eventos.`" />

    <template v-else>
      <!-- Filtro por tipo (chips) -->
      <div class="flex flex-wrap gap-2">
        <button v-for="t in TIPOS" :key="t" type="button" @click="store.setTipoFiltro(t)">
          <Badge :tone="store.tipoFiltro === t ? 'brand' : 'neutral'">{{ t }}</Badge>
        </button>
      </div>

      <!-- Mini-grafo de transições do paciente (guarda: ≥ 2 transições) -->
      <BaseCard v-if="ciclo.transicoes.length >= 2">
        <p class="text-xs text-text-muted dark:text-text-dark-muted mb-2">
          Fluxo de transições deste paciente · <span class="text-text dark:text-text-dark font-medium">os números indicam a ordem dos eventos</span>
        </p>
        <TransitionGraph :nos="ciclo.nos" :transicoes="ciclo.transicoes" escopo="paciente" />
      </BaseCard>

      <!-- Timeline -->
      <BaseCard>
        <p class="text-xs text-text-muted dark:text-text-dark-muted mb-4">
          Prontuário <span class="font-semibold text-text dark:text-text-dark">{{ store.pacienteId }}</span> ·
          {{ visiveis.length }} evento(s)
        </p>
        <div class="flex flex-col">
          <template v-for="(ev, idx) in visiveis" :key="ev.evento_id">
            <TimelineItem :evento="ev" />
            <TimelineConnector
              v-if="idx < visiveis.length - 1"
              :label="elapsedLabel(ev.timestamp_principal, visiveis[idx + 1].timestamp_principal)"
            />
          </template>
        </div>
      </BaseCard>
    </template>
  </div>
</template>
