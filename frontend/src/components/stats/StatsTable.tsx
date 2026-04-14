'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { championIconUrl, roleIconPath, DDRAGON_VERSION } from '@/lib/ddragon'

export type ChampionStat = {
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

type SortKey = 'champion' | 'total_matches' | 'winrate' | 'pickrate' | 'banrate' | 'kda'
type SortDir = 'asc' | 'desc'

const TIER_STYLE: Record<string, { color: string; bg: string }> = {
  'S+': { color: 'text-amber-400',       bg: 'bg-amber-400/15 border-amber-400/40' },
  'S':  { color: 'text-orange-300',      bg: 'bg-orange-400/15 border-orange-400/40' },
  'A':  { color: 'text-green-400',       bg: 'bg-green-400/15 border-green-400/40' },
  'B':  { color: 'text-blue-400',        bg: 'bg-blue-400/15 border-blue-400/40' },
  'C':  { color: 'text-metis-text-dim',  bg: 'bg-metis-border/30 border-metis-border' },
  'D':  { color: 'text-red-400',         bg: 'bg-red-400/15 border-red-400/40' },
}

function TierBadge({ tier }: { tier: string }) {
  const style = TIER_STYLE[tier] ?? TIER_STYLE['C']
  return (
    <span className={`text-[11px] font-bold w-8 h-6 flex items-center justify-center rounded border ${style.bg} ${style.color}`}>
      {tier}
    </span>
  )
}

function WinrateCell({ value }: { value: number }) {
  const color =
    value > 52 ? 'text-green-400' :
    value < 48 ? 'text-red-400' :
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

const COLUMNS: { key: SortKey; label: string; hideOnMobile?: boolean }[] = [
  { key: 'winrate',        label: 'Winrate' },
  { key: 'pickrate',       label: 'Pickrate' },
  { key: 'banrate',        label: 'Banrate', hideOnMobile: true },
  { key: 'kda',            label: 'KDA' },
  { key: 'total_matches',  label: 'Partidas', hideOnMobile: true },
]

function getKda(c: ChampionStat): number {
  return c.kda ?? (c.avg_deaths > 0 ? (c.avg_kills + c.avg_assists) / c.avg_deaths : 99)
}

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
    let av: number | string, bv: number | string
    if (sortKey === 'kda') {
      av = getKda(a); bv = getKda(b)
    } else if (sortKey === 'champion') {
      av = a.champion; bv = b.champion
    } else if (sortKey === 'pickrate') {
      av = a.pickrate ?? 0; bv = b.pickrate ?? 0
    } else if (sortKey === 'banrate') {
      av = a.banrate ?? 0; bv = b.banrate ?? 0
    } else {
      av = a[sortKey]; bv = b[sortKey]
    }
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  if (sorted.length === 0) {
    return (
      <div className="bg-metis-surface border border-metis-border rounded-xl p-8 text-center">
        <p className="text-sm text-metis-text-dim">Nenhum campeao encontrado com os filtros selecionados.</p>
      </div>
    )
  }

  return (
    <div className="bg-metis-surface border border-metis-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-metis-border">
              {/* # */}
              <th className="w-10 px-3 py-3 text-center text-xs font-medium text-metis-text-dim uppercase tracking-wide">#</th>
              {/* Champion */}
              <th
                onClick={() => handleSort('champion')}
                className="px-3 py-3 text-left text-xs font-medium text-metis-text-dim uppercase tracking-wide cursor-pointer hover:text-metis-text transition-colors select-none"
              >
                <span className="flex items-center gap-1">
                  Campeao
                  <SortIcon column="champion" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              {/* Tier */}
              <th className="w-16 px-2 py-3 text-center text-xs font-medium text-metis-text-dim uppercase tracking-wide">Tier</th>
              {/* Data columns */}
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase tracking-wide cursor-pointer hover:text-metis-text transition-colors select-none ${col.hideOnMobile ? 'hidden sm:table-cell' : ''}`}
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
            {sorted.map((c, i) => {
              const kda = getKda(c)
              const kdaStr = kda >= 99 ? 'Perfect' : kda.toFixed(2)

              const roleIcon = c.role ? roleIconPath(c.role) : null

              return (
                <tr
                  key={`${c.champion}-${c.role ?? i}`}
                  className={`border-b border-metis-border/50 hover:bg-metis-bg/40 transition-colors ${
                    i % 2 === 0 ? '' : 'bg-metis-bg/20'
                  }`}
                >
                  {/* # */}
                  <td className="px-3 py-3 text-center text-xs text-metis-text-dim font-medium">{i + 1}</td>

                  {/* Champion + role icon */}
                  <td className="px-3 py-3">
                    <Link href={`/champions/${c.champion}`} className="flex items-center gap-3 group">
                      <div className="relative w-8 h-8 rounded-md overflow-hidden flex-shrink-0 border border-metis-border">
                        <Image
                          src={championIconUrl(c.champion, DDRAGON_VERSION)}
                          alt={c.champion}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-metis-text group-hover:text-metis-accent transition-colors block">
                          {c.champion}
                        </span>
                        {c.role_label && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {roleIcon && (
                              <Image src={roleIcon} alt={c.role_label} width={10} height={10} unoptimized className="opacity-50" />
                            )}
                            <span className="text-[10px] text-metis-muted">{c.role_label}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  </td>

                  {/* Tier */}
                  <td className="px-2 py-3 text-center">
                    {c.tier ? <TierBadge tier={c.tier} /> : null}
                  </td>

                  {/* Winrate */}
                  <td className="px-4 py-3"><WinrateCell value={c.winrate} /></td>

                  {/* Pickrate */}
                  <td className="px-4 py-3 text-metis-text-dim">{(c.pickrate ?? 0).toFixed(1)}%</td>

                  {/* Banrate */}
                  <td className="px-4 py-3 text-metis-text-dim hidden sm:table-cell">
                    {(c.banrate ?? 0) > 0 ? `${(c.banrate ?? 0).toFixed(1)}%` : '—'}
                  </td>

                  {/* KDA */}
                  <td className="px-4 py-3 text-metis-text-dim">
                    <span className="font-medium">{kdaStr}</span>
                  </td>

                  {/* Partidas */}
                  <td className="px-4 py-3 text-metis-text-dim hidden sm:table-cell">{c.total_matches}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
