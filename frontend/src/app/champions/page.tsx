'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { emblemPath, roleIconPath } from '@/lib/ddragon'
import { apiFetch } from '@/lib/api'
import {
  AppHeader,
  Card,
  SectionLabel,
  Pill,
  Icon,
  ChampPortrait,
  Bar,
  ROLES_PT,
  TIER_COLORS,
  type Tier,
  type Role,
} from '@/components/design'

type ChampionStat = {
  champion: string
  role?: string
  role_label?: string
  total_matches: number
  winrate: number
  avg_kills: number
  avg_deaths: number
  avg_assists: number
  avg_gold: number
  avg_damage_per_minute: number
  tier?: string
  pickrate?: number
  banrate?: number
  kda?: number
}

const ROLES: { v: '' | Role; label: string; iconRole: Role | null }[] = [
  { v: '',        label: 'Todas',   iconRole: null },
  { v: 'TOP',     label: 'Top',     iconRole: 'TOP' },
  { v: 'JUNGLE',  label: 'Jungle',  iconRole: 'JUNGLE' },
  { v: 'MIDDLE',  label: 'Mid',     iconRole: 'MIDDLE' },
  { v: 'BOTTOM',  label: 'ADC',     iconRole: 'BOTTOM' },
  { v: 'UTILITY', label: 'Suporte', iconRole: 'UTILITY' },
]

const SERVERS = [
  { value: '',      label: 'Todas as regiões' },
  { value: 'BR1',   label: 'BR' },
  { value: 'NA1',   label: 'NA' },
  { value: 'EUW1',  label: 'EUW' },
  { value: 'KR',    label: 'KR' },
  { value: 'EUNE1', label: 'EUNE' },
  { value: 'JP1',   label: 'JP' },
  { value: 'LA1',   label: 'LAN' },
  { value: 'LA2',   label: 'LAS' },
  { value: 'OC1',   label: 'OCE' },
]

const ELOS = [
  { value: '',            label: 'Todos',       emblem: null },
  { value: 'IRON',        label: 'Iron',        emblem: 'Iron' },
  { value: 'BRONZE',      label: 'Bronze',      emblem: 'Bronze' },
  { value: 'SILVER',      label: 'Silver',      emblem: 'Silver' },
  { value: 'GOLD',        label: 'Gold',        emblem: 'Gold' },
  { value: 'PLATINUM',    label: 'Platinum',    emblem: 'Platinum' },
  { value: 'EMERALD',     label: 'Emerald',     emblem: 'Emerald' },
  { value: 'DIAMOND',     label: 'Diamond',     emblem: 'Diamond' },
  { value: 'MASTER',      label: 'Master',      emblem: 'Master' },
  { value: 'GRANDMASTER', label: 'Grandmaster', emblem: 'Grandmaster' },
  { value: 'CHALLENGER',  label: 'Challenger',  emblem: 'Challenger' },
]

const TIER_ORDER: Tier[] = ['S+', 'S', 'A', 'B', 'C']

function derivedTier(c: ChampionStat): Tier {
  // Usa o tier da API se vier; senão deriva do winrate.
  if (c.tier && TIER_ORDER.includes(c.tier as Tier)) return c.tier as Tier
  if (c.winrate >= 54) return 'S+'
  if (c.winrate >= 52) return 'S'
  if (c.winrate >= 50) return 'A'
  if (c.winrate >= 48) return 'B'
  return 'C'
}

