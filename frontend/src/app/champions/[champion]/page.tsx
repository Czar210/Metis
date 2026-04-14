'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { championIconUrl, emblemPath, DDRAGON_VERSION } from '@/lib/ddragon'
import { Header } from '@/components/ui/Header'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

// ── Tipos ──────────────────────────────────────────────────────────────────

type Overview = {
  champion: string
  total_matches: number
  filters: { role: string | null; server: string | null; patch: string | null }
  stats: {
    winrate: number
    avg_kills: number
    avg_deaths: number
    avg_assists: number
    avg_gold: number
    avg_damage_per_minute: number
    avg_cs_per_minute: number
    avg_kill_participation: number
  } | null
}

type BuildItem = {
  item_id: number
  item_name: string
  pick_count: number
  win_count: number
  winrate_pct: number
  patch: string
}

type Matchup = {
  opponent: string
  games: number
  winrate: number
  winrate_diff?: number
}

type Synergy = {
  ally: string
  games: number
  winrate: number
}

// ── Constantes de filtros ──────────────────────────────────────────────────

const ROLES = [
  { value: '', label: 'Todas' },
  { value: 'TOP', label: 'Top' },
  { value: 'JUNGLE', label: 'Jungle' },
  { value: 'MIDDLE', label: 'Mid' },
  { value: 'BOTTOM', label: 'ADC' },
  { value: 'UTILITY', label: 'Suporte' },
]

const SERVERS = [
  { value: '', label: 'Todos' },
  { value: 'BR1', label: 'BR' },
  { value: 'NA1', label: 'NA' },
  { value: 'EUW1', label: 'EUW' },
  { value: 'KR', label: 'KR' },
  { value: 'EUNE1', label: 'EUNE' },
]

type Tab = 'overview' | 'builds' | 'matchups' | 'synergies'

// ── Helpers visuais ────────────────────────────────────────────────────────

