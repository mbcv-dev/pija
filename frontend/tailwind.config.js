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
        // ── Marca "Pulso & Cuidado" — azul institucional ──
        primary: {
          DEFAULT: '#0F4C81',
          hover: '#0B3A63',
          highlight: '#CDDDEC',
          light: '#E7F0F8',
        },
        accent: {
          DEFAULT: '#2BB3D9',
          soft: '#E4F5FA',
        },
        surface: {
          DEFAULT: '#F6F8FB',
          2: '#FBFCFE',
          offset: '#EDF1F6',
          dark: '#0E1726',
          'dark-2': '#15202F',
          'dark-offset': '#1A2536',
        },
        text: {
          DEFAULT: '#14223A',
          muted: '#5A6B82',
          faint: '#A9B5C5',
          'dark': '#E6ECF4',
          'dark-muted': '#93A1B5',
        },
        border: {
          DEFAULT: '#DBE2EC',
          dark: '#243246',
        },
        danger:  '#a13544',
        warning: '#da7101',
        caution: '#d19900',
        success: '#437a22',
        // KPI tipo cores
        kpi: {
          '01': '#0F4C81', // atualizado para a brand
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
          prontuario:  '#0F4C81', // atualizado para a brand
          cirurgia:    '#a03b6f',
          procedimento:'#6f6f01',
          alta:        '#437a22',
        },
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", 'system-ui', 'sans-serif'],
        mono: ["'IBM Plex Mono'", 'monospace'],
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
        card: '0 1px 4px 0 rgba(20,34,58,0.06), 0 0 0 1px rgba(20,34,58,0.04)',
        'card-hover': '0 4px 16px 0 rgba(20,34,58,0.10), 0 0 0 1px rgba(15,76,129,0.15)',
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
