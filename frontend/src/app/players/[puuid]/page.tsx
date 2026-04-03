'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Swords, Star, StarOff, ArrowLeft, ChevronDown, ShieldCheck, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { MatchCard } from '@/components/matches/MatchCard'
import type { MatchData } from '@/components/matches/MatchCard'
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher'
import { championIconUrl, DDRAGON_VERSION } from '@/lib/ddragon'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''
const PAGE_SIZE = 10

const SERVERS = ['BR1', 'NA1', 'EUW1', 'KR', 'EUNE1', 'JP1', 'LA1', 'LA2', 'OC1']

type PlayerInfo = {
  game_name: string
  tag_line: string
  server: string | null
}

export default function PlayerPage() {
  const params = useParams()
  const router = useRouter()
  const rawParam = decodeURIComponent(params.puuid as string)
  const supabase = createClient()

  // Se o parâmetro tem "#" é um Riot ID (Nome#Tag), senão é PUUID real
  const isRiotId = rawParam.includes('#')
  const [riotName, riotTag] = isRiotId ? rawParam.split('#', 2) : ['', '']

  // PUUID real — só disponível após busca no DB ou sync
  const [resolvedPuuid, setResolvedPuuid] = useState<string | null>(isRiotId ? null : rawParam)
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null)
  const [syncServer, setSyncServer] = useState('BR1')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [watched, setWatched] = useState(false)
  const [watchLabel, setWatchLabel] = useState('')
  const [showLabelInput, setShowLabelInput] = useState(false)
  const [savingWatch, setSavingWatch] = useState(false)

  const [matches, setMatches] = useState<MatchData[]>([])
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  // ── Resumo agregado das partidas carregadas ────────────────
  const summary = useMemo(() => {
    if (!matches.length) return null

    const wins   = matches.filter(m => m.win).length
    const losses = matches.length - wins

    const avgCspm = matches.reduce((acc, m) => acc + (m.cs_per_minute ?? 0), 0) / matches.length

    const avgKda = matches.reduce((acc, m) => {
      const kda = m.deaths === 0
        ? (m.kills + m.assists)
        : (m.kills + m.assists) / m.deaths
      return acc + kda
    }, 0) / matches.length

    // Campeão mais jogado
    const champMap: Record<string, { games: number; wins: number }> = {}
    for (const m of matches) {
      if (!champMap[m.champion_name]) champMap[m.champion_name] = { games: 0, wins: 0 }
      champMap[m.champion_name].games++
      if (m.win) champMap[m.champion_name].wins++
    }
    const [topChampName, topChampStats] = Object.entries(champMap)
      .sort((a, b) => b[1].games - a[1].games)[0]

    return {
      wins, losses,
      winrate: Math.round((wins / matches.length) * 100),
      avgCspm: avgCspm.toFixed(1),
      avgKda:  avgKda.toFixed(2),
      topChampName,
      topChampGames: topChampStats.games,
      topChampWr:    Math.round((topChampStats.wins / topChampStats.games) * 100),
    }
  }, [matches])

  // ── Carrega info do jogador da tabela players ──────────────
  useEffect(() => {
    if (!resolvedPuuid) return
    supabase
      .from('players')
      .select('game_name, tag_line, server')
      .eq('puuid', resolvedPuuid)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPlayerInfo(data as PlayerInfo)
      })
  }, [resolvedPuuid])

  // ── Auth + watched ─────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      const puuidToCheck = resolvedPuuid ?? rawParam
      supabase
        .from('watched_players')
        .select('label')
        .eq('puuid', puuidToCheck)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setWatched(true)
            setWatchLabel(data.label ?? '')
          }
        })
    })
  }, [resolvedPuuid])

  // ── Histórico ──────────────────────────────────────────────
  useEffect(() => {
    if (!resolvedPuuid) {
      setLoadingMatches(false)
      return
    }
    loadHistory(resolvedPuuid, 0)
  }, [resolvedPuuid])

  async function loadHistory(puuid: string, startOffset: number) {
    setLoadingMatches(true)
    setMatchError(null)
    try {
      const res = await fetch(
        `${API_URL}/api/v1/player/history?puuid=${encodeURIComponent(puuid)}&limit=15&offset=${startOffset}`
      )
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const data = await res.json()
      setMatches(data.matches ?? [])
      setHasMore(data.has_more ?? false)
      setOffset(data.matches?.length ?? 0)
    } catch {
      setMatchError('Não foi possível carregar o histórico. O backend pode estar offline.')
    } finally {
      setLoadingMatches(false)
    }
  }

  async function loadMore() {
    if (!resolvedPuuid) return
    setLoadingMore(true)
    try {
      const res = await fetch(
        `${API_URL}/api/v1/player/history?puuid=${encodeURIComponent(resolvedPuuid)}&limit=${PAGE_SIZE}&offset=${offset}`
      )
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMatches(prev => [...prev, ...(data.matches ?? [])])
      setHasMore(data.has_more ?? false)
      setOffset(prev => prev + (data.matches?.length ?? 0))
    } catch { /* falha silenciosa */ } finally {
      setLoadingMore(false)
    }
  }

  // ── Sincronizar partidas ───────────────────────────────────
  async function handleSync() {
    const name = isRiotId ? riotName : playerInfo?.game_name
    const tag  = isRiotId ? riotTag  : playerInfo?.tag_line
    const server = playerInfo?.server ?? syncServer

    if (!name || !tag) return
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch(`${API_URL}/api/v1/player/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riot_id: `${name}#${tag}`, server, count: 15 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Erro desconhecido')

      // Após sync: se era Riot ID, redireciona para a página com PUUID real
      if (isRiotId && data.puuid) {
        router.replace(`/players/${encodeURIComponent(data.puuid)}`)
        return
      }

      setSyncMsg(`✓ ${data.novas} nova(s) partida(s) importada(s)`)
      if (resolvedPuuid) loadHistory(resolvedPuuid, 0)
    } catch (e: unknown) {
      setSyncMsg(`Erro: ${e instanceof Error ? e.message : 'falha na sincronização'}`)
    } finally {
      setSyncing(false)
    }
  }

  async function handleToggleWatch() {
    if (!userId) { router.push('/auth'); return }
    const puuidToUse = resolvedPuuid ?? rawParam
    if (watched) {
      setSavingWatch(true)
      await supabase.from('watched_players').delete().eq('puuid', puuidToUse)
      setWatched(false)
      setWatchLabel('')
      setSavingWatch(false)
    } else {
      setShowLabelInput(true)
    }
  }

  async function handleSaveWatch() {
    if (!userId) return
    const puuidToUse = resolvedPuuid ?? rawParam
    setSavingWatch(true)
    await supabase.from('watched_players').upsert(
      { user_id: userId, puuid: puuidToUse, label: watchLabel || null },
      { onConflict: 'user_id,puuid' }
    )
    setWatched(true)
    setShowLabelInput(false)
    setSavingWatch(false)
  }

  // ── Display name ───────────────────────────────────────────
  const displayName = isRiotId
    ? rawParam
    : playerInfo
      ? `${playerInfo.game_name}#${playerInfo.tag_line}`
      : null

  return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-metis-border bg-metis-surface">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-metis-accent" />
          <span className="font-bold text-metis-text tracking-tight">Metis</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <div className="w-px h-4 bg-metis-border" />
          <Link href="/" className="text-xs text-metis-text-dim hover:text-metis-text transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Início
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* Cabeçalho do jogador */}
        <div className="bg-metis-surface border border-metis-border rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {/* Nome principal */}
              <div className="flex items-center gap-2 mb-1">
                {displayName ? (
                  <p className="text-lg font-bold text-metis-text">{displayName}</p>
                ) : (
                  <p className="text-lg font-bold text-metis-text font-mono text-sm break-all">{rawParam}</p>
                )}
                {playerInfo?.server && (
                  <span className="text-[10px] border border-metis-border text-metis-text-dim rounded px-1.5 py-0.5 uppercase">
                    {playerInfo.server}
                  </span>
                )}
              </div>

              {/* PUUID reduzido */}
              {resolvedPuuid && (
                <p className="font-mono text-[10px] text-metis-text-dim truncate max-w-sm" title={resolvedPuuid}>
                  {resolvedPuuid.slice(0, 20)}…
                </p>
              )}

              {watched && watchLabel && (
                <p className="mt-1 text-sm font-semibold text-metis-accent">{watchLabel}</p>
              )}
            </div>

            {/* Ações */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={handleToggleWatch}
                disabled={savingWatch}
                className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors disabled:opacity-50
                           border-metis-border text-metis-text-dim hover:border-metis-accent hover:text-metis-accent"
              >
                {watched ? <><StarOff className="w-4 h-4" /><span className="hidden sm:block">Remover</span></>
                         : <><Star className="w-4 h-4" /><span className="hidden sm:block">Supervisionar</span></>}
              </button>
            </div>
          </div>

          {showLabelInput && (
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={watchLabel}
                onChange={e => setWatchLabel(e.target.value)}
                placeholder="Apelido (opcional)"
                className="flex-1 bg-metis-bg border border-metis-border rounded-lg px-3 py-2 text-sm text-metis-text placeholder-metis-muted outline-none focus:border-metis-accent transition-colors"
              />
              <button
                onClick={handleSaveWatch}
                disabled={savingWatch}
                className="bg-metis-accent hover:bg-metis-accent-hover text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          )}

          {/* Bloco de sincronização */}
          <div className="mt-4 pt-4 border-t border-metis-border/50">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Server selector: só aparece se não temos info do jogador */}
              {!playerInfo?.server && (
                <select
                  value={syncServer}
                  onChange={e => setSyncServer(e.target.value)}
                  className="bg-metis-bg border border-metis-border rounded-lg px-2 py-1.5 text-xs text-metis-text outline-none"
                >
                  {SERVERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}

              <button
                onClick={handleSync}
                disabled={syncing || (!isRiotId && !playerInfo)}
                className="flex items-center gap-1.5 text-xs bg-metis-accent hover:bg-metis-accent-hover text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Puxar partidas da Riot'}
              </button>

              {syncMsg && (
                <span className={`text-xs ${syncMsg.startsWith('Erro') ? 'text-red-400' : 'text-green-400'}`}>
                  {syncMsg}
                </span>
              )}
            </div>
            <p className="text-[11px] text-metis-text-dim mt-1.5">
              Busca as últimas 15 partidas ranqueadas na Riot API e salva no banco. Partidas já existentes são ignoradas.
            </p>
          </div>
        </div>

        {/* Resumo das últimas partidas */}
        {summary && (
          <div className="bg-metis-surface border border-metis-border rounded-xl p-4 mb-6">
            <p className="text-[10px] text-metis-text-dim uppercase tracking-wide font-medium mb-3">
              Resumo — últimas {matches.length} partidas
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Winrate */}
              <div className="flex flex-col items-center gap-1 bg-metis-bg/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <span className="text-blue-400">{summary.wins}V</span>
                  <span className="text-metis-text-dim text-xs">/</span>
                  <span className="text-red-400">{summary.losses}D</span>
                </div>
                <span className={`text-lg font-bold ${
                  summary.winrate >= 55 ? 'text-green-400'
                  : summary.winrate >= 50 ? 'text-metis-accent'
                  : 'text-red-400'
                }`}>
                  {summary.winrate}%
                </span>
                <span className="text-[10px] text-metis-text-dim">Winrate</span>
              </div>

              {/* KDA médio */}
              <div className="flex flex-col items-center gap-1 bg-metis-bg/50 rounded-lg p-3">
                <span className="text-lg font-bold text-metis-text">{summary.avgKda}</span>
                <span className="text-[10px] text-metis-text-dim">KDA Médio</span>
              </div>

              {/* CS/m médio */}
              <div className="flex flex-col items-center gap-1 bg-metis-bg/50 rounded-lg p-3">
                <span className={`text-lg font-bold ${
                  parseFloat(summary.avgCspm) >= 8 ? 'text-green-400'
                  : parseFloat(summary.avgCspm) >= 6 ? 'text-yellow-400'
                  : 'text-metis-text-dim'
                }`}>
                  {summary.avgCspm}
                </span>
                <span className="text-[10px] text-metis-text-dim">CS/min médio</span>
              </div>

              {/* Campeão mais jogado */}
              <div className="flex flex-col items-center gap-1 bg-metis-bg/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5">
                  <div className="relative w-8 h-8 rounded-md overflow-hidden border border-metis-border flex-shrink-0">
                    <Image
                      src={championIconUrl(summary.topChampName, DDRAGON_VERSION)}
                      alt={summary.topChampName}
                      fill className="object-cover" unoptimized
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-metis-text truncate max-w-[72px]">
                      {summary.topChampName}
                    </p>
                    <p className="text-[10px] text-metis-text-dim">
                      {summary.topChampGames}j · {summary.topChampWr}% WR
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-metis-text-dim mt-0.5">Mais jogado</span>
              </div>
            </div>
          </div>
        )}

        {/* Histórico de partidas */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-metis-text-dim uppercase tracking-wide">
              Últimas Partidas
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-metis-text-dim bg-metis-surface border border-metis-border rounded-full px-2.5 py-1">
              <ShieldCheck className="w-3 h-3 text-metis-accent" />
              Somente SoloQ / Flex
            </div>
          </div>

          {loadingMatches ? (
            <div className="flex gap-1 py-8 justify-center">
              <span className="w-2 h-2 bg-metis-accent rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-metis-accent rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-metis-accent rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          ) : !resolvedPuuid ? (
            <div className="bg-metis-surface border border-metis-border rounded-xl p-6 text-center">
              <p className="text-sm text-metis-text-dim">Clique em "Puxar partidas da Riot" para importar o histórico deste jogador.</p>
            </div>
          ) : matchError ? (
            <div className="bg-metis-surface border border-metis-border rounded-xl p-6 text-center">
              <p className="text-sm text-metis-text-dim">{matchError}</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="bg-metis-surface border border-metis-border rounded-xl p-6 text-center">
              <p className="text-sm text-metis-text-dim">Nenhuma partida ranqueada encontrada.</p>
              <p className="text-xs text-metis-text-dim mt-1">Use "Puxar partidas da Riot" para importar ou aguarde o pipeline diário.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {matches.map((m, i) => (
                  <MatchCard key={m.matches?.match_id ?? i} match={m} puuid={resolvedPuuid!} />
                ))}
              </div>

              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm text-metis-text-dim border border-metis-border rounded-xl hover:border-metis-accent hover:text-metis-accent transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <span className="w-1.5 h-1.5 bg-metis-accent rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-metis-accent rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-metis-accent rounded-full animate-bounce [animation-delay:300ms]" />
                    </>
                  ) : (
                    <><ChevronDown className="w-4 h-4" />Carregar mais partidas</>
                  )}
                </button>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}
