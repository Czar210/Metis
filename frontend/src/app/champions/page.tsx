'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Search } from 'lucide-react'
import { StatsTable, type ChampionStat } from '@/components/stats/StatsTable'
import { Header } from '@/components/ui/Header'
import { emblemPath } from '@/lib/ddragon'
import { apiFetch } from '@/lib/api'

const ROLES = [
  { value: '', label: 'Todas as Roles', icon: null },
  { value: 'TOP',     label: 'Top',     icon: '/roles/position-top.png' },
  { value: 'JUNGLE',  label: 'Jungle',  icon: '/roles/position-jungle.png' },
  { value: 'MIDDLE',  label: 'Mid',     icon: '/roles/position-middle.png' },
  { value: 'BOTTOM',  label: 'ADC',     icon: '/roles/position-bottom.png' },
  { value: 'UTILITY', label: 'Suporte', icon: '/roles/position-utility.png' },
]

const SERVERS = [
  { value: '', label: 'Todas as Regioes' },
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
  { value: '', label: 'Todos', emblem: null, scale: '4.5' },
  { value: 'IRON', label: 'Iron', emblem: 'Iron', scale: '4.9' },
  { value: 'BRONZE', label: 'Bronze', emblem: 'Bronze', scale: '4.7' },
  { value: 'SILVER', label: 'Silver', emblem: 'Silver', scale: '4.7' },
  { value: 'GOLD', label: 'Gold', emblem: 'Gold', scale: '4.5' },
  { value: 'PLATINUM', label: 'Platinum', emblem: 'Platinum', scale: '4.5' },
  { value: 'EMERALD', label: 'Emerald', emblem: 'Emerald', scale: '4.5' },
  { value: 'DIAMOND', label: 'Diamond', emblem: 'Diamond', scale: '4.5' },
  { value: 'MASTER', label: 'Master', emblem: 'Master', scale: '4.5' },
  { value: 'GRANDMASTER', label: 'Grandmaster', emblem: 'Grandmaster', scale: '5' },
  { value: 'CHALLENGER', label: 'Challenger', emblem: 'Challenger', scale: '4.5' },
]

export default function ChampionsPage() {
  const [data, setData] = useState<ChampionStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [role, setRole] = useState('')
  const [server, setServer] = useState('')
  const [patchFrom, setPatchFrom] = useState('')
  const [patchTo, setPatchTo] = useState('')
  const [elo, setElo] = useState('')
  const [search, setSearch] = useState('')
  const [patches, setPatches] = useState<string[]>([])

  useEffect(() => {
    apiFetch('/api/v1/stats/patches')
      .then(r => r.ok ? r.json() : [])
      .then(setPatches)
      .catch(() => {})
  }, [])

  // Filtra patches selecionados no range (patches vem ordenado desc: 16.7, 16.6, ...)
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
        const json = await res.json()
        setData(json)
      } catch {
        setError('Não foi possível carregar a tier list. O backend pode estar offline.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [role, server, patchFrom, patchTo])

  return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      <Header />

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

          {/* Patch range */}
          <div className="flex items-center gap-2">
            <select
              value={patchFrom}
              onChange={e => setPatchFrom(e.target.value)}
              className="bg-metis-bg border border-metis-border rounded-lg px-3 py-2 text-sm text-metis-text outline-none focus:border-metis-accent transition-colors"
            >
              <option value="">Patch inicial</option>
              {patches.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <span className="text-metis-text-dim text-sm">a</span>
            <select
              value={patchTo}
              onChange={e => setPatchTo(e.target.value)}
              className="bg-metis-bg border border-metis-border rounded-lg px-3 py-2 text-sm text-metis-text outline-none focus:border-metis-accent transition-colors"
            >
              <option value="">Patch final</option>
              {patches.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Elo */}
          <div className="flex gap-2 flex-wrap items-center">
            {ELOS.map(e => (
              <button
                key={e.value}
                onClick={() => setElo(e.value)}
                title={e.label}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors min-w-[56px] ${
                  elo === e.value
                    ? 'bg-metis-accent/20 border border-metis-accent text-metis-accent'
                    : 'bg-metis-bg border border-metis-border text-metis-text-dim hover:text-metis-text hover:border-metis-text-dim'
                }`}
              >
                {e.emblem ? (
                  <div className="w-12 h-10 relative overflow-hidden flex-shrink-0">
                    <Image
                      src={emblemPath(e.emblem)}
                      alt={e.label}
                      width={200}
                      height={200}
                      unoptimized
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%]"
                      style={{ transform: `translate(-50%, -45%) scale(${e.scale})` }}
                    />
                  </div>
                ) : null}
                <span>{e.label}</span>
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
