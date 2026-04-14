'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Swords, BarChart2, Sparkles, Users, MessageSquare, LogOut, Package, Crown } from 'lucide-react'
import { ThemeSwitcher } from './ThemeSwitcher'
import { createClient } from '@/lib/supabase/client'

const NAV_LINK = 'flex items-center gap-1.5 text-sm text-metis-text-dim hover:text-metis-text transition-colors px-2 py-1.5'

export function Header() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<{ email?: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser({ email: user.email })
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/')
  }

  return (
    <header className="flex items-center justify-between px-5 py-4 border-b border-metis-border bg-metis-surface">
      {/* Logo — sempre volta pro menu */}
      <Link href="/" className="flex items-center gap-2">
        <Swords className="w-6 h-6 text-metis-accent" />
        <span className="font-bold text-lg text-metis-text tracking-tight">Metis</span>
      </Link>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <ThemeSwitcher />

        <div className="w-px h-5 bg-metis-border mx-1" />

        {/* Nav links */}
        <Link href="/champions" className={NAV_LINK}>
          <BarChart2 className="w-4 h-4" />
          <span className="hidden sm:block">Tier List</span>
        </Link>
        <Link href="/items" className={NAV_LINK}>
          <Package className="w-4 h-4" />
          <span className="hidden sm:block">Itens</span>
        </Link>
        <Link href="/pricing" className={NAV_LINK}>
          <Crown className="w-4 h-4" />
          <span className="hidden sm:block">Planos</span>
        </Link>
        <Link href="/changelog" className={NAV_LINK}>
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:block">Novidades</span>
        </Link>
        <Link href="/team" className={NAV_LINK}>
          <Users className="w-4 h-4" />
          <span className="hidden sm:block">Equipe</span>
        </Link>

        <div className="w-px h-5 bg-metis-border mx-1" />

        {/* Auth */}
        {user ? (
          <>
            <span className="text-xs text-metis-text-dim hidden sm:block">{user.email}</span>
            <Link
              href="/chat"
              className="flex items-center gap-1.5 text-sm bg-metis-accent hover:bg-metis-accent-hover text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:block">Chat Metis</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-metis-text-dim hover:text-metis-text transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Sair</span>
            </button>
          </>
        ) : (
          <Link
            href="/auth"
            className="text-sm bg-metis-accent hover:bg-metis-accent-hover text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            Entrar
          </Link>
        )}
      </div>
    </header>
  )
}
