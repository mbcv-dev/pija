<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useFilterStore } from '@/stores/useFilterStore'
import { useDimensoesStore } from '@/stores/useDimensoesStore'
import FilterSelect from './FilterSelect.vue'
import SegmentedControl from './SegmentedControl.vue'
import BaseButton from './BaseButton.vue'

const filter = useFilterStore()
const dimensoes = useDimensoesStore()

// Popula os filtros com os valores reais da base (uma vez).
onMounted(() => dimensoes.load())

// Cascata nível 1: ao trocar o Grupo, limpa os filhos e reescopa unidade+especialidade.
watch(
  () => filter.grupo,
  (g) => {
    if (filter.unidade.length) filter.setUnidades([])
    if (filter.especialidade.length) filter.setEspecialidades([])
    void dimensoes.scopeByGrupo(g)
  },
  { deep: true },
)

// Cascata nível 2: ao trocar a Unidade, limpa a especialidade e reescopa a lista.
watch(
  () => filter.unidade,
  (u) => {
    if (filter.especialidade.length) filter.setEspecialidades([])
    void dimensoes.scopeEspecialidades(u)
  },
  { deep: true },
)

const groupByOptions = [
  { value: 'unidade', label: 'Por unidade' },
  { value: 'especialidade', label: 'Por especialidade' },
]
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-end gap-3">
      <FilterSelect
        label="Grupo" :options="dimensoes.grupos"
        :model-value="filter.grupo"
        @update:model-value="filter.setGrupos($event)"
      />
      <FilterSelect
        label="Unidade executora"
        :options="dimensoes.unidadesValores"
        :groups="dimensoes.unidadesAgrupadas"
        :model-value="filter.unidade"
        @update:model-value="filter.setUnidades($event)"
      />
      <FilterSelect
        label="Especialidade" :options="dimensoes.especialidades"
        :model-value="filter.especialidade"
        @update:model-value="filter.setEspecialidades($event)"
      />
      <label class="flex flex-col gap-1 text-xs">
        <span class="font-medium text-text-muted dark:text-text-dark-muted">De</span>
        <input
          type="date" class="px-3 py-2 rounded-xl text-sm bg-surface dark:bg-surface-dark border border-border dark:border-border-dark text-text dark:text-text-dark"
          :value="filter.dataInicio ?? ''"
          @change="filter.setDataInicio(($event.target as HTMLInputElement).value || null)"
        />
      </label>
      <label class="flex flex-col gap-1 text-xs">
        <span class="font-medium text-text-muted dark:text-text-dark-muted">Até</span>
        <input
          type="date" class="px-3 py-2 rounded-xl text-sm bg-surface dark:bg-surface-dark border border-border dark:border-border-dark text-text dark:text-text-dark"
          :value="filter.dataFim ?? ''"
          @change="filter.setDataFim(($event.target as HTMLInputElement).value || null)"
        />
      </label>
      <div class="ml-auto flex items-center gap-3">
        <SegmentedControl
          :model-value="filter.groupBy" :options="groupByOptions"
          @update:model-value="filter.setGroupBy($event as 'unidade' | 'especialidade')"
        />
        <BaseButton v-if="filter.activeCount > 0" variant="ghost" @click="filter.reset()">
          Limpar ({{ filter.activeCount }})
        </BaseButton>
      </div>
    </div>
  </div>
</template>
