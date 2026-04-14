'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Search } from 'lucide-react'
import { Header } from '@/components/ui/Header'
import { DDRAGON_VERSION } from '@/lib/ddragon'
import { apiFetch } from '@/lib/api'

type ItemStat = {
  item_id: number
  item_name: string
  picks: number
  wins: number
  winrate: number
}

const ROLES = [
  { value: '', label: 'Todas as Roles' },
  { value: 'TOP', label: 'Top' },
  { value: 'JUNGLE', label: 'Jungle' },
  { value: 'MIDDLE', label: 'Mid' },
  { value: 'BOTTOM', label: 'ADC' },
  { value: 'UTILITY', label: 'Suporte' },
]

export default function ItemsPage() {
  const [data, setData] = useState<ItemStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState('')
  const [patches, setPatches] = useState<string[]>([])
  const [patch, setPatch] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'picks' | 'winrate'>('picks')

  useEffect(() => {
    apiFetch('/api/v1/stats/patches')
      .then(r => r.ok ? r.json() : [])
      .then(setPatches)
      .catch(() => {})
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ min_picks: '3' })
        if (role) params.set('role', role)
        if (patch) params.set('patch', patch)
        const res = await apiFetch(`/api/v1/items/ranking?${params}`)
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        setData(await res.json())
      } catch {
        setError('Nao foi possivel carregar os itens.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [role, patch])

  const filtered = data
    .filter(i => i.item_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === 'picks' ? b.picks - a.picks : b.winrate - a.winrate)

  return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-metis-text mb-1">Estatisticas de Itens</h1>
          <p className="text-sm text-metis-text-dim">Winrate e popularidade de cada item no banco Metis.</p>
        </div>

        {/* Filtros */}
        <div className="bg-metis-surface border border-metis-border rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 bg-metis-bg border border-metis-border rounded-lg px-3 py-2 flex-1 min-w-48">
            <Search className="w-4 h-4 text-metis-text-dim flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar item..."
              className="bg-transparent text-sm text-metis-text placeholder-metis-muted outline-none w-full"
            />
          </div>

          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="bg-metis-bg border border-metis-border rounded-lg px-3 py-2 text-sm text-metis-text outline-none focus:border-metis-accent transition-colors"
          >
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <select
            value={patch}
            onChange={e => setPatch(e.target.value)}
            className="bg-metis-bg border border-metis-border rounded-lg px-3 py-2 text-sm text-metis-text outline-none focus:border-metis-accent transition-colors"
          >
            <option value="">Todos os patches</option>
            {patches.map(p => (
              <option key={p} value={p}>Patch {p}</option>
            ))}
          </select>

          <div className="flex gap-1">
            <button
              onClick={() => setSortBy('picks')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                sortBy === 'picks' ? 'bg-metis-accent text-white' : 'bg-metis-bg border border-metis-border text-metis-text-dim'
              }`}
            >
              Popular
            </button>
            <button
              onClick={() => setSortBy('winrate')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                sortBy === 'winrate' ? 'bg-metis-accent text-white' : 'bg-metis-bg border border-metis-border text-metis-text-dim'
              }`}
            >
              Winrate
            </button>
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
            <p className="text-xs text-metis-text-dim mb-3">{filtered.length} itens encontrados</p>
            <div className="bg-metis-surface border border-metis-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-metis-border">
                      <th className="w-10 px-3 py-3 text-center text-xs font-medium text-metis-text-dim uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase">Picks</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase">Winrate</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-metis-text-dim uppercase hidden sm:table-cell">Vitorias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, i) => (
                      <tr
                        key={item.item_id}
                        className={`border-b border-metis-border/50 hover:bg-metis-bg/40 transition-colors ${
                          i % 2 ? 'bg-metis-bg/20' : ''
                        }`}
                      >
                        <td className="px-3 py-3 text-center text-xs text-metis-text-dim">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Image
                              src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${item.item_id}.png`}
                              alt={item.item_name}
                              width={32}
                              height={32}
                              className="rounded border border-metis-border/50"
                              unoptimized
                            />
                            <span className="font-medium text-metis-text">{item.item_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-metis-text-dim">{item.picks}</td>
                        <td className={`px-4 py-3 font-semibold ${
                          item.winrate > 55 ? 'text-green-400' : item.winrate < 45 ? 'text-red-400' : 'text-metis-text'
                        }`}>
                          {item.winrate}%
                        </td>
                        <td className="px-4 py-3 text-metis-text-dim hidden sm:table-cell">{item.wins}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
