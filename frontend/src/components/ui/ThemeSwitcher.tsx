'use client'

import { useTranslations } from 'next-intl'
import { useTheme, type AccentColor } from './ThemeProvider'

const ACCENT_COLORS: { id: AccentColor; hex: string; labelKey: 'color_blue' | 'color_purple' | 'color_green' | 'color_red' | 'color_gold' }[] = [
  { id: 'blue',   hex: '#3b82f6', labelKey: 'color_blue' },
  { id: 'purple', hex: '#8b5cf6', labelKey: 'color_purple' },
  { id: 'green',  hex: '#10b981', labelKey: 'color_green' },
  { id: 'red',    hex: '#ef4444', labelKey: 'color_red' },
  { id: 'gold',   hex: '#d4af37', labelKey: 'color_gold' },
]

export function ThemeSwitcher() {
  const { color, setColor } = useTheme()
  const t = useTranslations('header')

  return (
    <div className="flex items-center gap-1.5" title={t('accent_tooltip')}>
      {ACCENT_COLORS.map(c => (
        <button
          key={c.id}
          onClick={() => setColor(c.id)}
          title={t(c.labelKey)}
          className="w-3 h-3 rounded-full transition-all duration-150 hover:scale-125 flex-shrink-0"
          style={{
            backgroundColor: c.hex,
            boxShadow: color === c.id
              ? `0 0 0 1.5px rgb(var(--metis-surface)), 0 0 0 3px ${c.hex}`
              : undefined,
            opacity: color === c.id ? 1 : 0.4,
            transform: color === c.id ? 'scale(1.25)' : undefined,
          }}
        />
      ))}
    </div>
  )
}
