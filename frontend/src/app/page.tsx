'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Star, TrendingUp, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { Header } from '@/components/ui/Header'
import { championIconUrl, DDRAGON_VERSION } from '@/lib/ddragon'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

type WatchedPlayer = {
  puuid: string
  label: string | null
  players?: { game_name: string; tag_line: string; profile_icon_id: number | null } | null
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
  if (winrate >= 54) return { label: 'S+', color: 'text-amber-400',  bg: 'bg-amber-400/10 border-amber-400/30' }
  if (winrate >= 52) return { label: 'S',  color: 'text-orange-300', bg: 'bg-orange-400/10 border-orange-400/30' }
  if (winrate >= 50) return { label: 'A',  color: 'text-green-400',  bg: 'bg-green-400/10  border-green-400/30'  }
  if (winrate >= 48) return { label: 'B',  color: 'text-blue-400',   bg: 'bg-blue-400/10   border-blue-400/30'   }
  return                     { label: 'C',  color: 'text-metis-text-dim', bg: 'bg-metis-border/30 border-metis-border' }
}

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  const [searchInput, setSearchInput] = useState('')
  const [searchServer, setSearchServer] = useState('')
  const [suggestions, setSuggestions] = useState<{ puuid: string; game_name: string; tag_line: string; server: string; profile_icon_id: number | null; formerly?: string }[]>([])
  const [inputFocused, setInputFocused] = useState(false)
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
      .select('puuid, label, players(game_name, tag_line, profile_icon_id)')
      .order('created_at', { ascending: false })
    // Supabase retorna players como objeto (FK unique) ou null
    const mapped = (data ?? []).map((d: Record<string, unknown>) => ({
      puuid: d.puuid as string,
      label: d.label as string | null,
      players: d.players as WatchedPlayer['players'] ?? null,
    }))
    setWatched(mapped)
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

  // Autocomplete debounce
  useEffect(() => {
    const q = searchInput.trim()
    if (q.length < 2) { setSuggestions([]); return }
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q })
        if (searchServer) params.set('server', searchServer)
        const res = await fetch(`${API_URL}/api/v1/player/search?${params}`)
        if (res.ok) setSuggestions(await res.json())
      } catch { /* silencioso */ }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, searchServer])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const raw = searchInput.trim()
    if (!raw) return
    setSuggestions([])
    router.push(`/players/${encodeURIComponent(raw)}`)
  }

  function handleSelectSuggestion(s: { game_name: string; tag_line: string }) {
    setSuggestions([])
    router.push(`/players/${encodeURIComponent(`${s.game_name}#${s.tag_line}`)}`)
  }

  return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      <Header />

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
            <div className="relative flex-1">
              <div className="flex items-center bg-metis-surface border border-metis-border rounded-lg px-4 focus-within:border-metis-accent transition-colors">
                <Search className="w-4 h-4 text-metis-text-dim flex-shrink-0 mr-2" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setTimeout(() => setInputFocused(false), 250)}
                  placeholder="Nome#Tag  ex: Zaras#0210"
                  className="flex-1 bg-transparent py-2.5 text-sm text-metis-text placeholder-metis-muted outline-none"
                />
              </div>

              {/* Autocomplete dropdown */}
              {inputFocused && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-metis-surface border border-metis-border rounded-lg overflow-hidden shadow-xl z-50">
                  {suggestions.map(s => (
                    <button
                      key={s.puuid}
                      type="button"
                      onMouseDown={() => handleSelectSuggestion(s)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-metis-bg/50 transition-colors text-left"
                    >
                      {s.profile_icon_id ? (
                        <Image
                          src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${s.profile_icon_id}.png`}
                          alt="" width={28} height={28} className="rounded border border-metis-border flex-shrink-0" unoptimized
                        />
                      ) : (
                        <div className="w-7 h-7 rounded bg-metis-bg border border-metis-border flex items-center justify-center text-[10px] text-metis-text-dim flex-shrink-0">
                          {s.game_name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div>
                          <span className="text-sm font-medium text-metis-text">{s.game_name}</span>
                          <span className="text-metis-text-dim">#{s.tag_line}</span>
                        </div>
                        {s.formerly && (
                          <p className="text-[10px] text-metis-muted">antes: {s.formerly}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-metis-text-dim border border-metis-border rounded px-1.5 py-0.5 uppercase">{s.server}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Servidor */}
            <select
              value={searchServer}
              onChange={e => setSearchServer(e.target.value)}
              className="bg-metis-surface border border-metis-border rounded-lg px-3 py-2.5 text-sm text-metis-text outline-none focus:border-metis-accent transition-colors"
            >
              <option value="">Servidor</option>
              <option value="BR1">BR</option>
              <option value="NA1">NA</option>
              <option value="EUW1">EUW</option>
              <option value="KR">KR</option>
              <option value="EUNE1">EUNE</option>
              <option value="JP1">JP</option>
              <option value="LA1">LAN</option>
              <option value="LA2">LAS</option>
              <option value="OC1">OCE</option>
            </select>

            <button
              type="submit"
              className="flex items-center gap-2 bg-metis-accent hover:bg-metis-accent-hover text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            >
              Buscar
            </button>
          </div>
          <p className="text-[11px] text-metis-text-dim mt-1.5 ml-1">
            Digite e veja sugestoes, ou escreva <span className="text-metis-text font-medium">Zaras#0210</span> direto
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
                {watched.map(p => {
                  const pi = p.players
                  const displayName = pi ? `${pi.game_name}#${pi.tag_line}` : p.label ?? p.puuid.slice(0, 12)
                  const iconUrl = pi?.profile_icon_id
                    ? `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${pi.profile_icon_id}.png`
                    : null
                  const href = pi
                    ? `/players/${encodeURIComponent(`${pi.game_name}#${pi.tag_line}`)}`
                    : `/players/${encodeURIComponent(p.puuid)}`

                  return (
                    <li key={p.puuid}>
                      <Link
                        href={href}
                        className="flex items-center gap-3 bg-metis-surface border border-metis-border rounded-lg px-4 py-3 hover:border-metis-accent transition-colors group"
                      >
                        {iconUrl ? (
                          <Image src={iconUrl} alt="" width={36} height={36} className="rounded-lg border border-metis-border flex-shrink-0" unoptimized />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-metis-bg border border-metis-border flex items-center justify-center text-xs font-bold text-metis-text-dim flex-shrink-0">
                            {displayName.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-metis-text group-hover:text-metis-accent transition-colors truncate">
                            {displayName}
                          </p>
                          {p.label && (
                            <p className="text-xs text-metis-accent mt-0.5">{p.label}</p>
                          )}
                        </div>
                        <Star className="w-4 h-4 text-metis-accent flex-shrink-0" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
