import { defineStore } from 'pinia'
import { ref } from 'vue'

type Theme = 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>('light')

  function apply(t: Theme): void {
    theme.value = t
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('pija-theme', t)
  }

  function init(): void {
    const saved = localStorage.getItem('pija-theme') as Theme | null
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    apply(saved ?? (prefersDark ? 'dark' : 'light'))
  }

  function toggle(): void {
    apply(theme.value === 'dark' ? 'light' : 'dark')
  }

  return { theme, init, toggle }
})
