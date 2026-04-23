'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DDRAGON_VERSION } from '@/lib/ddragon'
import { apiFetch } from '@/lib/api'
import {
  AppHeader,
  Card,
  SectionLabel,
  Stat,
  Bar,
  Pill,
  Icon,
  ChampPortrait,
  TierBadge,
  WinLossDots,
  ROLES_PT,
  type Tier,
  type Role,
} from '@/components/design'
import Image from 'next/image'
import { roleIconPath } from '@/lib/ddragon'

// ── Types ───────────────────────────────────────────────────────
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
  /** Enriquecido no frontend — API ainda não retorna. */
  role?: string
}

type Suggestion = {
  puuid: string
  game_name: string
  tag_line: string
  server: string
  profile_icon_id: number | null
  formerly?: string
}

// ── Helpers ─────────────────────────────────────────────────────
function getTier(winrate: number): Tier {
  if (winrate >= 54) return 'S+'
  if (winrate >= 52) return 'S'
  if (winrate >= 50) return 'A'
  if (winrate >= 48) return 'B'
  return 'C'
}

function computeKDA(k: number, d: number, a: number): string {
  if (d <= 0) return '∞'
  return ((k + a) / d).toFixed(2)
}

// ── Page ────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  const [searchInput, setSearchInput] = useState('')
  const [searchServer, setSearchServer] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [inputFocused, setInputFocused] = useState(false)
  const [user, setUser] = useState<{ email?: string; id: string } | null>(null)
  const [watched, setWatched] = useState<WatchedPlayer[]>([])
  const [loadingWatched, setLoadingWatched] = useState(false)
  const [topChamps, setTopChamps] = useState<TopChampion[]>([])
  const [patchLabel, setPatchLabel] = useState<string>('')
  const [totalMatches, setTotalMatches] = useState<number | null>(null)
  const [totalPlayers, setTotalPlayers] = useState<number | null>(null)
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({ email: user.email, id: user.id })
        loadWatched()
      }
    })
    loadTopChamps()
    loadMetaCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadMetaCounts() {
    // Counts diretos via Supabase (RLS leitura pública nas tabelas matches e players).
    // head:true = retorna só o count, sem payload — query barata.
    const [matchesRes, playersRes] = await Promise.all([
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('players').select('*', { count: 'exact', head: true }),
    ])
    if (matchesRes.count !== null) setTotalMatches(matchesRes.count)
    if (playersRes.count !== null) setTotalPlayers(playersRes.count)
  }

  async function loadWatched() {
    setLoadingWatched(true)
    const { data } = await supabase
      .from('watched_players')
      .select('puuid, label, players(game_name, tag_line, profile_icon_id)')
      .order('created_at', { ascending: false })
    const mapped = (data ?? []).map((d: Record<string, unknown>) => ({
      puuid: d.puuid as string,
      label: d.label as string | null,
      players: (d.players as WatchedPlayer['players']) ?? null,
    }))
    setWatched(mapped)
    setLoadingWatched(false)
  }

  async function loadTopChamps() {
    try {
      const patchRes = await apiFetch('/api/v1/stats/patches')
      const patches: string[] = patchRes.ok ? await patchRes.json() : []
      const latestPatch = patches[0] ?? ''
      if (latestPatch) setPatchLabel(latestPatch)

      // min_matches=10 evita campeões com 3W/0L aparecendo com 100% WR no spotlight.
      // Home é vitrine — prioriza confiança estatística sobre cobertura.
      const params = new URLSearchParams({ min_matches: '10' })
      if (latestPatch) params.set('patch', latestPatch)

      const res = await apiFetch(`/api/v1/stats/tierlist?${params}`)
      if (!res.ok) return
      const data: TopChampion[] = await res.json()
      // Guardamos um pool maior pra permitir filtro por role sem refetch.
      setTopChamps(data.slice(0, 60))
    } catch {
      // backend offline — a UI aguenta
    }
  }

  // Autocomplete debounced
  useEffect(() => {
    const q = searchInput.trim()
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q })
        if (searchServer) params.set('server', searchServer)
        const res = await apiFetch(`/api/v1/player/search?${params}`)
        if (res.ok) setSuggestions(await res.json())
      } catch {
        /* silencioso */
      }
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

  function handleSelectSuggestion(s: Suggestion) {
    setSuggestions([])
    router.push(`/players/${encodeURIComponent(`${s.game_name}#${s.tag_line}`)}`)
  }

  // Spotlight sempre mostra os 3 melhores absolutos (ignora filtro de role).
  const top3 = topChamps.slice(0, 3)
  // Top-8 respeita o filtro de role quando ativado.
  const filtered = roleFilter ? topChamps.filter((c) => c.role === roleFilter) : topChamps
  const top8 = filtered.slice(0, 8)

  return (
    <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
      <AppHeader active="home" />

      {/* ══════════ Hero ══════════ */}
      <section
        className="metis-grid-bg"
        style={{
          position: 'relative',
          borderBottom: '1px solid var(--m-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -80,
            width: 420,
            height: 420,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,200,66,0.18), transparent 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -120,
            left: -80,
            width: 360,
            height: 360,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(91,227,212,0.12), transparent 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 28px 40px', position: 'relative' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 11px',
              borderRadius: 999,
              background: 'rgb(var(--m-accent-rgb) / 0.1)',
              border: '1px solid rgb(var(--m-accent-rgb) / 0.25)',
              color: 'var(--m-accent)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 20,
            }}
          >
            <Icon name="sparkles" size={12} />
            {patchLabel ? `Patch ${patchLabel} · ao vivo` : 'Metis · em produção'}
          </div>

          <h1
            className="font-display"
            style={{ fontSize: 52, lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em', maxWidth: 760, marginBottom: 14 }}
          >
            Seu coach particular, em cada <span style={{ color: 'var(--m-accent)' }}>partida</span>.
          </h1>
          <p style={{ fontSize: 16, color: 'var(--m-text-dim)', maxWidth: 560, marginBottom: 28, lineHeight: 1.5 }}>
            Metis analisa jogo a jogo com IA, extrai padrões do seu desempenho e mostra exatamente{' '}
            <span style={{ color: 'var(--m-text)' }}>o que funciona</span> — e o que está te segurando.
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 14, maxWidth: 640 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  background: 'var(--m-surface)',
                  border: '1px solid var(--m-border-2)',
                  borderRadius: 12,
                }}
              >
                <Icon name="search" size={16} style={{ color: 'var(--m-text-dim)' }} />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setTimeout(() => setInputFocused(false), 250)}
                  placeholder="Nome#Tag  ex: Zaras#0210"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--m-text)',
                    fontSize: 14,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--m-muted)' }}>⌘K</span>
              </div>

              {inputFocused && suggestions.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    background: 'var(--m-surface)',
                    border: '1px solid var(--m-border-2)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                    zIndex: 50,
                  }}
                >
                  {suggestions.map((s) => (
                    <button
                      key={s.puuid}
                      type="button"
                      onMouseDown={() => handleSelectSuggestion(s)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--m-text)',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      {s.profile_icon_id ? (
                        <Image
                          src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${s.profile_icon_id}.png`}
                          alt=""
                          width={28}
                          height={28}
                          style={{ borderRadius: 6, border: '1px solid var(--m-border-2)', flexShrink: 0 }}
                          unoptimized
                        />
                      ) : (
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            background: 'var(--m-bg)',
                            border: '1px solid var(--m-border-2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            color: 'var(--m-text-dim)',
                            flexShrink: 0,
                          }}
                        >
                          {s.game_name.charAt(0)}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{s.game_name}</span>
                          <span style={{ color: 'var(--m-text-dim)' }}>#{s.tag_line}</span>
                        </div>
                        {s.formerly && (
                          <div style={{ fontSize: 10, color: 'var(--m-muted)', marginTop: 2 }}>antes: {s.formerly}</div>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          color: 'var(--m-text-dim)',
                          border: '1px solid var(--m-border-2)',
                          borderRadius: 4,
                          padding: '1px 6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {s.server}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <select
              value={searchServer}
              onChange={(e) => setSearchServer(e.target.value)}
              style={{
                padding: '0 14px',
                background: 'var(--m-surface)',
                border: '1px solid var(--m-border-2)',
                borderRadius: 12,
                color: 'var(--m-text)',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
                minWidth: 90,
              }}
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
              className="m-hover-accent"
              style={{
                padding: '0 22px',
                background: 'var(--m-accent)',
                border: 'none',
                borderRadius: 12,
                color: '#1a1510',
                fontSize: 14,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              Analisar
              <Icon name="arrowRight" size={14} />
            </button>
          </form>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--m-muted)', marginRight: 4 }}>Sugestões:</span>
            {['Zaras#0210', 'Brtt#BR1'].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSearchInput(n)}
                style={{
                  fontSize: 11,
                  padding: '3px 10px',
                  borderRadius: 999,
                  border: '1px solid var(--m-border)',
                  background: 'transparent',
                  color: 'var(--m-text-dim)',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Live stats strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
              marginTop: 40,
              padding: '20px 24px',
              background: 'rgba(20,24,38,0.6)',
              border: '1px solid var(--m-border)',
              borderRadius: 16,
              backdropFilter: 'blur(8px)',
            }}
          >
            <Stat
              size="lg"
              label="Partidas analisadas"
              value={totalMatches !== null ? totalMatches.toLocaleString('pt-BR') : '—'}
              sub="camada prata · Supabase"
            />
            <Stat
              size="lg"
              label="Jogadores mapeados"
              value={totalPlayers !== null ? totalPlayers.toLocaleString('pt-BR') : '—'}
              sub="histórico ingerido"
            />
            <Stat size="lg" label="Chat IA" value="Gemini 2.5" sub="Flash · LoL-only" accent="var(--m-cyan)" />
            <Stat size="lg" label="Status" value="ao vivo" sub="pipeline contínua" accent="var(--m-accent)" />
          </div>
        </div>
      </section>

      {/* ══════════ Main grid ══════════ */}
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '40px 28px',
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 24,
        }}
      >
        {/* LEFT COL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Meta spotlight */}
          {top3.length > 0 && (
            <Card pad={0}>
              <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--m-border)' }}>
                <SectionLabel icon="flame">
                  Destaques do meta{patchLabel ? ` · patch ${patchLabel}` : ''}
                </SectionLabel>
                <h3 className="font-display" style={{ fontSize: 20, fontWeight: 600 }}>
                  Quem está <span style={{ color: 'var(--m-accent)' }}>quebrando</span> a solo queue agora
                </h3>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${top3.length}, 1fr)`,
                  gap: 1,
                  background: 'var(--m-border)',
                }}
              >
                {top3.map((c) => {
                  const tier = getTier(c.winrate)
                  const kda = computeKDA(c.avg_kills, c.avg_deaths, c.avg_assists)
                  return (
                    <Link
                      key={c.champion}
                      href={`/champions/${encodeURIComponent(c.champion)}`}
                      className="m-hover-surface"
                      style={{
                        padding: 20,
                        background: 'var(--m-surface)',
                        position: 'relative',
                        overflow: 'hidden',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: -20,
                          right: -20,
                          width: 120,
                          height: 120,
                          backgroundImage: `url(https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${c.champion}.png)`,
                          backgroundSize: 'cover',
                          opacity: 0.2,
                          filter: 'blur(4px)',
                          pointerEvents: 'none',
                        }}
                      />
                      <div style={{ position: 'relative', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <ChampPortrait name={c.champion} size={52} role={c.role} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <TierBadge tier={tier} size="sm" />
                            {c.role && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: 'var(--m-muted)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.06em',
                                }}
                              >
                                {ROLES_PT[c.role as keyof typeof ROLES_PT] ?? c.role}
                              </span>
                            )}
                          </div>
                          <div className="font-display" style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>
                            {c.champion}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                            <span
                              className="tabular"
                              style={{
                                fontSize: 22,
                                fontWeight: 700,
                                color: c.winrate > 52 ? 'var(--m-green)' : 'var(--m-accent)',
                              }}
                            >
                              {c.winrate.toFixed(1)}%
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--m-muted)' }}>winrate</span>
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 12,
                          marginTop: 14,
                          paddingTop: 14,
                          borderTop: '1px solid var(--m-border)',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 9,
                              color: 'var(--m-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              fontWeight: 600,
                            }}
                          >
                            KDA
                          </div>
                          <div className="tabular" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                            {kda}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 9,
                              color: 'var(--m-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              fontWeight: 600,
                            }}
                          >
                            Partidas
                          </div>
                          <div className="tabular" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                            {c.total_matches.toLocaleString('pt-BR')}
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Mini tier list com filtro de role */}
          {topChamps.length > 0 && (
            <Card pad={0}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px 12px',
                }}
              >
                <SectionLabel icon="trending">
                  Tier list · top 8{roleFilter ? ` · ${ROLES_PT[roleFilter]}` : ''}
                </SectionLabel>
                <Link
                  href="/champions"
                  className="m-hover-link"
                  style={{
                    fontSize: 12,
                    color: 'var(--m-accent)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  Ver completa <Icon name="chevronRight" size={12} />
                </Link>
              </div>

              {/* Role filter pills */}
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  padding: '0 20px 12px',
                  flexWrap: 'wrap',
                }}
              >
                {([
                  { v: '', label: 'Todos', icon: null },
                  { v: 'TOP', label: 'Top', icon: 'TOP' },
                  { v: 'JUNGLE', label: 'Jungle', icon: 'JUNGLE' },
                  { v: 'MIDDLE', label: 'Mid', icon: 'MIDDLE' },
                  { v: 'BOTTOM', label: 'ADC', icon: 'BOTTOM' },
                  { v: 'UTILITY', label: 'Sup', icon: 'UTILITY' },
                ] as const).map((r) => {
                  const active = roleFilter === r.v
                  return (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => setRoleFilter(r.v as Role | '')}
                      className="m-hover-surface"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '5px 10px',
                        borderRadius: 7,
                        background: active ? 'var(--m-accent)' : 'var(--m-surface-2)',
                        color: active ? '#1a1510' : 'var(--m-text-dim)',
                        border: `1px solid ${active ? 'var(--m-accent)' : 'var(--m-border-2)'}`,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {r.icon && (
                        <Image
                          src={roleIconPath(r.icon)}
                          alt=""
                          width={12}
                          height={12}
                          unoptimized
                          style={{
                            objectFit: 'contain',
                            filter: active ? 'brightness(0.2)' : 'none',
                          }}
                        />
                      )}
                      {r.label}
                    </button>
                  )
                })}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 110px 90px',
                  gap: 10,
                  padding: '8px 20px',
                  fontSize: 10,
                  color: 'var(--m-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                  borderTop: '1px solid var(--m-border)',
                  borderBottom: '1px solid var(--m-border)',
                }}
              >
                <span>Tier</span>
                <span>Campeão</span>
                <span>Winrate</span>
                <span className="tabular">KDA</span>
              </div>
              {top8.length === 0 && (
                <div
                  style={{
                    padding: '24px 20px',
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'var(--m-muted)',
                  }}
                >
                  Nenhum campeão em {roleFilter ? ROLES_PT[roleFilter] : 'nenhuma role'} com amostra suficiente nesse patch.
                </div>
              )}
              {top8.map((c) => {
                const tier = getTier(c.winrate)
                const kda = computeKDA(c.avg_kills, c.avg_deaths, c.avg_assists)
                return (
                  <Link
                    key={c.champion}
                    href={`/champions/${encodeURIComponent(c.champion)}`}
                    className="m-hover-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr 110px 90px',
                      gap: 10,
                      padding: '10px 20px',
                      alignItems: 'center',
                      borderBottom: '1px solid rgba(34,40,56,0.4)',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <TierBadge tier={tier} size="sm" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <ChampPortrait name={c.champion} size={28} />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{c.champion}</span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span
                          className="tabular"
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color:
                              c.winrate > 52
                                ? 'var(--m-green)'
                                : c.winrate > 50
                                ? 'var(--m-accent)'
                                : 'var(--m-text-dim)',
                          }}
                        >
                          {c.winrate.toFixed(1)}%
                        </span>
                      </div>
                      <Bar
                        value={c.winrate - 45}
                        max={15}
                        height={3}
                        color={c.winrate > 52 ? 'var(--m-green)' : 'var(--m-accent)'}
                      />
                    </div>
                    <span className="tabular" style={{ fontSize: 12, color: 'var(--m-text-dim)' }}>
                      {kda}
                    </span>
                  </Link>
                )
              })}
            </Card>
          )}

          {topChamps.length === 0 && (
            <Card>
              <p style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>
                Tier list carregando — o backend pode estar acordando. Recarrega em alguns segundos.
              </p>
            </Card>
          )}
        </div>

        {/* RIGHT COL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Watched players */}
          <Card>
            <SectionLabel
              icon="star"
              right={
                user && (
                  <Pill color="accent" icon="plus">
                    Novo
                  </Pill>
                )
              }
            >
              Em supervisão
            </SectionLabel>
            {!user ? (
              <div>
                <p style={{ fontSize: 12, color: 'var(--m-text-dim)', lineHeight: 1.5, marginBottom: 10 }}>
                  Faça login pra supervisionar jogadores e ter a Metis acompanhando o progresso.
                </p>
                <Link
                  href="/auth"
                  className="m-hover-accent"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 12px',
                    background: 'var(--m-accent)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#1a1510',
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Entrar <Icon name="arrowRight" size={12} />
                </Link>
              </div>
            ) : loadingWatched ? (
              <p style={{ fontSize: 12, color: 'var(--m-text-dim)' }}>Carregando...</p>
            ) : watched.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--m-text-dim)', lineHeight: 1.5 }}>
                Nenhum jogador em supervisão. Busque um invocador e marque com a estrela pra começar a acompanhar.
              </p>
            ) : (
              <>
                {watched.map((p) => {
                  const pi = p.players
                  const displayName = pi ? `${pi.game_name}#${pi.tag_line}` : p.label ?? p.puuid.slice(0, 12)
                  const href = pi
                    ? `/players/${encodeURIComponent(`${pi.game_name}#${pi.tag_line}`)}`
                    : `/players/${encodeURIComponent(p.puuid)}`
                  return (
                    <Link
                      key={p.puuid}
                      href={href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 0',
                        borderBottom: '1px solid var(--m-border)',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      {pi?.profile_icon_id ? (
                        <Image
                          src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${pi.profile_icon_id}.png`}
                          alt=""
                          width={36}
                          height={36}
                          style={{ borderRadius: 8, border: '1px solid var(--m-border-2)', flexShrink: 0 }}
                          unoptimized
                        />
                      ) : (
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: 'var(--m-surface-2)',
                            border: '1px solid var(--m-border-2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'var(--m-text-dim)',
                            flexShrink: 0,
                          }}
                        >
                          {displayName.charAt(0)}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{displayName}</div>
                        {p.label && (
                          <div style={{ fontSize: 10, color: 'var(--m-accent)', marginTop: 2 }}>{p.label}</div>
                        )}
                      </div>
                      {/* Placeholder streak até termos dados reais */}
                      <WinLossDots results={[1, 1, 0, 1, 1]} size={6} gap={3} />
                    </Link>
                  )
                })}
              </>
            )}
          </Card>

          {/* Ask Metis teaser */}
          <Card accent>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgb(var(--m-accent-rgb) / 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--m-accent)',
                }}
              >
                <Icon name="brain" size={18} />
              </div>
              <div>
                <div className="font-display" style={{ fontSize: 14, fontWeight: 600 }}>
                  Pergunte à Metis
                </div>
                <div style={{ fontSize: 11, color: 'var(--m-text-dim)' }}>
                  Gemini 2.5 Flash · contexto das suas partidas
                </div>
              </div>
            </div>
            <div
              style={{
                background: 'var(--m-bg)',
                border: '1px solid var(--m-border)',
                borderRadius: 10,
                padding: '10px 12px',
                marginBottom: 8,
              }}
            >
              <p style={{ fontSize: 12, color: 'var(--m-text-dim)', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--m-accent)', fontWeight: 600 }}>Ex:</span> &quot;Por que meu winrate caiu com
                Kayn nos últimos 10 jogos?&quot;
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                'Me mostre meu matchup mais difícil',
                'Qual role eu deveria forçar na ranqueada?',
                'Revisa meu último jogo perdido',
              ].map((q) => (
                <Link
                  key={q}
                  href="/chat"
                  className="m-hover-surface"
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    background: 'var(--m-surface-2)',
                    border: '1px solid var(--m-border)',
                    borderRadius: 8,
                    color: 'var(--m-text-dim)',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    textDecoration: 'none',
                  }}
                >
                  <Icon name="sparkles" size={11} style={{ color: 'var(--m-accent)' }} />
                  {q}
                </Link>
              ))}
            </div>
          </Card>

          {/* Changelog digest (sub pro patch digest — usamos changelog real) */}
          <Card>
            <SectionLabel
              icon="bookOpen"
              right={
                <Link
                  href="/changelog"
                  style={{ fontSize: 11, color: 'var(--m-accent)', textDecoration: 'none' }}
                >
                  Ver tudo
                </Link>
              }
            >
              Novidades recentes
            </SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { tag: 'NOVO', color: 'var(--m-green)', text: 'Redesign p-0.9.5+ em andamento' },
                { tag: 'MELHORIA', color: 'var(--m-accent)', text: 'Filtro de campeões impopulares na tier list' },
                { tag: 'NOVO', color: 'var(--m-violet)', text: 'Chat IA com Gemini 2.5 Flash + guardrail LoL' },
                { tag: 'FIX', color: 'var(--m-blue)', text: 'Scraper Mobafire corrigido (bug /build/ → /builds/)' },
              ].map((x, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '6px 0',
                    borderBottom: '1px solid var(--m-border)',
                  }}
                >
                  <span
                    style={{
                      padding: '1px 6px',
                      background: `${x.color}1f`,
                      color: x.color,
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      flexShrink: 0,
                      minWidth: 56,
                      textAlign: 'center',
                      marginTop: 2,
                    }}
                  >
                    {x.tag}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--m-text-dim)', lineHeight: 1.45 }}>{x.text}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
