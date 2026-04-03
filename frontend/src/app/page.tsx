'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Swords, Search, Star, LogOut, MessageSquare, BarChart2, Sparkles, Users, TrendingUp, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher'
import { championIconUrl, DDRAGON_VERSION } from '@/lib/ddragon'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

type WatchedPlayer = {
  puuid: string
  label: string | null
}

type TopChampion = {
  champion: string
  winrate: number
  total_matches: number
  avg_kills: number
  avg_deaths: number
  avg_assists: number
}

type Tier = { label: string; color: string; bg: string }

function getTier(winrate: number): Tier {
  if (winrate >= 54) return { label: 'S+', color: 'text-yellow-300', bg: 'bg-yellow-400/10 border-yellow-400/30' }
  if (winrate >= 52) return { label: 'S',  color: 'text-orange-300', bg: 'bg-orange-400/10 border-orange-400/30' }
  if (winrate >= 50) return { label: 'A',  color: 'text-green-400',  bg: 'bg-green-400/10  border-green-400/30'  }
  if (winrate >= 48) return { label: 'B',  color: 'text-blue-400',   bg: 'bg-blue-400/10   border-blue-400/30'   }
  return                     { label: 'C',  color: 'text-metis-text-dim', bg: 'bg-metis-border/30 border-metis-border' }
}

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  const [gameName, setGameName] = useState('')
  const [tagLine, setTagLine] = useState('')
  const [user, setUser] = useState<{ email?: string; id: string } | null>(null)
  const [watched, setWatched] = useState<WatchedPlayer[]>([])
  const [loadingWatched, setLoadingWatched] = useState(false)
  const [topChamps, setTopChamps] = useState<TopChampion[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({ email: user.email, id: user.id })
        loadWatched()
      }
    })
    loadTopChamps()
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

  async function loadTopChamps() {
    try {
      const res = await fetch(`${API_URL}/api/v1/stats/tierlist?min_matches=5`)
      if (!res.ok) return
      const data: TopChampion[] = await res.json()
      setTopChamps(data.slice(0, 6))
    } catch {
      // falha silenciosa — backend pode estar offline
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    setWatched([])
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const name = gameName.trim()
    const tag = tagLine.trim().replace(/^#/, '')
    if (!name) return
    const query = tag ? `${name}#${tag}` : name
    router.push(`/players/${encodeURIComponent(query)}`)
  }

  return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-metis-border bg-metis-surface">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-metis-accent" />
          <span className="font-bold text-metis-text tracking-tight">Metis</span>
          <span className="text-[10px] text-metis-text-dim border border-metis-border rounded px-1 py-0.5 ml-1 hidden sm:inline">
            Alpha v0.6.4
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Sempre visíveis */}
          <ThemeSwitcher />
          <div className="w-px h-4 bg-metis-border mx-1" />
          <Link
            href="/champions"
            className="flex items-center gap-1.5 text-xs text-metis-text-dim hover:text-metis-text transition-colors px-2 py-1.5"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Tier List</span>
          </Link>
          <Link
            href="/changelog"
            className="flex items-center gap-1.5 text-xs text-metis-text-dim hover:text-metis-text transition-colors px-2 py-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:block">O que é novo</span>
          </Link>
          <Link
            href="/team"
            className="flex items-center gap-1.5 text-xs text-metis-text-dim hover:text-metis-text transition-colors px-2 py-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Equipe</span>
          </Link>
          <div className="w-px h-4 bg-metis-border mx-1" />

          {/* Auth */}
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

      <main className="max-w-3xl mx-auto px-4 py-10">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-metis-text mb-2">Analise qualquer invocador</h1>
          <p className="text-metis-text-dim text-sm">
            Estatísticas públicas de todos os jogadores. Login necessário para supervisão e chat tático.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-10">
          <div className="flex gap-2 items-stretch">
            {/* Campo Nome */}
            <div className="flex-1 flex items-center bg-metis-surface border border-metis-border rounded-lg px-4 focus-within:border-metis-accent transition-colors">
              <input
                type="text"
                value={gameName}
                onChange={e => setGameName(e.target.value)}
                placeholder="Nome do invocador"
                className="flex-1 bg-transparent py-2.5 text-sm text-metis-text placeholder-metis-muted outline-none"
              />
              <span className="text-metis-text-dim font-bold text-sm select-none">#</span>
            </div>
            {/* Campo Tag */}
            <div className="w-28 flex items-center bg-metis-surface border border-metis-border rounded-lg px-3 focus-within:border-metis-accent transition-colors">
              <input
                type="text"
                value={tagLine}
                onChange={e => setTagLine(e.target.value.replace(/^#/, ''))}
                placeholder="TAG"
                maxLength={5}
                className="w-full bg-transparent py-2.5 text-sm text-metis-text placeholder-metis-muted outline-none uppercase"
              />
            </div>
            <button
              type="submit"
              className="flex items-center gap-2 bg-metis-accent hover:bg-metis-accent-hover text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            >
              <Search className="w-4 h-4" />
              Buscar
            </button>
          </div>
          <p className="text-[11px] text-metis-text-dim mt-1.5 ml-1">
            Ex: <span className="text-metis-text font-medium">PUCZaras</span> # <span className="text-metis-text font-medium">0210</span> — ou cole o PUUID diretamente no campo nome
          </p>
        </form>

        {/* Top Campeões */}
        {topChamps.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-metis-accent" />
                <h2 className="text-sm font-semibold text-metis-text-dim uppercase tracking-wide">
                  Destaques do Meta
                </h2>
              </div>
              <Link
                href="/champions"
                className="flex items-center gap-1 text-xs text-metis-accent hover:text-metis-accent-hover transition-colors"
              >
                Ver tier list completa
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="bg-metis-surface border border-metis-border rounded-xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[40px_1fr_60px_60px_60px] gap-2 px-4 py-2 border-b border-metis-border text-[10px] font-medium text-metis-text-dim uppercase tracking-wide">
                <span>Tier</span>
                <span>Campeão</span>
                <span className="text-right">Winrate</span>
                <span className="text-right hidden sm:block">KDA</span>
                <span className="text-right">Partidas</span>
              </div>

              {topChamps.map((c, i) => {
                const tier = getTier(c.winrate)
                const kda = c.avg_deaths > 0
                  ? ((c.avg_kills + c.avg_assists) / c.avg_deaths).toFixed(1)
                  : '∞'
                return (
                  <Link
                    key={c.champion}
                    href="/champions"
                    className={`grid grid-cols-[40px_1fr_60px_60px_60px] gap-2 items-center px-4 py-2.5 hover:bg-metis-bg/50 transition-colors group ${
                      i < topChamps.length - 1 ? 'border-b border-metis-border/40' : ''
                    }`}
                  >
                    {/* Tier badge */}
                    <span className={`text-[11px] font-bold w-7 h-6 flex items-center justify-center rounded border ${tier.bg} ${tier.color}`}>
                      {tier.label}
                    </span>

                    {/* Campeão */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-8 h-8 rounded-md overflow-hidden border border-metis-border flex-shrink-0">
                        <Image
                          src={championIconUrl(c.champion, DDRAGON_VERSION)}
                          alt={c.champion}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <span className="text-sm font-medium text-metis-text group-hover:text-metis-accent transition-colors truncate">
                        {c.champion}
                      </span>
                    </div>

                    {/* Winrate */}
                    <span className={`text-sm font-semibold text-right ${
                      c.winrate > 51 ? 'text-green-400' : c.winrate < 49 ? 'text-red-400' : 'text-metis-text-dim'
                    }`}>
                      {c.winrate.toFixed(1)}%
                    </span>

                    {/* KDA */}
                    <span className="text-xs text-metis-text-dim text-right hidden sm:block">
                      {kda}
                    </span>

                    {/* Partidas */}
                    <span className="text-xs text-metis-text-dim text-right">
                      {c.total_matches}
                    </span>
                  </Link>
                )
              })}
            </div>

            <p className="text-[11px] text-metis-text-dim mt-2 text-center">
              Itens e runas em breve — dados sendo coletados
            </p>
          </section>
        )}

        {/* Watched Players */}
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
