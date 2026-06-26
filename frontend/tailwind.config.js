import { createRequire } from 'module'
const require = createRequire(import.meta.url)

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#01696f',
          hover: '#0c4e54',
          highlight: '#cedcd8',
          light: '#e8f4f4',
        },
        surface: {
          DEFAULT: '#f9f8f5',
          2: '#fbfbf9',
          offset: '#f3f0ec',
          dark: '#1a1f1e',
          'dark-2': '#222827',
          'dark-offset': '#1f2726',
        },
        text: {
          DEFAULT: '#28251d',
          muted: '#7a7974',
          faint: '#bab9b4',
          'dark': '#e8e6e1',
          'dark-muted': '#9a9891',
        },
        border: {
          DEFAULT: '#d4d1ca',
          dark: '#2e3533',
        },
        danger:  '#a13544',
        warning: '#da7101',
        caution: '#d19900',
        success: '#437a22',
        // Escala de intensidade (termômetro de tempos): 0=ótimo … 4=crítico
        intensity: {
          0: '#437a22', // verde (ótimo)
          1: '#9aa61f', // verde-amarelado
          2: '#d19900', // âmbar
          3: '#da7101', // laranja
          4: '#a13544', // vermelho (crítico)
        },
        // KPI tipo cores
        kpi: {
          '01': '#01696f',
          '03': '#3b6fa0',
          '05': '#7b4fa0',
          '06': '#a04f3b',
          '07': '#4f7b3b',
        },
        // Evento tipo cores
        evento: {
          consulta:    '#3b6fa0',
          exame:       '#7b4fa0',
          internacao:  '#a04f3b',
          prontuario:  '#01696f',
          cirurgia:    '#a03b6f',
          procedimento:'#6f6f01',
          alta:        '#437a22',
        },
      },
      fontFamily: {
        sans: ["'General Sans'", 'Inter', 'system-ui', 'sans-serif'],
        mono: ["'JetBrains Mono'", 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'count-up': 'countUp 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        card: '0 1px 4px 0 rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 16px 0 rgba(0,0,0,0.10), 0 0 0 1px rgba(1,105,111,0.15)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
