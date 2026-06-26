<script setup lang="ts">
import EventosFilter from '@/components/eventos/EventosFilter.vue'
import EventosTable from '@/components/eventos/EventosTable.vue'
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Cabeçalho da tela -->
    <div>
      <h1 class="text-2xl font-bold text-text dark:text-text-dark">
        Eventos
      </h1>
      <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">
        Exploração da jornada do paciente · dados anonimizados
      </p>
    </div>

    <!-- Aviso de privacidade -->
    <div
      class="flex items-start gap-3 p-4 rounded-xl
             bg-primary/5 dark:bg-primary/10
             border border-primary/20 dark:border-primary/30"
    >
      <span class="text-lg flex-shrink-0">🔒</span>
      <div>
        <p class="text-sm font-medium text-primary">Dados anonimizados</p>
        <p class="text-xs text-text-muted dark:text-text-dark-muted mt-0.5">
          Em conformidade com a LGPD, apenas o identificador do prontuário
          (<code class="text-primary font-mono text-[11px]">paciente_id</code>)
          é exibido. Nenhum dado pessoal (nome, CPF, idade) é armazenado ou exibido pela plataforma.
        </p>
      </div>
    </div>

    <!-- Tabela de eventos -->
    <div
      class="rounded-2xl border border-border dark:border-border-dark
             bg-surface dark:bg-surface-dark shadow-card overflow-hidden"
    >
      <!-- Filtros inline específicos de eventos -->
      <EventosFilter />

      <!-- Tabela paginada -->
      <EventosTable />
    </div>
  </div>
</template>
