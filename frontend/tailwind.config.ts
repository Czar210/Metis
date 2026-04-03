import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        metis: {
          bg: '#0d0f14',
          surface: '#161b27',
          border: '#1e2533',
          accent: '#4f8ef7',
          'accent-hover': '#3a78e8',
          muted: '#4a5568',
          text: '#e2e8f0',
          'text-dim': '#8892a4',
        },
      },
    },
  },
  plugins: [],
}

export default config
