import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        metis: {
          bg: 'rgb(var(--metis-bg) / <alpha-value>)',
          surface: 'rgb(var(--metis-surface) / <alpha-value>)',
          border: 'rgb(var(--metis-border) / <alpha-value>)',
          accent: 'rgb(var(--metis-accent) / <alpha-value>)',
          'accent-hover': 'rgb(var(--metis-accent-hover) / <alpha-value>)',
          muted: 'rgb(var(--metis-muted) / <alpha-value>)',
          text: 'rgb(var(--metis-text) / <alpha-value>)',
          'text-dim': 'rgb(var(--metis-text-dim) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}

export default config