function WinrateBadge({ value }: { value: number }) {
  const color = value > 51 ? 'text-green-400' : value < 49 ? 'text-red-400' : 'text-metis-text'
  return <span className={`font-semibold ${color}`}>{value.toFixed(1)}%</span>
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-metis-bg border border-metis-border rounded-xl p-4 flex flex-col gap-1">
      <span className="text-[11px] text-metis-text-dim uppercase tracking-wide">{label}</span>
      <span className="text-xl font-bold text-metis-text">{value}</span>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────

export default function ChampionPage() {
  const params = useParams()
  const champion = decodeURIComponent(params.champion as string)

  const [tab, setTab]       = useState<Tab>('overview')
  const [role, setRole]     = useState('')
  const [server, setServer] = useState('')
  const [patch, setPatch]   = useState('')
  const [patches, setPatches] = useState<string[]>([])

  const [overview,   setOverview]   = useState<Overview | null>(null)
  const [builds,     setBuilds]     = useState<BuildItem[]>([])
  const [matchups,   setMatchups]   = useState<Matchup[]>([])
  const [synergies,  setSynergies]  = useState<Synergy[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const base = `${API_URL}/api/v1/champion/${encodeURIComponent(champion)}`
      const params = new URLSearchParams({ min_matches: '1' })
      if (role)   params.set('role', role)
      if (server) params.set('server', server)
      if (patch)  params.set('patch', patch)

      const [ovRes, bdRes, muRes, syRes] = await Promise.all([
        fetch(`${base}/overview?${params}`),
        fetch(`${base}/builds?${params}`),
        fetch(`${base}/matchups?${params}`),
        fetch(`${base}/synergies?${params}`),
      ])

      if (!ovRes.ok) throw new Error(`Overview: HTTP ${ovRes.status}`)
      if (!bdRes.ok) throw new Error(`Builds: HTTP ${bdRes.status}`)
      if (!muRes.ok) throw new Error(`Matchups: HTTP ${muRes.status}`)
      if (!syRes.ok) throw new Error(`Synergies: HTTP ${syRes.status}`)

      const [ov, bd, mu, sy] = await Promise.all([
        ovRes.json(), bdRes.json(), muRes.json(), syRes.json(),
      ])

      setOverview(ov)
      setBuilds(bd)
      setMatchups(mu)
      setSynergies(sy)
    } catch {
      setError('Não foi possível carregar dados do campeão. O backend pode estar offline.')
    } finally {
      setLoading(false)
    }
  }, [champion, role, server, patch])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    fetch(`${API_URL}/api/v1/stats/patches`)
      .then(r => r.ok ? r.json() : [])
      .then(setPatches)
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb + hero do campeão */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/champions"
            className="flex items-center gap-1 text-xs text-metis-text-dim hover:text-metis-text transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Tier List
          </Link>
          <span className="text-metis-border">/</span>
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-metis-border flex-shrink-0">
              <Image
                src={championIconUrl(champion, DDRAGON_VERSION)}
                alt={champion}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-metis-text">{champion}</h1>
              {overview && (
                <p className="text-xs text-metis-text-dim">
                  {overview.total_matches} partidas no banco Metis
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-metis-surface border border-metis-border rounded-xl p-4 mb-6 flex flex-wrap gap-3">
          {/* Role */}
          <div className="flex gap-1 flex-wrap">
            {ROLES.map(r => (
              <button
                key={r.value}
                onClick={() => setRole(r.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  role === r.value
                    ? 'bg-metis-accent text-white'
                    : 'bg-metis-bg border border-metis-border text-metis-text-dim hover:text-metis-text'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Server */}
          <select
            value={server}
            onChange={e => setServer(e.target.value)}
            className="bg-metis-bg border border-metis-border rounded-lg px-3 py-2 text-sm text-metis-text outline-none focus:border-metis-accent transition-colors"
          >
            {SERVERS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Patch */}
          <select
            value={patch}
            onChange={e => setPatch(e.target.value)}
            className="bg-metis-bg border border-metis-border rounded-lg px-3 py-2 text-sm text-metis-text outline-none focus:border-metis-accent transition-colors"
          >
            <option value="">Todos os patches</option>
            {patches.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-metis-border">
          {([
            { key: 'overview',  label: 'Overview' },
            { key: 'builds',    label: 'Builds' },
            { key: 'matchups',  label: 'Matchups' },
            { key: 'synergies', label: 'Sinergias' },
          ] as { key: Tab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? 'border-metis-accent text-metis-accent'
                  : 'border-transparent text-metis-text-dim hover:text-metis-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        {loading ? (
          <div className="flex gap-1 py-16 justify-center">
            <span className="w-2 h-2 bg-metis-accent rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 bg-metis-accent rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 bg-metis-accent rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        ) : error ? (
          <div className="bg-metis-surface border border-metis-border rounded-xl p-8 text-center">
            <p className="text-sm text-metis-text-dim">{error}</p>
          </div>
        ) : (
          <>
            {tab === 'overview'  && <OverviewTab  overview={overview} />}
            {tab === 'builds'    && <BuildsTab    builds={builds} version={DDRAGON_VERSION} />}
            {tab === 'matchups'  && <MatchupsTab  matchups={matchups} />}
            {tab === 'synergies' && <SynergiesTab synergies={synergies} />}
          </>
        )}
      </main>
    </div>
  )
}

// ── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ overview }: { overview: Overview | null }) {
  if (!overview || overview.stats === null) {
    return (
      <div className="bg-metis-surface border border-metis-border rounded-xl p-8 text-center">
        <p className="text-sm text-metis-text-dim">
          Sem dados suficientes com os filtros selecionados.
        </p>
      </div>
    )
  }
  const s = overview.stats
  const kda = s.avg_deaths === 0
    ? '∞'
    : ((s.avg_kills + s.avg_assists) / s.avg_deaths).toFixed(2)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatBox label="Winrate"   value={`${s.winrate.toFixed(1)}%`} />
      <StatBox label="KDA"       value={kda} />
      <StatBox label="Avg Kills" value={s.avg_kills.toFixed(1)} />
      <StatBox label="Avg Deaths" value={s.avg_deaths.toFixed(1)} />
      <StatBox label="Avg Assists" value={s.avg_assists.toFixed(1)} />
      <StatBox label="CS/min"    value={s.avg_cs_per_minute.toFixed(1)} />
      <StatBox label="DPM"       value={Math.round(s.avg_damage_per_minute).toLocaleString('pt-BR')} />
      <StatBox label="Ouro médio" value={`${(s.avg_gold / 1000).toFixed(1)}k`} />
    </div>
  )
}

// ── Tab: Builds ──────────────────────────────────────────────────────────────

function BuildsTab({ builds, version }: { builds: BuildItem[]; version: string }) {
  if (builds.length === 0) {
    return (
      <div className="bg-metis-surface border border-metis-border rounded-xl p-8 text-center">
        <p className="text-sm text-metis-text-dim">Sem dados de builds com os filtros selecionados.</p>
      </div>
    )
  }

  return (
    <div className="bg-metis-surface border border-metis-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-metis-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase tracking-wide">Item</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase tracking-wide">Picks</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase tracking-wide">Winrate</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase tracking-wide">Patch</th>
            </tr>
          </thead>
          <tbody>
            {builds.map((item, i) => (
              <tr
                key={`${item.item_id}-${item.patch}`}
                className={`border-b border-metis-border/50 hover:bg-metis-bg/40 transition-colors ${
                  i % 2 === 0 ? '' : 'bg-metis-bg/20'
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Image
                      src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${item.item_id}.png`}
                      alt={item.item_name}
                      width={32}
                      height={32}
                      className="rounded border border-metis-border/50"
                      unoptimized
                    />
                    <span className="font-medium text-metis-text">{item.item_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-metis-text-dim">{item.pick_count}</td>
                <td className="px-4 py-3">
                  <WinrateBadge value={item.winrate_pct} />
                </td>
                <td className="px-4 py-3 text-metis-text-dim">{item.patch}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: Matchups ────────────────────────────────────────────────────────────

function MatchupsTab({ matchups }: { matchups: Matchup[] }) {
  if (matchups.length === 0) {
    return (
      <div className="bg-metis-surface border border-metis-border rounded-xl p-8 text-center">
        <p className="text-sm text-metis-text-dim">
          Sem dados de matchups. Tente filtrar por lane para resultados mais precisos.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-metis-surface border border-metis-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-metis-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase tracking-wide">Oponente</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase tracking-wide">Partidas</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase tracking-wide">Winrate</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase tracking-wide hidden sm:table-cell">vs Media</th>
            </tr>
          </thead>
          <tbody>
            {matchups.map((m, i) => {
              const diff = m.winrate_diff ?? 0
              const diffColor = diff > 2 ? 'text-green-400' : diff < -2 ? 'text-red-400' : 'text-metis-text-dim'
              const diffSign = diff > 0 ? '+' : ''

              return (
                <tr
                  key={m.opponent}
                  className={`border-b border-metis-border/50 hover:bg-metis-bg/40 transition-colors ${
                    i % 2 === 0 ? '' : 'bg-metis-bg/20'
                  }`}
                >
                  <td className="px-4 py-3">
                    <Link href={`/champions/${m.opponent}`} className="flex items-center gap-3 group">
                      <div className="relative w-8 h-8 rounded-md overflow-hidden border border-metis-border flex-shrink-0">
                        <Image
                          src={championIconUrl(m.opponent, DDRAGON_VERSION)}
                          alt={m.opponent}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <span className="font-medium text-metis-text group-hover:text-metis-accent transition-colors">
                        {m.opponent}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-metis-text-dim">{m.games}</td>
                  <td className="px-4 py-3"><WinrateBadge value={m.winrate} /></td>
                  <td className={`px-4 py-3 font-medium hidden sm:table-cell ${diffColor}`}>
                    {diffSign}{diff.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: Synergies ───────────────────────────────────────────────────────────

function SynergiesTab({ synergies }: { synergies: Synergy[] }) {
  if (synergies.length === 0) {
    return (
      <div className="bg-metis-surface border border-metis-border rounded-xl p-8 text-center">
        <p className="text-sm text-metis-text-dim">Sem dados de sinergias com os filtros selecionados.</p>
      </div>
    )
  }

  return (
    <div className="bg-metis-surface border border-metis-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-metis-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase tracking-wide">Aliado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase tracking-wide">Partidas</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase tracking-wide">Winrate</th>
            </tr>
          </thead>
          <tbody>
            {synergies.map((s, i) => (
              <tr
                key={s.ally}
                className={`border-b border-metis-border/50 hover:bg-metis-bg/40 transition-colors ${
                  i % 2 === 0 ? '' : 'bg-metis-bg/20'
                }`}
              >
                <td className="px-4 py-3">
                  <Link href={`/champions/${s.ally}`} className="flex items-center gap-3 group">
                    <div className="relative w-8 h-8 rounded-md overflow-hidden border border-metis-border flex-shrink-0">
                      <Image
                        src={championIconUrl(s.ally, DDRAGON_VERSION)}
                        alt={s.ally}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <span className="font-medium text-metis-text group-hover:text-metis-accent transition-colors">
                      {s.ally}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-metis-text-dim">{s.games}</td>
                <td className="px-4 py-3"><WinrateBadge value={s.winrate} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
