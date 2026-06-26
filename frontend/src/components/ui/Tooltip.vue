<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'

defineProps<{ text: string }>()
const open = ref(false)
</script>

<template>
  <span class="relative inline-flex">
    <button
      type="button" class="text-text-faint hover:text-text-muted dark:text-text-dark-muted"
      :aria-label="text"
      @mouseenter="open = true" @mouseleave="open = false"
      @focus="open = true" @blur="open = false"
    >
      <Icon name="info" :size="15" />
    </button>
    <span
      v-if="open" role="tooltip"
      class="absolute z-20 bottom-full right-0 mb-1.5 w-52 px-2.5 py-1.5 rounded-lg text-[11px] leading-snug text-white bg-text dark:bg-black/90 shadow-lg"
    >
      {{ text }}
    </span>
  </span>
</template>
