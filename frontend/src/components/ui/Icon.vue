<script setup lang="ts">
defineProps<{ name: string; size?: number }>()

// Cada ícone é o conteúdo interno de um <svg> 24x24 viewBox, stroke currentColor.
const PATHS: Record<string, string> = {
  // nav
  dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  gargalos: '<path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/>',
  jornada: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M6 8v8"/><path d="M11 6h9"/><path d="M11 18h9"/>',
  ciclicidade: '<path d="M4 12a8 8 0 0 1 13.5-5.5L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-13.5 5.5L4 15"/><path d="M4 20v-5h5"/>',
  // KPIs
  clipboard: '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  hospital: '<rect x="4" y="7" width="16" height="14" rx="1"/><path d="M9 21v-5h6v5M12 4v3M10.5 5.5h3"/>',
  bed: '<path d="M3 7v12M3 13h18v6M21 13a4 4 0 0 0-4-4H9v4"/>',
  // tipos de evento
  consulta: '<circle cx="12" cy="8" r="3"/><path d="M6 20a6 6 0 0 1 12 0"/>',
  exame: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  internacao: '<rect x="4" y="7" width="16" height="14" rx="1"/><path d="M9 21v-5h6v5M12 4v3M10.5 5.5h3"/>',
  prontuario: '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 10h6M9 14h4"/>',
  cirurgia: '<path d="M14 4l6 6-9 9H5v-6z"/><path d="M11 7l6 6"/>',
  procedimento: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
  alta: '<path d="M5 12l5 5L20 7"/>',
  // controles
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
}
</script>

<template>
  <svg
    :width="size ?? 20" :height="size ?? 20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    v-html="PATHS[name] ?? ''"
  />
</template>
