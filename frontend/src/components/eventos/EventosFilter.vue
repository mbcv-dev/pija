<script setup lang="ts">
import { useEventosStore } from '@/stores/useEventosStore'
import type { TipoEntidade } from '@/types/api.types'
import EventosBadge from './EventosBadge.vue'

const eventosStore = useEventosStore()

const TIPOS: Array<{ value: TipoEntidade | ''; label: string }> = [
  { value: '',            label: 'Todos os tipos' },
  { value: 'CONSULTA',     label: 'Consulta' },
  { value: 'EXAME',        label: 'Exame' },
  { value: 'INTERNACAO',   label: 'Internação' },
  { value: 'PRONTUARIO',   label: 'Prontuário' },
  { value: 'CIRURGIA',     label: 'Cirurgia' },
  { value: 'PROCEDIMENTO', label: 'Procedimento' },
  { value: 'ALTA',         label: 'Alta' },
]

function handleTipo(e: Event): void {
  const val = (e.target as HTMLSelectElement).value
  eventosStore.setTipoEntidade(val ? (val as TipoEntidade) : null)
}
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-3 px-4 py-3
           bg-surface-2 dark:bg-surface-dark-2
           border-b border-border dark:border-border-dark"
  >
    <!-- Filtro de tipo -->
    <div class="flex items-center gap-2">
      <label
        for="eventos-tipo"
        class="text-xs font-semibold text-text-muted dark:text-text-dark-muted whitespace-nowrap"
      >
        Tipo:
      </label>
      <select
        id="eventos-tipo"
        class="px-3 py-1.5 rounded-lg text-sm border
               bg-surface dark:bg-surface-dark
               text-text dark:text-text-dark
               border-border dark:border-border-dark
               focus:ring-2 focus:ring-primary/30 focus:border-primary
               transition-colors"
        :value="eventosStore.tipoEntidade ?? ''"
        @change="handleTipo"
      >
        <option v-for="t in TIPOS" :key="t.value" :value="t.value">
          {{ t.label }}
        </option>
      </select>
    </div>

    <!-- Badges de tipo como atalhos rápidos -->
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="t in TIPOS.slice(1)"
        :key="t.value"
        type="button"
        class="transition-all duration-200"
        :class="eventosStore.tipoEntidade === t.value
          ? 'ring-2 ring-primary/50 rounded-full scale-105'
          : 'opacity-60 hover:opacity-100'"
        @click="eventosStore.setTipoEntidade(
          eventosStore.tipoEntidade === t.value ? null : (t.value as TipoEntidade)
        )"
      >
        <EventosBadge :tipo="t.value as TipoEntidade" :small="true" />
      </button>
    </div>

    <!-- Total de resultados -->
    <div class="ml-auto text-xs text-text-muted dark:text-text-dark-muted">
      <span v-if="!eventosStore.loading">
        {{ eventosStore.total.toLocaleString('pt-BR') }} eventos encontrados
      </span>
    </div>
  </div>
</template>
