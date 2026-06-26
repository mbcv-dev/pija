<script setup lang="ts">
import Icon from './Icon.vue'
import Badge from './Badge.vue'
import type { EventoItem } from '@/types/api.types'

defineProps<{ evento: EventoItem }>()

const ICON: Record<string, string> = {
  CONSULTA: 'consulta', EXAME: 'exame', INTERNACAO: 'internacao', PRONTUARIO: 'prontuario',
  CIRURGIA: 'cirurgia', PROCEDIMENTO: 'procedimento', ALTA: 'alta',
}
const DOT: Record<string, string> = {
  CONSULTA: 'bg-evento-consulta', EXAME: 'bg-evento-exame', INTERNACAO: 'bg-evento-internacao',
  PRONTUARIO: 'bg-evento-prontuario', CIRURGIA: 'bg-evento-cirurgia',
  PROCEDIMENTO: 'bg-evento-procedimento', ALTA: 'bg-evento-alta',
}

function fmtData(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="flex gap-3">
    <div class="flex flex-col items-center">
      <span class="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0" :class="DOT[evento.tipo_entidade]">
        <Icon :name="ICON[evento.tipo_entidade]" :size="13" />
      </span>
    </div>
    <div class="min-w-0 flex-1 pb-1">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm font-semibold text-text dark:text-text-dark">{{ evento.tipo_evento }}</span>
        <Badge tone="neutral">{{ evento.situacao }}</Badge>
      </div>
      <p class="text-xs text-text-muted dark:text-text-dark-muted mt-0.5">
        {{ fmtData(evento.timestamp_principal) }} · {{ evento.unidade }} · {{ evento.especialidade }}
      </p>
    </div>
  </div>
</template>
