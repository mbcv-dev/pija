<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

/** Opção simples (value = label) ou com rótulo próprio (ex.: subtipo exibido sem a base). */
export type OpcaoFiltro = string | { value: string; label: string }

const props = withDefaults(defineProps<{
  modelValue: string[]
  options: readonly OpcaoFiltro[]
  label: string
  placeholder?: string
  /** Quando informado, renderiza as opções sob cabeçalhos (optgroup). */
  groups?: readonly { label: string; options: readonly OpcaoFiltro[] }[]
}>(), { placeholder: 'Todas' })

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const aberto = ref(false)
const raiz = ref<HTMLElement | null>(null)

function normalizar(opt: OpcaoFiltro): { value: string; label: string } {
  return typeof opt === 'string' ? { value: opt, label: opt } : opt
}

// Sem `groups`, trata tudo como um único bloco sem cabeçalho.
const blocos = computed(() =>
  (props.groups ?? [{ label: '', options: props.options }])
    .map((b) => ({ label: b.label, options: b.options.map(normalizar) })),
)

// value → label, para o resumo exibir o rótulo (não o valor bruto).
const rotulos = computed(() => {
  const m = new Map<string, string>()
  for (const b of blocos.value) for (const o of b.options) m.set(o.value, o.label)
  return m
})

const resumo = computed(() => {
  if (props.modelValue.length === 0) return props.placeholder
  if (props.modelValue.length === 1) {
    const v = props.modelValue[0]
    return rotulos.value.get(v) ?? v
  }
  return `${props.modelValue.length} selecionados`
})

function alternar(valor: string): void {
  const atual = props.modelValue
  emit('update:modelValue', atual.includes(valor)
    ? atual.filter((v) => v !== valor)
    : [...atual, valor])
}

function limpar(): void { emit('update:modelValue', []) }

function onClickFora(e: MouseEvent): void {
  if (raiz.value && !raiz.value.contains(e.target as Node)) aberto.value = false
}
onMounted(() => document.addEventListener('click', onClickFora))
onUnmounted(() => document.removeEventListener('click', onClickFora))
</script>

<template>
  <div ref="raiz" class="relative flex flex-col gap-1 text-xs">
    <span class="font-medium text-text-muted dark:text-text-dark-muted">{{ label }}</span>
    <button
      type="button"
      class="px-3 py-2 rounded-xl text-sm text-left bg-surface dark:bg-surface-dark border border-border dark:border-border-dark text-text dark:text-text-dark min-w-[10rem] flex items-center justify-between gap-2"
      :aria-expanded="aberto" aria-haspopup="listbox"
      @click="aberto = !aberto"
    >
      <span class="truncate">{{ resumo }}</span>
      <span class="shrink-0 text-text-faint">▾</span>
    </button>

    <div
      v-if="aberto" role="listbox"
      class="absolute top-full left-0 z-40 mt-1 w-max min-w-full max-h-72 overflow-y-auto rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark shadow-card-hover p-1"
    >
      <button
        v-if="modelValue.length > 0" type="button"
        class="w-full text-left px-2 py-1.5 text-xs text-primary hover:bg-surface-offset dark:hover:bg-surface-dark-offset rounded-lg"
        @click="limpar"
      >
        Limpar seleção
      </button>
      <template v-for="bloco in blocos" :key="bloco.label">
        <div
          v-if="bloco.label"
          class="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-faint dark:text-text-dark-muted"
        >
          {{ bloco.label }}
        </div>
        <label
          v-for="opt in bloco.options" :key="opt.value"
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-surface-offset dark:hover:bg-surface-dark-offset"
        >
          <input
            type="checkbox" class="rounded border-border"
            :checked="modelValue.includes(opt.value)"
            @change="alternar(opt.value)"
          />
          <span class="text-sm text-text dark:text-text-dark">{{ opt.label }}</span>
        </label>
      </template>
    </div>
  </div>
</template>
