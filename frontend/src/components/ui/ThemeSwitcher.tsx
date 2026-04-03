'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme, type AccentColor } from './ThemeProvider'

const ACCENT_COLORS: { id: AccentColor; hex: string; label: string }[] = [
  { id: 'blue',   hex: '#3b82f6', label: 'Azul' },
  { id: 'purple', hex: '#8b5cf6', label: 'Roxo' },
  { id: 'green',  hex: '#10b981', label: 'Verde' },
  { id: 'red',    hex: '#ef4444', label: 'Vermelho' },
  { id: 'gold',   hex: '#d4af37', label: 'Dourado' },
]

export function ThemeSwitcher() {
  const { mode, color, setMode, setColor } = useTheme()

  return (
    <div className="flex items-center gap-2">
      {/* Toggle dark / light */}
      <button
        onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
        title={mode === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        className="w-6 h-6 flex items-center justify-center text-metis-text-dim hover:text-metis-text transition-colors rounded"
      >
        {mode === 'dark'
          ? <Sun  className="w-3.5 h-3.5" />
          : <Moon className="w-3.5 h-3.5" />}
      </button>

      <div className="w-px h-3.5 bg-metis-border" />

      {/* Dots de cor */}
      <div className="flex items-center gap-1.5" title="Cor de acento">
        {ACCENT_COLORS.map(t => (
          <button
            key={t.id}
            onClick={() => setColor(t.id)}
            title={t.label}
            className="w-3 h-3 rounded-full transition-all duration-150 hover:scale-125 flex-shrink-0"
            style={{
              backgroundColor: t.hex,
              boxShadow: color === t.id
                ? `0 0 0 1.5px rgb(var(--metis-surface)), 0 0 0 3px ${t.hex}`
                : undefined,
              opacity: color === t.id ? 1 : 0.4,
              transform: color === t.id ? 'scale(1.25)' : undefined,
            }}
          />
        ))}
      </div>
    </div>
  )
}