export default function ChampionsPage() {
  const [data, setData] = useState<ChampionStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [role, setRole] = useState<'' | Role>('')
  const [server, setServer] = useState('')
  const [patchFrom, setPatchFrom] = useState('')
  const [patchTo, setPatchTo] = useState('')
  const [elo, setElo] = useState('')
  const [search, setSearch] = useState('')
  const [patches, setPatches] = useState<string[]>([])
  const [showUnpopular, setShowUnpopular] = useState(false)

  useEffect(() => {
    apiFetch('/api/v1/stats/patches')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: string[]) => {
        setPatches(data)
        if (data.length > 0 && !patchFrom && !patchTo) {
          setPatchFrom(data[0])
          setPatchTo(data[0])
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Range de patches selecionados — patches vem ordenado desc (16.7, 16.6, ...).
  const selectedPatches = (() => {
    if (!patchFrom && !patchTo) return []
    const fromIdx = patchFrom ? patches.indexOf(patchFrom) : patches.length - 1
    const toIdx = patchTo ? patches.indexOf(patchTo) : 0
    if (fromIdx === -1 || toIdx === -1) return []
    const start = Math.min(fromIdx, toIdx)
    const end = Math.max(fromIdx, toIdx)
    return patches.slice(start, end + 1)
  })()

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ min_matches: '1' })
        if (role) params.set('role', role)
        if (server) params.set('server', server)
        if (selectedPatches.length === 1) params.set('patch', selectedPatches[0])
        else if (selectedPatches.length > 1) params.set('patches', selectedPatches.join(','))

        const res = await apiFetch(`/api/v1/stats/tierlist?${params}`)
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        const json: ChampionStat[] = await res.json()
        setData(json)
      } catch {
        setError('Não foi possível carregar a tier list. O backend pode estar offline.')
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, server, patchFrom, patchTo])

  // Filtragem cliente-side: busca + impopulares + agrupamento por tier.
  const popular = data.filter((c) => c.total_matches >= 30 && (c.pickrate ?? 0) >= 5)
  const unpopular = data.filter((c) => c.total_matches < 30 || (c.pickrate ?? 0) < 5)
  const displayed = showUnpopular ? data : popular
  const searchLower = search.trim().toLowerCase()
  const visible = searchLower
    ? displayed.filter((c) => c.champion.toLowerCase().includes(searchLower))
    : displayed

  const byTier: Record<Tier, ChampionStat[]> = { 'S+': [], S: [], A: [], B: [], C: [] }
  for (const c of visible) {
    byTier[derivedTier(c)].push(c)
  }
  for (const t of TIER_ORDER) {
    byTier[t].sort((a, b) => b.winrate - a.winrate)
  }

  const subtitleParts = [
    selectedPatches.length === 0
      ? 'todos os patches'
      : selectedPatches.length === 1
      ? `patch ${selectedPatches[0]}`
      : `${selectedPatches[selectedPatches.length - 1]} → ${selectedPatches[0]}`,
    elo ? elo.charAt(0) + elo.slice(1).toLowerCase() : 'todos os elos',
    server ? SERVERS.find((s) => s.value === server)?.label : 'todas as regiões',
  ]

  return (
    <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
      <AppHeader active="tierlist" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 28px 48px' }}>
        {/* Title block */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 24,
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--m-text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              {subtitleParts.join(' · ')}
            </div>
            <h1
              className="font-display"
              style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 6 }}
            >
              Tier List
            </h1>
            <p style={{ fontSize: 14, color: 'var(--m-text-dim)', maxWidth: 520 }}>
              Ranking de campeões por role com winrate, pickrate e tendência. Dados de{' '}
              <span className="tabular" style={{ color: 'var(--m-text)', fontWeight: 600 }}>
                {data.length > 0 ? data.reduce((s, c) => s + c.total_matches, 0).toLocaleString('pt-BR') : '—'}
              </span>{' '}
              partidas no recorte atual.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {unpopular.length > 0 && (
              <Pill
                icon={showUnpopular ? 'eye' : 'filter'}
                active={!showUnpopular}
                onClick={() => setShowUnpopular((v) => !v)}
              >
                {showUnpopular ? 'Ocultar impopulares' : 'Campeões populares'}
              </Pill>
            )}
          </div>
        </div>

        {/* Barra de filtros */}
        <Card pad={16} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            {/* Busca */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flex: '1 1 240px',
                padding: '8px 12px',
                background: 'var(--m-bg)',
                border: '1px solid var(--m-border)',
                borderRadius: 10,
              }}
            >
              <Icon name="search" size={14} style={{ color: 'var(--m-text-dim)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar campeão..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--m-text)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Role pills */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {ROLES.map((r) => {
                const active = role === r.v
                return (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => setRole(r.v)}
                    className="m-hover-surface"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: 8,
                      background: active ? 'var(--m-accent)' : 'transparent',
                      color: active ? '#1a1510' : 'var(--m-text-dim)',
                      border: `1px solid ${active ? 'var(--m-accent)' : 'var(--m-border)'}`,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {r.iconRole && (
                      <Image
                        src={roleIconPath(r.iconRole)}
                        alt=""
                        width={13}
                        height={13}
                        unoptimized
                        style={{ objectFit: 'contain', filter: active ? 'brightness(0.2)' : 'none' }}
                      />
                    )}
                    {r.label}
                  </button>
                )
              })}
            </div>

            {/* Servidor */}
            <select
              value={server}
              onChange={(e) => setServer(e.target.value)}
              style={{
                padding: '7px 12px',
                background: 'var(--m-bg)',
                border: '1px solid var(--m-border)',
                borderRadius: 8,
                color: 'var(--m-text)',
                fontSize: 12,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            >
              {SERVERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* Patch range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={patchFrom}
                onChange={(e) => setPatchFrom(e.target.value)}
                style={{
                  padding: '7px 10px',
                  background: 'var(--m-bg)',
                  border: '1px solid var(--m-border)',
                  borderRadius: 8,
                  color: 'var(--m-text)',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              >
                <option value="">Patch inicial</option>
                {patches.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: 'var(--m-muted)' }}>→</span>
              <select
                value={patchTo}
                onChange={(e) => setPatchTo(e.target.value)}
                style={{
                  padding: '7px 10px',
                  background: 'var(--m-bg)',
                  border: '1px solid var(--m-border)',
                  borderRadius: 8,
                  color: 'var(--m-text)',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              >
                <option value="">Patch final</option>
                {patches.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Elo row */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              marginTop: 14,
              paddingTop: 14,
              borderTop: '1px solid var(--m-border)',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: 'var(--m-muted)',
                marginRight: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 600,
              }}
            >
              Elo
            </span>
            {ELOS.map((e) => {
              const active = elo === e.value
              return (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => setElo(e.value)}
                  className="m-hover-surface"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: e.emblem ? '4px 10px 4px 4px' : '6px 12px',
                    borderRadius: 7,
                    background: active ? 'rgb(var(--m-accent-rgb) / 0.12)' : 'transparent',
                    color: active ? 'var(--m-accent)' : 'var(--m-text-dim)',
                    border: `1px solid ${active ? 'rgb(var(--m-accent-rgb) / 0.35)' : 'var(--m-border)'}`,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {e.emblem && (
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        overflow: 'hidden',
                        position: 'relative',
                        flexShrink: 0,
                      }}
                    >
                      <Image
                        src={emblemPath(e.emblem)}
                        alt={e.label}
                        width={100}
                        height={100}
                        unoptimized
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%) scale(2.2)',
                          objectFit: 'contain',
                        }}
                      />
                    </div>
                  )}
                  {e.label}
                </button>
              )
            })}
            {elo && (
              <span style={{ fontSize: 10, color: 'var(--m-muted)', fontStyle: 'italic', marginLeft: 4 }}>
                (filtro em breve)
              </span>
            )}
          </div>
        </Card>

        {/* Conteúdo */}
        {loading ? (
          <div style={{ display: 'flex', gap: 6, padding: '80px 0', justifyContent: 'center' }}>
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--m-accent)',
                  animation: 'bounce 1.4s infinite ease-in-out both',
                  animationDelay: `${d}ms`,
                }}
              />
            ))}
          </div>
        ) : error ? (
          <Card>
            <p style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>{error}</p>
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <p style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>
              Nenhum campeão encontrado com os filtros atuais.
              {!showUnpopular && unpopular.length > 0 && (
                <>
                  {' '}
                  <button
                    onClick={() => setShowUnpopular(true)}
                    className="m-hover-link"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--m-accent)',
                      cursor: 'pointer',
                      fontSize: 13,
                      padding: 0,
                      fontFamily: 'inherit',
                    }}
                  >
                    Mostrar {unpopular.length} campeões impopulares.
                  </button>
                </>
              )}
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {TIER_ORDER.map((t) => {
              const champs = byTier[t]
              if (champs.length === 0) return null
              const c = TIER_COLORS[t]
              return (
                <div
                  key={t}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '72px 1fr',
                    gap: 16,
                    alignItems: 'stretch',
                  }}
                >
                  {/* Badge gigante do tier */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: c.bg,
                      border: `1px solid ${c.border}`,
                      borderRadius: 14,
                      fontSize: 34,
                      fontWeight: 800,
                      color: c.text,
                      letterSpacing: '-0.03em',
                    }}
                    className="font-display"
                  >
                    {t}
                  </div>

                  {/* Grid de cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: 10,
                    }}
                  >
                    {champs.map((ch) => (
                      <Link
                        key={ch.champion + (ch.role ?? '')}
                        href={`/champions/${encodeURIComponent(ch.champion)}`}
                        className="m-hover-card"
                        style={{
                          display: 'flex',
                          gap: 12,
                          padding: 12,
                          background: 'var(--m-surface)',
                          border: '1px solid var(--m-border)',
                          borderRadius: 12,
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        <ChampPortrait name={ch.champion} size={48} role={ch.role as Role | undefined} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              justifyContent: 'space-between',
                              gap: 8,
                            }}
                          >
                            <div className="font-display" style={{ fontSize: 15, fontWeight: 600 }}>
                              {ch.champion}
                            </div>
                            {ch.role && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: 'var(--m-muted)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.06em',
                                }}
                              >
                                {ROLES_PT[ch.role as Role] ?? ch.role}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <span
                              className="tabular"
                              style={{
                                fontSize: 18,
                                fontWeight: 700,
                                color:
                                  ch.winrate > 52
                                    ? 'var(--m-green)'
                                    : ch.winrate > 50
                                    ? 'var(--m-accent)'
                                    : 'var(--m-red)',
                              }}
                            >
                              {ch.winrate.toFixed(1)}%
                            </span>
                            <div style={{ flex: 1 }} />
                            {ch.pickrate !== undefined && (
                              <span
                                className="tabular"
                                style={{ fontSize: 11, color: 'var(--m-text-dim)' }}
                              >
                                {ch.pickrate.toFixed(1)}% pick
                              </span>
                            )}
                          </div>
                          <Bar
                            value={ch.winrate - 45}
                            max={15}
                            height={3}
                            color={ch.winrate > 52 ? 'var(--m-green)' : 'var(--m-accent)'}
                          />
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr 1fr',
                              gap: 6,
                              marginTop: 8,
                              fontSize: 10,
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  color: 'var(--m-muted)',
                                  fontSize: 9,
                                  textTransform: 'uppercase',
                                  fontWeight: 600,
                                  letterSpacing: '0.06em',
                                }}
                              >
                                KDA
                              </div>
                              <div
                                className="tabular"
                                style={{ color: 'var(--m-text)', fontWeight: 600, marginTop: 1 }}
                              >
                                {ch.kda?.toFixed(2) ?? '—'}
                              </div>
                            </div>
                            <div>
                              <div
                                style={{
                                  color: 'var(--m-muted)',
                                  fontSize: 9,
                                  textTransform: 'uppercase',
                                  fontWeight: 600,
                                  letterSpacing: '0.06em',
                                }}
                              >
                                Ban
                              </div>
                              <div
                                className="tabular"
                                style={{ color: 'var(--m-text)', fontWeight: 600, marginTop: 1 }}
                              >
                                {ch.banrate?.toFixed(1) ?? '0.0'}%
                              </div>
                            </div>
                            <div>
                              <div
                                style={{
                                  color: 'var(--m-muted)',
                                  fontSize: 9,
                                  textTransform: 'uppercase',
                                  fontWeight: 600,
                                  letterSpacing: '0.06em',
                                }}
                              >
                                Games
                              </div>
                              <div
                                className="tabular"
                                style={{ color: 'var(--m-text)', fontWeight: 600, marginTop: 1 }}
                              >
                                {ch.total_matches >= 1000
                                  ? `${(ch.total_matches / 1000).toFixed(1)}k`
                                  : ch.total_matches}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Loading dots keyframes */}
      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
