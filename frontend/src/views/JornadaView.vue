<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useJornadaStore } from '@/stores/useJornadaStore'
import { elapsedLabel } from '@/lib/timeline'
import { getCiclicidade } from '@/services/api'
import type { TipoEntidade, CiclicidadeResponse } from '@/types/api.types'
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

const ciclo = ref<CiclicidadeResponse | null>(null)

watch(
  () => store.pacienteId,
  async (id) => {
    ciclo.value = null
    if (!id) return
    try {
      const data = await getCiclicidade({ paciente_id: id })
      // Guarda contra resposta fora de ordem: se o paciente mudou enquanto a
      // requisição estava em voo, descarta este resultado (senão o mini-grafo
      // de um paciente ficaria sobre a timeline de outro).
      if (store.pacienteId !== id) return
      ciclo.value = data
    } catch (e) {
      // Silencioso: a timeline continua sendo o principal. Breadcrumb p/ debug.
      console.debug('mini-grafo de ciclicidade indisponível', e)
      ciclo.value = null
    }
  },
)

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
      <BaseCard v-if="ciclo && ciclo.transicoes.length >= 2">
        <p class="text-xs text-text-muted dark:text-text-dark-muted mb-2">Fluxo de transições deste paciente</p>
        <TransitionGraph :nos="ciclo.nos" :transicoes="ciclo.transicoes" />
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
