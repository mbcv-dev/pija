<script setup lang="ts">
/**
 * Símbolo da marca PIJA — "Pulso & Cuidado".
 * Uma cruz de cuidado cujo braço horizontal é um traçado de batimento (pulso):
 * funde saúde + análise de dados.
 *
 * Uso:
 *  - Positivo (fundo claro): cores padrão (barra primary, pulso accent).
 *  - Negativo (fundo escuro/azul, ex. tile do header): bar="#FFFFFF" pulse="#5FD0EE".
 */
withDefaults(
  defineProps<{ size?: number; bar?: string; pulse?: string }>(),
  { size: 24, bar: '#0F4C81', pulse: '#2BB3D9' },
)
</script>

<template>
  <svg
    :width="size" :height="size" viewBox="0 0 100 100"
    role="img" aria-label="PIJA"
  >
    <rect x="43" y="20" width="14" height="60" rx="7" :fill="bar" />
    <polyline
      points="14,50 33,50 39,50 45,34 52,67 58,44 65,50 86,50"
      fill="none" :stroke="pulse" stroke-width="8.5"
      stroke-linecap="round" stroke-linejoin="round"
    />
  </svg>
</template>
