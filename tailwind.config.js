/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        deck: {
          bg: 'rgb(var(--deck-bg) / <alpha-value>)',
          surface: 'rgb(var(--deck-surface) / <alpha-value>)',
          card: 'rgb(var(--deck-card) / <alpha-value>)',
          border: 'rgb(var(--deck-border) / <alpha-value>)',
          muted: 'rgb(var(--deck-muted) / <alpha-value>)',
          text: 'rgb(var(--deck-text) / <alpha-value>)',
          bright: 'rgb(var(--deck-bright) / <alpha-value>)',
          accent: 'rgb(var(--deck-accent) / <alpha-value>)',
          accentHover: 'rgb(var(--deck-accent-hover) / <alpha-value>)',
          success: 'rgb(var(--deck-success) / <alpha-value>)',
          danger: 'rgb(var(--deck-danger) / <alpha-value>)',
          warning: 'rgb(var(--deck-warning) / <alpha-value>)',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
