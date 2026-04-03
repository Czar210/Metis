'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Swords, Search, Sparkles, Users, Home } from 'lucide-react'
import { StatsTable, type ChampionStat } from '@/components/stats/StatsTable'
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher'
import { emblemPath } from '@/lib/ddragon'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

const ROLES = [
  { value: '', label: 'Todas', icon: null },
  { value: 'TOP',     label: 'Top',     icon: '/roles/position-top.png' },
  { value: 'JUNGLE',  label: 'Jungle',  icon: '/roles/position-jungle.png' },
  { value: 'MIDDLE',  label: 'Mid',     icon: '/roles/position-middle.png' },
  { value: 'BOTTOM',  label: 'ADC',     icon: '/roles/position-bottom.png' },
  { value: 'UTILITY', label: 'Suporte', icon: '/roles/position-utility.png' },
]

const SERVERS = [
  { value: '', label: 'Todas' },
  { value: 'BR1', label: 'BR' },
  { value: 'NA1', label: 'NA' },
  { value: 'EUW1', label: 'EUW' },
  { value: 'KR', label: 'KR' },
  { value: 'EUNE1', label: 'EUNE' },
  { value: 'JP1', label: 'JP' },
  { value: 'LA1', label: 'LAN' },
  { value: 'LA2', label: 'LAS' },
  { value: 'OC1', label: 'OCE' },
]

const ELOS = [
  { value: '', label: 'Todos', emblem: null },
  { value: 'IRON', label: 'Iron', emblem: 'Iron' },
  { value: 'BRONZE', label: 'Bronze', emblem: 'Bronze' },
  { value: 'SILVER', label: 'Silver', emblem: 'Silver' },
  { value: 'GOLD', label: 'Gold', emblem: 'Gold' },
  { value: 'PLATINUM', label: 'Platinum', emblem: 'Platinum' },
  { value: 'EMERALD', label: 'Emerald', emblem: 'Emerald' },
  { value: 'DIAMOND', label: 'Diamond', emblem: 'Diamond' },
  { value: 'MASTER', label: 'Master', emblem: 'Master' },
  { value: 'GRANDMASTER', label: 'Grandmaster', emblem: 'Grandmaster' },
  { value: 'CHALLENGER', label: 'Challenger', emblem: 'Challenger' },
]

export default function ChampionsPage() {
  const [data, setData] = useState<ChampionStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [role, setRole] = useState('')
  const [server, setServer] = useState('')
  const [patch, setPatch] = useState('')
  const [elo, setElo] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ min_matches: '1' })
        if (role) params.set('role', role)
        if (server) params.set('server', server)
        if (patch) params.set('patch', patch)

        const res = await fetch(`${API_URL}/api/v1/stats/tierlist?${params}`)
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        const json = await res.json()
        setData(json)
      } catch {
        setError('Não foi possível carregar a tier list. O backend pode estar offline.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [role, server, patch])

  return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-metis-border bg-metis-surface">
        <Link href="/" className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-metis-accent" />
          <span className="font-bold text-metis-text tracking-tight">Metis</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <div className="w-px h-4 bg-metis-border mx-1" />
          <Link href="/" className="flex items-center gap-1.5 text-xs text-metis-text-dim hover:text-metis-text transition-colors px-2 py-1.5">
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Início</span>
          </Link>
          <Link href="/changelog" className="flex items-center gap-1.5 text-xs text-metis-text-dim hover:text-metis-text transition-colors px-2 py-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:block">O que é novo</span>
          </Link>
          <Link href="/team" className="flex items-center gap-1.5 text-xs text-metis-text-dim hover:text-metis-text transition-colors px-2 py-1.5">
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Equipe</span>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-metis-text mb-1">Tier List</h1>
          <p className="text-sm text-metis-text-dim">Estatísticas agregadas dos campeões com base nas partidas do banco Metis.</p>
        </div>

        {/* Filtros */}
        <div className="bg-metis-surface border border-metis-border rounded-xl p-4 mb-6 flex flex-wrap gap-4">

          {/* Busca por campeão */}
          <div className="flex items-center gap-2 bg-metis-bg border border-metis-border rounded-lg px-3 py-2 flex-1 min-w-48">
            <Search className="w-4 h-4 text-metis-text-dim flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar campeão..."
              className="bg-transparent text-sm text-metis-text placeholder-metis-muted outline-none w-full"
            />
          </div>

          {/* Role */}
          <div className="flex gap-1 flex-wrap">
            {ROLES.map(r => (
              <button
                key={r.value}
                onClick={() => setRole(r.value)}
                title={r.label}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  role === r.value
                    ? 'bg-metis-accent text-white'
                    : 'bg-metis-bg border border-metis-border text-metis-text-dim hover:text-metis-text'
                }`}
              >
                {r.icon && (
                  <Image
                    src={r.icon}
                    alt={r.label}
                    width={14}
                    height={14}
                    unoptimized
                    className={role === r.value ? 'brightness-0 invert' : 'opacity-60'}
                  />
                )}
                {r.label}
              </button>
            ))}
          </div>

          {/* Servidor */}
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
          <input
            type="text"
            value={patch}
            onChange={e => setPatch(e.target.value)}
            placeholder="Patch (ex: 15.1)"
            className="bg-metis-bg border border-metis-border rounded-lg px-3 py-2 text-sm text-metis-text placeholder-metis-muted outline-none focus:border-metis-accent transition-colors w-36"
          />

          {/* Elo — no-op, UI pronta */}
          <div className="flex gap-1 flex-wrap items-center">
            {ELOS.map(e => (
              <button
                key={e.value}
                onClick={() => setElo(e.value)}
                title={e.label}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  elo === e.value
                    ? 'bg-metis-accent text-white'
                    : 'bg-metis-bg border border-metis-border text-metis-text-dim hover:text-metis-text'
                }`}
              >
                {e.emblem ? (
                  <Image
                    src={emblemPath(e.emblem)}
                    alt={e.label}
                    width={18}
                    height={18}
                    unoptimized
                  />
                ) : (
                  e.label
                )}
              </button>
            ))}
            {elo && (
              <span className="text-xs text-metis-text-dim italic ml-1">(filtro em breve)</span>
            )}
          </div>
        </div>

        {/* Tabela */}
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
            <p className="text-xs text-metis-text-dim mb-3">{data.length} campeões encontrados</p>
            <StatsTable data={data} searchQuery={search} />
          </>
        )}
      </main>
    </div>
  )
}
