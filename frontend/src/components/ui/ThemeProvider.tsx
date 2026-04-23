'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type AccentColor = 'blue' | 'purple' | 'green' | 'red' | 'gold'

export function applyColor(c: AccentColor) {
  document.documentElement.setAttribute('data-color', c)
}

const ThemeContext = createContext<{
  color: AccentColor
  setColor: (c: AccentColor) => void
}>({ color: 'blue', setColor: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [color, setColorState] = useState<AccentColor>('blue')

  useEffect(() => {
    const supabase = createClient()

    // 1. Aplica localStorage imediatamente (sem flash)
    const savedColor = (localStorage.getItem('metis-color') as AccentColor | null) ?? 'blue'
    applyColor(savedColor)
    setColorState(savedColor)

    // 2. Sobrescreve com preferência do Supabase se logado
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const meta = user.user_metadata ?? {}
      const serverColor = meta.theme_color as AccentColor | undefined
      if (!serverColor) return
      applyColor(serverColor)
      setColorState(serverColor)
      localStorage.setItem('metis-color', serverColor)
    })
  }, [])

  function setColor(c: AccentColor) {
    applyColor(c)
    setColorState(c)
    localStorage.setItem('metis-color', c)
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) supabase.auth.updateUser({ data: { theme_color: c } })
    })
  }

  return (
    <ThemeContext.Provider value={{ color, setColor }}>
      {children}
    </ThemeContext.Provider>
  )
}
