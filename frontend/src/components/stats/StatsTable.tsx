'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { championIconUrl, DDRAGON_VERSION } from '@/lib/ddragon'

export type ChampionStat = {
  champion: string
  total_matches: number
  winrate: number
  avg_kills: number
  avg_deaths: number
  avg_assists: number
  avg_gold: number
  avg_damage_per_minute: number
}

type SortKey = keyof ChampionStat
type SortDir = 'asc' | 'desc'

function WinrateCell({ value }: { value: number }) {
  const color =
    value > 51 ? 'text-green-400' :
    value < 49 ? 'text-red-400' :
    'text-metis-text'
  return <span className={`font-semibold ${color}`}>{value.toFixed(1)}%</span>
}

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (column !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30" />
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-metis-accent" />
    : <ChevronDown className="w-3 h-3 text-metis-accent" />
}

type Props = {
  data: ChampionStat[]
  searchQuery: string
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'champion', label: 'Campeão' },
  { key: 'total_matches', label: 'Partidas' },
  { key: 'winrate', label: 'Winrate' },
  { key: 'avg_kills', label: 'K' },
  { key: 'avg_deaths', label: 'D' },
  { key: 'avg_assists', label: 'A' },
  { key: 'avg_gold', label: 'Ouro' },
  { key: 'avg_damage_per_minute', label: 'DPM' },
]

export function StatsTable({ data, searchQuery }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('winrate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filtered = data.filter(c =>
    c.champion.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  if (sorted.length === 0) {
    return (
      <div className="bg-metis-surface border border-metis-border rounded-xl p-8 text-center">
        <p className="text-sm text-metis-text-dim">Nenhum campeão encontrado com os filtros selecionados.</p>
      </div>
    )
  }

  return (
    <div className="bg-metis-surface border border-metis-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-metis-border">
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase tracking-wide cursor-pointer hover:text-metis-text transition-colors select-none"
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <SortIcon column={col.key} sortKey={sortKey} sortDir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr
                key={c.champion}
                className={`border-b border-metis-border/50 hover:bg-metis-bg/40 transition-colors ${
                  i % 2 === 0 ? '' : 'bg-metis-bg/20'
                }`}
              >
                {/* Campeão */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative w-8 h-8 rounded-md overflow-hidden flex-shrink-0 border border-metis-border">
                      <Image
                        src={championIconUrl(c.champion, DDRAGON_VERSION)}
                        alt={c.champion}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <span className="font-medium text-metis-text">{c.champion}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-metis-text-dim">{c.total_matches}</td>
                <td className="px-4 py-3"><WinrateCell value={c.winrate} /></td>
                <td className="px-4 py-3 text-metis-text-dim">{c.avg_kills.toFixed(1)}</td>
                <td className="px-4 py-3 text-metis-text-dim">{c.avg_deaths.toFixed(1)}</td>
                <td className="px-4 py-3 text-metis-text-dim">{c.avg_assists.toFixed(1)}</td>
                <td className="px-4 py-3 text-metis-text-dim">{(c.avg_gold / 1000).toFixed(1)}k</td>
                <td className="px-4 py-3 text-metis-text-dim">{Math.round(c.avg_damage_per_minute)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
