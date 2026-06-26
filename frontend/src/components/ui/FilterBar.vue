<script setup lang="ts">
import { useFilterStore } from '@/stores/useFilterStore'
import { GRUPOS, UNIDADES, ESPECIALIDADES } from '@/types/api.types'
import FilterSelect from './FilterSelect.vue'
import SegmentedControl from './SegmentedControl.vue'
import BaseButton from './BaseButton.vue'

const filter = useFilterStore()

const groupByOptions = [
  { value: 'unidade', label: 'Por unidade' },
  { value: 'especialidade', label: 'Por especialidade' },
]
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-end gap-3">
      <FilterSelect
        label="Grupo" :options="GRUPOS"
        :model-value="filter.grupo"
        @update:model-value="filter.setGrupo($event)"
      />
      <FilterSelect
        label="Unidade executora" :options="UNIDADES"
        :model-value="filter.unidade"
        @update:model-value="filter.setUnidade($event)"
      />
      <FilterSelect
        label="Especialidade" :options="ESPECIALIDADES"
        :model-value="filter.especialidade"
        @update:model-value="filter.setEspecialidade($event)"
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
