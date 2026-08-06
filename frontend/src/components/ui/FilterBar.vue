<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useFilterStore } from '@/stores/useFilterStore'
import { useDimensoesStore } from '@/stores/useDimensoesStore'
import { expandirEspecialidades, separarEspecialidade } from '@/lib/dimensoes'
import FilterSelect from './FilterSelect.vue'
import BaseButton from './BaseButton.vue'

const filter = useFilterStore()
const dimensoes = useDimensoesStore()

// Popula os filtros com os valores reais da base (uma vez).
onMounted(() => dimensoes.load())

// ── Especialidade em 2 níveis (base → subtipo) ────────────────────────────
// A derivação é 100% no frontend: a UI seleciona bases/subtipos, mas o filtro
// enviado à API continua sendo a lista de valores BRUTOS de `especialidade`.

/** Subtipos das bases selecionadas, agrupados por base (label curta, value bruto). */
const subtipoGroups = computed(() =>
  dimensoes.especialidadeBases
    .filter((b) => filter.especialidadeBase.includes(b.base) && b.subtipos.length > 0)
    .map((b) => ({
      label: b.base,
      options: b.subtipos.map((s) => ({ value: s.valor, label: s.subtipo })),
    })),
)
const temSubtipos = computed(() => subtipoGroups.value.length > 0)

/** Aplica bases+subtipos ao store, expandindo para os valores brutos da API. */
function aplicarEspecialidade(bases: string[], subtipos: string[]): void {
  // Descarta subtipos cuja base saiu da seleção.
  const subs = subtipos.filter((v) => bases.includes(separarEspecialidade(v).base))
  filter.setEspecialidadeSelecao(
    bases, subs,
    expandirEspecialidades(dimensoes.especialidadeBases, bases, subs),
  )
}
const onBases = (bases: string[]) => aplicarEspecialidade(bases, filter.especialidadeSubtipo)
const onSubtipos = (subs: string[]) => aplicarEspecialidade(filter.especialidadeBase, subs)

// Cascata nível 1: ao trocar o Grupo, limpa os filhos e reescopa unidade+especialidade.
watch(
  () => filter.grupo,
  (g) => {
    if (filter.unidade.length) filter.setUnidades([])
    if (filter.especialidade.length || filter.especialidadeBase.length) filter.setEspecialidades([])
    void dimensoes.scopeByGrupo(g)
  },
  { deep: true },
)

// Cascata nível 2: ao trocar a Unidade, limpa a especialidade e reescopa a lista.
watch(
  () => filter.unidade,
  (u) => {
    if (filter.especialidade.length || filter.especialidadeBase.length) filter.setEspecialidades([])
    void dimensoes.scopeEspecialidades(u)
  },
  { deep: true },
)
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-end gap-3">
      <FilterSelect
        label="Especialidade" :options="dimensoes.especialidadeBasesValores"
        :model-value="filter.especialidadeBase"
        @update:model-value="onBases($event)"
      />
      <FilterSelect
        v-if="temSubtipos"
        label="Subtipo" placeholder="Todos"
        :options="[]" :groups="subtipoGroups"
        :model-value="filter.especialidadeSubtipo"
        @update:model-value="onSubtipos($event)"
      />
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
        <BaseButton v-if="filter.activeCount > 0" variant="ghost" @click="filter.reset()">
          Limpar ({{ filter.activeCount }})
        </BaseButton>
      </div>
    </div>
  </div>
</template>
