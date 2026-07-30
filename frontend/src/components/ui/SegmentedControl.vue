<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  options: { value: string; label: string }[]
  /** Nome de um data-attribute a estampar em cada botão com o valor da opção. */
  optionAttr?: string
}>()
defineEmits<{ 'update:modelValue': [value: string] }>()

const attrDaOpcao = (valor: string) => (props.optionAttr ? { [props.optionAttr]: valor } : {})
</script>

<template>
  <div class="inline-flex p-0.5 rounded-xl bg-surface-offset dark:bg-surface-dark-offset">
    <button
      v-for="opt in options" :key="opt.value" type="button"
      v-bind="attrDaOpcao(opt.value)"
      class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
      :class="opt.value === modelValue
        ? 'bg-surface dark:bg-surface-dark text-text dark:text-text-dark shadow-sm'
        : 'text-text-muted dark:text-text-dark-muted hover:text-text dark:hover:text-text-dark'"
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
