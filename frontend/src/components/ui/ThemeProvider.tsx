'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Mode = 'dark' | 'light'
export type AccentColor = 'blue' | 'purple' | 'green' | 'red' | 'gold'

export function applyMode(m: Mode) {
  document.documentElement.setAttribute('data-mode', m)
}

export function applyColor(c: AccentColor) {
  document.documentElement.setAttribute('data-color', c)
}

const ThemeContext = createContext<{
  mode: Mode
  color: AccentColor
  setMode: (m: Mode) => void
  setColor: (c: AccentColor) => void
}>({ mode: 'dark', color: 'blue', setMode: () => {}, setColor: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>('dark')
  const [color, setColorState] = useState<AccentColor>('blue')

  useEffect(() => {
    const supabase = createClient()

    // 1. Aplica localStorage imediatamente (sem flash)
    const savedMode  = (localStorage.getItem('metis-mode')  as Mode        | null) ?? 'dark'
    const savedColor = (localStorage.getItem('metis-color') as AccentColor | null) ?? 'blue'
    applyMode(savedMode)
    applyColor(savedColor)
    setModeState(savedMode)
    setColorState(savedColor)

    // 2. Sobrescreve com preferência do Supabase se logado
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const meta = user.user_metadata ?? {}
      const serverMode  = meta.theme_mode  as Mode        | undefined
      const serverColor = meta.theme_color as AccentColor | undefined
      if (!serverMode && !serverColor) return
      const m = serverMode  ?? savedMode
      const c = serverColor ?? savedColor
      applyMode(m)
      applyColor(c)
      setModeState(m)
      setColorState(c)
      localStorage.setItem('metis-mode', m)
      localStorage.setItem('metis-color', c)
    })
  }, [])

  function setMode(m: Mode) {
    applyMode(m)
    setModeState(m)
    localStorage.setItem('metis-mode', m)
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) supabase.auth.updateUser({ data: { theme_mode: m } })
    })
  }

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
    <ThemeContext.Provider value={{ mode, color, setMode, setColor }}>
      {children}
    </ThemeContext.Provider>
  )
}
