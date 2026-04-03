'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Swords, Search, Star, LogOut, MessageSquare } from 'lucide-react'
import Link from 'next/link'

type WatchedPlayer = {
  puuid: string
  label: string | null
}

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  const [search, setSearch] = useState('')
  const [user, setUser] = useState<{ email?: string; id: string } | null>(null)
  const [watched, setWatched] = useState<WatchedPlayer[]>([])
  const [loadingWatched, setLoadingWatched] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({ email: user.email, id: user.id })
        loadWatched()
      }
    })
  }, [])

  async function loadWatched() {
    setLoadingWatched(true)
    const { data } = await supabase
      .from('watched_players')
      .select('puuid, label')
      .order('created_at', { ascending: false })
    setWatched((data as WatchedPlayer[]) ?? [])
    setLoadingWatched(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    setWatched([])
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = search.trim()
    if (!q) return
    router.push(`/players/${encodeURIComponent(q)}`)
  }

  return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-metis-border bg-metis-surface">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-metis-accent" />
          <span className="font-bold text-metis-text tracking-tight">Metis</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-xs text-metis-text-dim hidden sm:block">{user.email}</span>
              <Link
                href="/chat"
                className="flex items-center gap-1.5 text-xs bg-metis-accent hover:bg-metis-accent-hover text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Chat Metis
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs text-metis-text-dim hover:text-metis-text transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:block">Sair</span>
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="text-xs bg-metis-accent hover:bg-metis-accent-hover text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              Entrar
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-metis-text mb-2">Analise qualquer invocador</h1>
          <p className="text-metis-text-dim text-sm">
            Estatísticas públicas de todos os jogadores. Login necessário para supervisão e chat tático.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-10">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="PUUID ou Riot ID (Nome#TAG)"
            className="flex-1 bg-metis-surface border border-metis-border rounded-lg px-4 py-2.5 text-sm text-metis-text placeholder-metis-muted outline-none focus:border-metis-accent transition-colors"
          />
          <button
            type="submit"
            className="flex items-center gap-2 bg-metis-accent hover:bg-metis-accent-hover text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Search className="w-4 h-4" />
            Buscar
          </button>
        </form>

        {/* Watched Players — só exibe se logado */}
        {user && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-metis-accent" />
              <h2 className="text-sm font-semibold text-metis-text-dim uppercase tracking-wide">
                Em supervisão
              </h2>
            </div>

            {loadingWatched ? (
              <p className="text-xs text-metis-text-dim">Carregando...</p>
            ) : watched.length === 0 ? (
              <p className="text-xs text-metis-text-dim">
                Nenhum jogador em supervisão. Busque um jogador e marque para acompanhar facilmente.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {watched.map(p => (
                  <li key={p.puuid}>
                    <Link
                      href={`/players/${encodeURIComponent(p.puuid)}`}
                      className="flex items-center justify-between bg-metis-surface border border-metis-border rounded-lg px-4 py-3 hover:border-metis-accent transition-colors group"
                    >
                      <div>
                        <p className="text-sm font-medium text-metis-text group-hover:text-metis-accent transition-colors">
                          {p.label ?? p.puuid}
                        </p>
                        {p.label && (
                          <p className="text-xs text-metis-text-dim font-mono mt-0.5 truncate max-w-xs">
                            {p.puuid}
                          </p>
                        )}
                      </div>
                      <Star className="w-4 h-4 text-metis-accent flex-shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
