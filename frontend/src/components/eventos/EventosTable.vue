<script setup lang="ts">
import { onMounted } from 'vue'
import { useEventosStore } from '@/stores/useEventosStore'
import EventosBadge from './EventosBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'

const eventosStore = useEventosStore()

onMounted(() => {
  eventosStore.initWatcher()
  if (eventosStore.items.length === 0 && !eventosStore.loading) {
    void eventosStore.fetchEventos()
  }
})

function formatTimestamp(ts: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts))
  } catch {
    return ts
  }
}
</script>

<template>
  <div class="flex flex-col">
    <!-- Tabela com scroll horizontal -->
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border dark:border-border-dark">
            <th
              v-for="col in ['ID Evento', 'Paciente', 'Tipo', 'Unidade', 'Especialidade', 'Data/Hora', 'Situação']"
              :key="col"
              class="px-4 py-3 text-left text-xs font-semibold text-text-muted dark:text-text-dark-muted
                     uppercase tracking-wide whitespace-nowrap"
            >
              {{ col }}
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading rows -->
          <template v-if="eventosStore.loading">
            <tr
              v-for="i in 10"
              :key="i"
              class="border-b border-border/50 dark:border-border-dark/50"
            >
              <td
                v-for="j in 7"
                :key="j"
                class="px-4 py-3"
              >
                <div
                  class="h-3.5 rounded bg-surface-offset dark:bg-surface-dark-offset animate-pulse-soft"
                  :style="{ width: `${60 + j * 5}%` }"
                />
              </td>
            </tr>
          </template>

          <!-- Error -->
          <tr v-else-if="eventosStore.error">
            <td colspan="7">
              <ErrorState :message="eventosStore.error" @retry="eventosStore.fetchEventos()" />
            </td>
          </tr>

          <!-- Empty -->
          <tr v-else-if="eventosStore.items.length === 0">
            <td colspan="7">
              <EmptyState
                icon="📋"
                title="Nenhum evento encontrado"
                description="Ajuste os filtros para encontrar eventos."
              />
            </td>
          </tr>

          <!-- Dados -->
          <tr
            v-else
            v-for="evento in eventosStore.items"
            :key="evento.evento_id"
            class="border-b border-border/50 dark:border-border-dark/50
                   hover:bg-primary/5 dark:hover:bg-primary/10
                   transition-colors duration-100"
          >
            <!-- ID Evento -->
            <td class="px-4 py-3 font-mono text-xs text-text-muted dark:text-text-dark-muted whitespace-nowrap">
              {{ evento.evento_id }}
            </td>

            <!-- Paciente ID (nunca nome) -->
            <td class="px-4 py-3 font-mono text-xs whitespace-nowrap">
              <span class="text-text dark:text-text-dark">{{ evento.paciente_id }}</span>
            </td>

            <!-- Tipo com badge colorido -->
            <td class="px-4 py-3 whitespace-nowrap">
              <EventosBadge :tipo="evento.tipo_entidade" />
            </td>

            <!-- Unidade -->
            <td class="px-4 py-3 text-text dark:text-text-dark whitespace-nowrap text-xs">
              {{ evento.unidade }}
            </td>

            <!-- Especialidade -->
            <td class="px-4 py-3 text-text-muted dark:text-text-dark-muted whitespace-nowrap text-xs">
              {{ evento.especialidade }}
            </td>

            <!-- Timestamp -->
            <td class="px-4 py-3 text-xs font-mono text-text-muted dark:text-text-dark-muted whitespace-nowrap">
              {{ formatTimestamp(evento.timestamp_principal) }}
            </td>

            <!-- Situação -->
            <td class="px-4 py-3 whitespace-nowrap">
              <span
                class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium
                       bg-surface-offset dark:bg-surface-dark-offset
                       text-text-muted dark:text-text-dark-muted"
              >
                {{ evento.situacao }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Paginação -->
    <div
      v-if="!eventosStore.error && eventosStore.total > 0"
      class="flex items-center justify-between px-4 py-3 border-t border-border dark:border-border-dark"
    >
      <!-- Info de página -->
      <p class="text-xs text-text-muted dark:text-text-dark-muted">
        Página {{ eventosStore.currentPage }} de {{ eventosStore.totalPages }}
        · {{ eventosStore.total.toLocaleString('pt-BR') }} registros
      </p>

      <!-- Botões de navegação -->
      <div class="flex items-center gap-2">
        <button
          id="btn-prev-page"
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
          :disabled="!eventosStore.hasPrev || eventosStore.loading"
          :class="eventosStore.hasPrev && !eventosStore.loading
            ? 'border-border dark:border-border-dark text-text dark:text-text-dark hover:border-primary hover:text-primary'
            : 'border-border/40 dark:border-border-dark/40 text-text-faint dark:text-text-dark-muted cursor-not-allowed'"
          @click="eventosStore.prevPage()"
        >
          ← Anterior
        </button>

        <!-- Números de página (janela de 5) -->
        <div class="flex gap-1">
          <button
            v-for="page in (() => {
              const total = eventosStore.totalPages
              const current = eventosStore.currentPage
              const window = 3
              const start = Math.max(1, current - Math.floor(window / 2))
              const end = Math.min(total, start + window - 1)
              return Array.from({ length: end - start + 1 }, (_, i) => start + i)
            })()"
            :key="page"
            type="button"
            class="w-7 h-7 rounded-lg text-xs font-medium transition-colors"
            :class="page === eventosStore.currentPage
              ? 'bg-primary text-white'
              : 'text-text-muted dark:text-text-dark-muted hover:bg-primary/10 hover:text-primary'"
            @click="eventosStore.goToPage(page)"
          >
            {{ page }}
          </button>
        </div>

        <button
          id="btn-next-page"
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
          :disabled="!eventosStore.hasNext || eventosStore.loading"
          :class="eventosStore.hasNext && !eventosStore.loading
            ? 'border-border dark:border-border-dark text-text dark:text-text-dark hover:border-primary hover:text-primary'
            : 'border-border/40 dark:border-border-dark/40 text-text-faint dark:text-text-dark-muted cursor-not-allowed'"
          @click="eventosStore.nextPage()"
        >
          Próximo →
        </button>
      </div>

      <!-- Linhas por página -->
      <div class="flex items-center gap-2">
        <span class="text-xs text-text-muted dark:text-text-dark-muted">Por página:</span>
        <select
          id="select-limit"
          class="px-2 py-1 rounded-lg text-xs border
                 bg-surface dark:bg-surface-dark
                 text-text dark:text-text-dark
                 border-border dark:border-border-dark
                 focus:ring-2 focus:ring-primary/30"
          :value="eventosStore.limit"
          @change="eventosStore.setLimit(+($event.target as HTMLSelectElement).value)"
        >
          <option v-for="n in [10, 20, 50, 100]" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>
    </div>
  </div>
</template>
