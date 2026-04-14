'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Star, StarOff, ChevronDown, ShieldCheck, RefreshCw, UserX } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { MatchCard } from '@/components/matches/MatchCard'
import type { MatchData } from '@/components/matches/MatchCard'
import { Header } from '@/components/ui/Header'
import { championIconUrl, DDRAGON_VERSION } from '@/lib/ddragon'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''
const PAGE_SIZE = 10
const SERVERS = ['BR1', 'NA1', 'EUW1', 'KR', 'EUNE1', 'JP1', 'LA1', 'LA2', 'OC1']

type PlayerInfo = {
  game_name: string
  tag_line: string
  server: string | null
  profile_icon_id: number | null
  tier: string | null
}

export default function PlayerPage() {
  const params  = useParams()
  const router  = useRouter()
  const supabase = createClient()

  const rawParam = decodeURIComponent(params.puuid as string)
  const isRiotId = rawParam.includes('#')
  const [riotName, riotTag] = isRiotId ? rawParam.split('#', 2) : ['', '']

  const [resolvedPuuid, setResolvedPuuid] = useState<string | null>(isRiotId ? null : rawParam)
  const [playerInfo,    setPlayerInfo]    = useState<PlayerInfo | null>(null)
  const [notInDb,       setNotInDb]       = useState(false)   // Riot ID buscado, não encontrado
  const [syncServer,    setSyncServer]    = useState('BR1')
  const [syncing,       setSyncing]       = useState(false)
  const [syncMsg,       setSyncMsg]       = useState<string | null>(null)
  const [cooldownEnd,   setCooldownEnd]   = useState<number | null>(null)  // ms timestamp
  const [cooldownLeft,  setCooldownLeft]  = useState(0)  // segundos restantes

  const [userId,         setUserId]         = useState<string | null>(null)
  const [watched,        setWatched]        = useState(false)
  const [watchLabel,     setWatchLabel]     = useState('')
  const [showLabelInput, setShowLabelInput] = useState(false)
  const [savingWatch,    setSavingWatch]    = useState(false)

  const [matches,        setMatches]       = useState<MatchData[]>([])
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [loadingMore,    setLoadingMore]   = useState(false)
  const [matchError,     setMatchError]    = useState<string | null>(null)
  const [hasMore,        setHasMore]       = useState(false)
  const [offset,         setOffset]        = useState(0)

  // ── Dados extras do jogador ─────────────────────────────────────────────
  type ChampStat = { champion: string; games: number; wins: number; winrate: number; avg_kills: number; avg_deaths: number; avg_assists: number; avg_cs_per_minute: number }
  type AllyData = { puuid: string; game_name: string; tag_line: string; server: string | null; games_together: number; wins_together: number; winrate: number }
  type NemesisData = { puuid: string; game_name: string; tag_line: string; server: string | null; times_faced: number; wins_against: number; winrate_against: number; champions_used: string[] }

  const [champStats, setChampStats] = useState<ChampStat[]>([])
  const [showAllChamps, setShowAllChamps] = useState(false)
  const [champRole, setChampRole] = useState('')
  const [champSeason, setChampSeason] = useState('S1-2026')
  const [champPatch, setChampPatch] = useState('')
  const [seasons, setSeasons] = useState<string[]>([])
  const [patchList, setPatchList] = useState<string[]>([])
  const [allies, setAllies] = useState<AllyData[]>([])
  const [nemeses, setNemeses] = useState<NemesisData[]>([])
  const [showAllAllies, setShowAllAllies] = useState(false)
  const [showAllNemeses, setShowAllNemeses] = useState(false)
  const [nameHistory, setNameHistory] = useState<{ old_game_name: string; old_tag_line: string; changed_at: string }[]>([])

  type Recommendation = { champion: string; role: string; role_label: string; similarity: number; confidence: number; winrate: number; games_in_db: number; times_played: number; reasons?: string[]; player_profile?: number[]; champion_profile?: number[] }
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [selectedRec, setSelectedRec] = useState<string | null>(null)

  // ── Cooldown: carrega do localStorage e inicia countdown ──────────────────
  const cooldownKey = `sync_cooldown_${resolvedPuuid ?? rawParam}`
  useEffect(() => {
    const stored = localStorage.getItem(cooldownKey)
    if (stored) {
      const end = parseInt(stored, 10)
      if (end > Date.now()) setCooldownEnd(end)
      else localStorage.removeItem(cooldownKey)
    }
  }, [resolvedPuuid])

  useEffect(() => {
    if (!cooldownEnd) { setCooldownLeft(0); return }
    const tick = () => {
      const left = Math.ceil((cooldownEnd - Date.now()) / 1000)
      if (left <= 0) {
        setCooldownEnd(null)
        setCooldownLeft(0)
        localStorage.removeItem(cooldownKey)
      } else {
        setCooldownLeft(left)
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [cooldownEnd])

  // ── 1. Se Riot ID → tenta resolver o PUUID no nosso banco ──────────────────
  useEffect(() => {
    if (!isRiotId) return

    supabase
      .from('players')
      .select('puuid, game_name, tag_line, server, profile_icon_id, tier')
      .ilike('game_name', riotName.trim())
      .ilike('tag_line',  riotTag.trim())
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          setResolvedPuuid(data.puuid)
          setPlayerInfo({ game_name: data.game_name, tag_line: data.tag_line, server: data.server, profile_icon_id: data.profile_icon_id, tier: data.tier ?? null })
        } else {
          // Nao achou pelo nome atual — tentar nome antigo
          const { data: oldData } = await supabase
            .from('player_name_history')
            .select('puuid, players(game_name, tag_line, server, profile_icon_id, tier)')
            .ilike('old_game_name', riotName.trim())
            .ilike('old_tag_line', riotTag.trim())
            .limit(1)
            .maybeSingle()

          if (oldData?.players) {
            const p = oldData.players as unknown as Record<string, unknown>
            // Redirecionar pro nome novo
            router.replace(`/players/${encodeURIComponent(`${p.game_name}#${p.tag_line}`)}`)
          } else {
            setNotInDb(true)
            setLoadingMatches(false)
          }
        }
      })
  }, [])

  // ── 2. Com PUUID resolvido → busca info completa do jogador ────────────────
  useEffect(() => {
    if (!resolvedPuuid || playerInfo) return
    supabase
      .from('players')
      .select('game_name, tag_line, server, profile_icon_id, tier')
      .eq('puuid', resolvedPuuid)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPlayerInfo(data as PlayerInfo)
      })
  }, [resolvedPuuid])

  // ── 3. Auth + watched ──────────────────────────────────────────────────────
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
          if (data) { setWatched(true); setWatchLabel(data.label ?? '') }
        })
    })
  }, [resolvedPuuid])

  // ── 4. Histórico do banco (persistente) + dados extras ──────────────────────
  useEffect(() => {
    if (!resolvedPuuid) return
    loadHistory(resolvedPuuid, 0)

    const p = encodeURIComponent(resolvedPuuid)
    fetch(`${API_URL}/api/v1/player/frequent-allies?puuid=${p}&min_games=2`)
      .then(r => r.ok ? r.json() : []).then(setAllies).catch(() => {})
    fetch(`${API_URL}/api/v1/player/nemesis?puuid=${p}&min_games=2`)
      .then(r => r.ok ? r.json() : []).then(setNemeses).catch(() => {})
    fetch(`${API_URL}/api/v1/player/name-history?puuid=${p}`)
      .then(r => r.ok ? r.json() : []).then(setNameHistory).catch(() => {})
    fetch(`${API_URL}/api/v1/player/recommendations?puuid=${p}&top_n=6&reasons=true`)
      .then(r => r.ok ? r.json() : []).then(setRecommendations).catch(() => {})
    fetch(`${API_URL}/api/v1/player/seasons`)
      .then(r => r.ok ? r.json() : []).then(setSeasons).catch(() => {})
    fetch(`${API_URL}/api/v1/stats/patches`)
      .then(r => r.ok ? r.json() : []).then(setPatchList).catch(() => {})
  }, [resolvedPuuid])

  // ── 4b. Champion stats com filtros ─────────────────────────────────────────
  useEffect(() => {
    if (!resolvedPuuid) return
    const params = new URLSearchParams({ puuid: resolvedPuuid })
    if (champRole) params.set('role', champRole)
    if (champPatch) params.set('patch', champPatch)
    else if (champSeason) params.set('season', champSeason)
    fetch(`${API_URL}/api/v1/player/champion-stats?${params}`)
      .then(r => r.ok ? r.json() : []).then(setChampStats).catch(() => {})
  }, [resolvedPuuid, champRole, champPatch, champSeason])

  async function loadHistory(puuid: string, startOffset: number) {
    setLoadingMatches(true)
    setMatchError(null)
    try {
      const res = await fetch(
        `${API_URL}/api/v1/player/history?puuid=${encodeURIComponent(puuid)}&limit=20&offset=${startOffset}`
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

  // ── 5. Sincronizar partidas novas com a Riot ───────────────────────────────
  async function handleSync() {
    const name   = isRiotId ? riotName : playerInfo?.game_name
    const tag    = isRiotId ? riotTag  : playerInfo?.tag_line
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
      if (res.status === 429 && data.detail?.retry_after_seconds) {
        const retryAfter: number = data.detail.retry_after_seconds
        const end = Date.now() + retryAfter * 1000
        setCooldownEnd(end)
        setCooldownLeft(retryAfter)
        localStorage.setItem(cooldownKey, String(end))
        setSyncMsg(`Aguarde ${Math.ceil(retryAfter / 60)} min para sincronizar novamente.`)
        return
      }
      if (!res.ok) throw new Error(
        typeof data.detail === 'string' ? data.detail : 'Erro desconhecido'
      )

      // Se era Riot ID não conhecido, agora temos o PUUID → redireciona
      if (isRiotId && data.puuid) {
        router.replace(`/players/${encodeURIComponent(data.puuid)}`)
        return
      }

      const novas = data.novas ?? 0
      setSyncMsg(novas > 0 ? `${novas} nova(s) partida(s) importada(s)` : 'Nenhuma partida nova encontrada')

      // Inicia cooldown de 5 min após sync bem-sucedido
      const end = Date.now() + 300_000
      setCooldownEnd(end)
      setCooldownLeft(300)
      localStorage.setItem(cooldownKey, String(end))

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
      setWatched(false); setWatchLabel(''); setSavingWatch(false)
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
    setWatched(true); setShowLabelInput(false); setSavingWatch(false)
  }

  // ── Resumo agregado ────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    if (!matches.length) return null
    const wins   = matches.filter(m => m.win).length
    const losses = matches.length - wins
    const avgCspm = matches.reduce((acc, m) => acc + (m.cs_per_minute ?? 0), 0) / matches.length
    const avgKda  = matches.reduce((acc, m) => {
      return acc + (m.deaths === 0 ? (m.kills + m.assists) : (m.kills + m.assists) / m.deaths)
    }, 0) / matches.length
    const champMap: Record<string, { games: number; wins: number }> = {}
    for (const m of matches) {
      if (!champMap[m.champion_name]) champMap[m.champion_name] = { games: 0, wins: 0 }
      champMap[m.champion_name].games++
      if (m.win) champMap[m.champion_name].wins++
    }
    const [topChampName, topChampStats] = Object.entries(champMap).sort((a, b) => b[1].games - a[1].games)[0]
    return {
      wins, losses,
      winrate:      Math.round((wins / matches.length) * 100),
      avgCspm:      avgCspm.toFixed(1),
      avgKda:       avgKda.toFixed(2),
      topChampName,
      topChampGames: topChampStats.games,
      topChampWr:    Math.round((topChampStats.wins / topChampStats.games) * 100),
    }
  }, [matches])

  // ── Resumo da temporada (baseado em champStats = todos os dados) ───────────
  const seasonSummary = useMemo(() => {
    if (!champStats.length) return null
    const totalGames = champStats.reduce((acc, c) => acc + c.games, 0)
    const wins = champStats.reduce((acc, c) => acc + c.wins, 0)
    const avgKda = champStats.reduce((acc, c) => {
      const kda = c.avg_deaths > 0 ? (c.avg_kills + c.avg_assists) / c.avg_deaths : (c.avg_kills + c.avg_assists)
      return acc + kda * c.games
    }, 0) / totalGames
    const top = champStats[0]
    return {
      totalGames,
      wins,
      winrate: Math.round((wins / totalGames) * 100),
      avgKda: avgKda.toFixed(2),
      uniqueChamps: champStats.length,
      topChampName: top.champion,
      topChampGames: top.games,
      topChampWr: Math.round(top.winrate),
    }
  }, [champStats])

  // ── Display helpers ────────────────────────────────────────────────────────
  const displayName = playerInfo
    ? `${playerInfo.game_name}#${playerInfo.tag_line}`
    : isRiotId ? rawParam : null

  const profileIconUrl = playerInfo?.profile_icon_id
    ? `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${playerInfo.profile_icon_id}.png`
    : null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-10">

        {/* ── Card do jogador ── */}
        <div className="bg-metis-surface border border-metis-border rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">

            {/* Ícone do invocador */}
            <div className="relative flex-shrink-0">
              {profileIconUrl ? (
                <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-metis-border">
                  <Image
                    src={profileIconUrl}
                    alt="Ícone do invocador"
                    width={64} height={64}
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl border-2 border-metis-border bg-metis-bg flex items-center justify-center">
                  <UserX className="w-7 h-7 text-metis-text-dim" />
                </div>
              )}
            </div>

            {/* Nome + info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="text-lg font-bold text-metis-text break-all">
                  {displayName ?? rawParam}
                </p>
                {playerInfo?.server && (
                  <span className="text-[10px] border border-metis-border text-metis-text-dim rounded px-1.5 py-0.5 uppercase flex-shrink-0">
                    {playerInfo.server}
                  </span>
                )}
                {playerInfo?.tier && (
                  <span className="text-[10px] font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-400 rounded px-2 py-0.5 uppercase flex-shrink-0">
                    {playerInfo.tier}
                  </span>
                )}
              </div>
              {nameHistory.length > 0 && (
                <p className="text-[10px] text-metis-muted mt-0.5">
                  Antes: {nameHistory.map(n => `${n.old_game_name}#${n.old_tag_line}`).join(' → ')}
                </p>
              )}
              {watched && watchLabel && (
                <p className="mt-1 text-sm font-semibold text-metis-accent">{watchLabel}</p>
              )}
            </div>

            {/* Botão supervisionar */}
            <button
              onClick={handleToggleWatch}
              disabled={savingWatch}
              className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors disabled:opacity-50 flex-shrink-0
                         border-metis-border text-metis-text-dim hover:border-metis-accent hover:text-metis-accent"
            >
              {watched
                ? <><StarOff className="w-4 h-4" /><span className="hidden sm:block">Remover</span></>
                : <><Star    className="w-4 h-4" /><span className="hidden sm:block">Supervisionar</span></>}
            </button>
          </div>

          {/* Label input */}
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
                disabled={syncing || cooldownLeft > 0 || (!isRiotId && !playerInfo)}
                className="flex items-center gap-1.5 text-xs bg-metis-accent hover:bg-metis-accent-hover text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px] justify-center"
              >
                <RefreshCw className={`w-3.5 h-3.5 flex-shrink-0 ${syncing ? 'animate-spin' : ''}`} />
                {syncing
                  ? 'Sincronizando...'
                  : cooldownLeft > 0
                    ? `${Math.floor(cooldownLeft / 60)}m ${String(cooldownLeft % 60).padStart(2, '0')}s`
                    : 'Ver partidas novas'}
              </button>

              {syncMsg && (
                <span className={`text-xs ${syncMsg.startsWith('Erro') ? 'text-red-400' : 'text-green-400'}`}>
                  {syncMsg}
                </span>
              )}
            </div>
            <p className="text-[11px] text-metis-text-dim mt-1.5">
              O histórico abaixo é o cache do nosso banco. Clique para buscar as últimas 15 partidas ranqueadas na Riot API e preencher eventuais lacunas.
            </p>
          </div>
        </div>

        {/* ── Estado: jogador não encontrado no banco ── */}
        {notInDb && (
          <div className="bg-metis-surface border border-metis-border rounded-xl p-6 mb-6 text-center">
            <UserX className="w-8 h-8 text-metis-text-dim mx-auto mb-3" />
            <p className="text-sm font-semibold text-metis-text mb-1">
              {rawParam} não está no nosso banco ainda
            </p>
            <p className="text-xs text-metis-text-dim mb-4">
              Escolha o servidor e clique em "Ver partidas novas" para importar o histórico deste jogador.
            </p>
          </div>
        )}

        {/* ── Resumos lado a lado ── */}
        {(summary || seasonSummary) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Resumo recente */}
            {summary && (
              <div className="bg-metis-surface border border-metis-border rounded-xl p-4">
                <p className="text-[10px] text-metis-text-dim uppercase tracking-wide font-medium mb-3">
                  Ultimas {matches.length} partidas
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center gap-1 bg-metis-bg/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <span className="text-blue-400">{summary.wins}V</span>
                      <span className="text-metis-text-dim text-xs">/</span>
                      <span className="text-red-400">{summary.losses}D</span>
                    </div>
                    <span className={`text-lg font-bold ${
                      summary.winrate >= 55 ? 'text-green-400' : summary.winrate >= 50 ? 'text-metis-accent' : 'text-red-400'
                    }`}>{summary.winrate}%</span>
                    <span className="text-[10px] text-metis-text-dim">Winrate</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 bg-metis-bg/50 rounded-lg p-3">
                    <span className="text-lg font-bold text-metis-text">{summary.avgKda}</span>
                    <span className="text-[10px] text-metis-text-dim">KDA Medio</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 bg-metis-bg/50 rounded-lg p-3">
                    <span className={`text-lg font-bold ${
                      parseFloat(summary.avgCspm) >= 8 ? 'text-green-400' : parseFloat(summary.avgCspm) >= 6 ? 'text-yellow-400' : 'text-metis-text-dim'
                    }`}>{summary.avgCspm}</span>
                    <span className="text-[10px] text-metis-text-dim">CS/min</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 bg-metis-bg/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5">
                      <div className="relative w-8 h-8 rounded-md overflow-hidden border border-metis-border flex-shrink-0">
                        <Image src={championIconUrl(summary.topChampName, DDRAGON_VERSION)} alt={summary.topChampName} fill className="object-cover" unoptimized />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-metis-text truncate">{summary.topChampName}</p>
                        <p className="text-[10px] text-metis-text-dim">{summary.topChampGames}j · {summary.topChampWr}%</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-metis-text-dim mt-0.5">Mais jogado</span>
                  </div>
                </div>
              </div>
            )}

            {/* Resumo da temporada (todos os dados) */}
            {seasonSummary && (
              <div className="bg-metis-surface border border-metis-border rounded-xl p-4">
                <p className="text-[10px] text-metis-text-dim uppercase tracking-wide font-medium mb-3">
                  Temporada ({seasonSummary.totalGames} partidas)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center gap-1 bg-metis-bg/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <span className="text-blue-400">{seasonSummary.wins}V</span>
                      <span className="text-metis-text-dim text-xs">/</span>
                      <span className="text-red-400">{seasonSummary.totalGames - seasonSummary.wins}D</span>
                    </div>
                    <span className={`text-lg font-bold ${
                      seasonSummary.winrate >= 55 ? 'text-green-400' : seasonSummary.winrate >= 50 ? 'text-metis-accent' : 'text-red-400'
                    }`}>{seasonSummary.winrate}%</span>
                    <span className="text-[10px] text-metis-text-dim">Winrate geral</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 bg-metis-bg/50 rounded-lg p-3">
                    <span className="text-lg font-bold text-metis-text">{seasonSummary.avgKda}</span>
                    <span className="text-[10px] text-metis-text-dim">KDA Medio</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 bg-metis-bg/50 rounded-lg p-3">
                    <span className="text-lg font-bold text-metis-text">{seasonSummary.uniqueChamps}</span>
                    <span className="text-[10px] text-metis-text-dim">Campeoes</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 bg-metis-bg/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5">
                      <div className="relative w-8 h-8 rounded-md overflow-hidden border border-metis-border flex-shrink-0">
                        <Image src={championIconUrl(seasonSummary.topChampName, DDRAGON_VERSION)} alt={seasonSummary.topChampName} fill className="object-cover" unoptimized />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-metis-text truncate">{seasonSummary.topChampName}</p>
                        <p className="text-[10px] text-metis-text-dim">{seasonSummary.topChampGames}j · {seasonSummary.topChampWr}%</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-metis-text-dim mt-0.5">Mais jogado</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Layout 2 colunas: sidebar + historico ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">

        {/* ── Coluna esquerda: campeoes + social ── */}
        <div>

        {/* ── Stats por Campeão ── */}
        {resolvedPuuid && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-metis-text-dim uppercase tracking-wide mb-2">
              Campeoes Jogados
            </h2>

            {/* Filtros */}
            <div className="flex gap-1.5 flex-wrap mb-3">
              <select value={champSeason} onChange={e => { setChampSeason(e.target.value); setChampPatch('') }}
                className="bg-metis-bg border border-metis-border rounded px-2 py-1 text-xs text-metis-text outline-none">
                <option value="">Geral</option>
                {seasons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={champPatch} onChange={e => { setChampPatch(e.target.value); if (e.target.value) setChampSeason('') }}
                className="bg-metis-bg border border-metis-border rounded px-2 py-1 text-xs text-metis-text outline-none">
                <option value="">Patch</option>
                {patchList.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={champRole} onChange={e => setChampRole(e.target.value)}
                className="bg-metis-bg border border-metis-border rounded px-2 py-1 text-xs text-metis-text outline-none">
                <option value="">Role</option>
                <option value="TOP">Top</option>
                <option value="JUNGLE">Jungle</option>
                <option value="MIDDLE">Mid</option>
                <option value="BOTTOM">ADC</option>
                <option value="UTILITY">Suporte</option>
              </select>
            </div>

            {/* Melhor campeao */}
            {champStats.length > 0 && champStats[0].games >= 2 && (
              <div className="flex items-center gap-3 bg-metis-bg/50 border border-metis-border/50 rounded-lg px-3 py-2 mb-3">
                <div className="relative w-8 h-8 rounded overflow-hidden border border-metis-accent/50 flex-shrink-0">
                  <Image src={championIconUrl(champStats[0].champion, DDRAGON_VERSION)} alt={champStats[0].champion} fill className="object-cover" unoptimized />
                </div>
                <div>
                  <p className="text-xs text-metis-text-dim">Melhor campeao</p>
                  <p className="text-sm font-semibold text-metis-accent">{champStats[0].champion}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className={`text-sm font-bold ${champStats[0].winrate > 55 ? 'text-green-400' : 'text-metis-text'}`}>{champStats[0].winrate}% WR</p>
                  <p className="text-[10px] text-metis-text-dim">{champStats[0].games} jogos</p>
                </div>
              </div>
            )}

            {champStats.length === 0 ? (
              <p className="text-xs text-metis-text-dim py-4 text-center">Sem dados para os filtros selecionados.</p>
            ) : (
              <div className="bg-metis-surface border border-metis-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-metis-border">
                      <th className="px-3 py-2 text-left text-xs font-medium text-metis-text-dim uppercase">Campeao</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-metis-text-dim uppercase">Jogos</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-metis-text-dim uppercase">WR</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-metis-text-dim uppercase">KDA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {champStats.slice(0, showAllChamps ? undefined : 5).map((c, i) => (
                      <tr key={c.champion} className={`border-b border-metis-border/50 ${i % 2 ? 'bg-metis-bg/20' : ''}`}>
                        <td className="px-3 py-2">
                          <Link href={`/champions/${c.champion}`} className="flex items-center gap-2 group">
                            <div className="relative w-6 h-6 rounded overflow-hidden border border-metis-border flex-shrink-0">
                              <Image src={championIconUrl(c.champion, DDRAGON_VERSION)} alt={c.champion} fill className="object-cover" unoptimized />
                            </div>
                            <span className="text-xs font-medium text-metis-text group-hover:text-metis-accent transition-colors truncate">{c.champion}</span>
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-xs text-metis-text-dim">{c.games}</td>
                        <td className={`px-2 py-2 text-xs font-semibold ${c.winrate > 55 ? 'text-green-400' : c.winrate < 45 ? 'text-red-400' : 'text-metis-text'}`}>
                          {c.winrate}%
                        </td>
                        <td className="px-2 py-2 text-xs text-metis-text-dim">
                          {c.avg_kills}/{c.avg_deaths}/{c.avg_assists}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {champStats.length > 5 && (
                  <button
                    onClick={() => setShowAllChamps(v => !v)}
                    className="w-full py-2 text-xs text-metis-text-dim hover:text-metis-accent transition-colors border-t border-metis-border"
                  >
                    {showAllChamps ? 'Mostrar menos' : `Ver todos (${champStats.length})`}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Jogou com + Nemesis ── */}
        {resolvedPuuid && (allies.length > 0 || nemeses.length > 0) && (
          <div className="flex flex-col gap-4 mb-6">
            {/* Allies */}
            {allies.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-metis-text-dim uppercase tracking-wide mb-3">
                  Jogou com ({allies.length})
                </h2>
                <div className="bg-metis-surface border border-metis-border rounded-xl overflow-hidden">
                  {allies.slice(0, showAllAllies ? undefined : 5).map((a, i) => (
                    <Link
                      key={a.puuid}
                      href={`/players/${encodeURIComponent(`${a.game_name}#${a.tag_line}`)}`}
                      className={`flex items-center gap-3 px-3 py-2.5 hover:bg-metis-bg/40 transition-colors ${i > 0 ? 'border-t border-metis-border/50' : ''}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-300 flex-shrink-0">
                        {a.game_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-metis-text truncate">{a.game_name}#{a.tag_line}</p>
                        <p className="text-[10px] text-metis-text-dim">{a.games_together}j · {a.wins_together}V {a.games_together - a.wins_together}D</p>
                      </div>
                      <span className={`text-xs font-semibold flex-shrink-0 ${a.winrate > 55 ? 'text-green-400' : a.winrate < 45 ? 'text-red-400' : 'text-metis-text-dim'}`}>
                        {a.winrate}%
                      </span>
                    </Link>
                  ))}
                  {allies.length > 5 && (
                    <button onClick={() => setShowAllAllies(v => !v)}
                      className="w-full py-2 text-xs text-metis-text-dim hover:text-metis-accent transition-colors border-t border-metis-border">
                      {showAllAllies ? 'Mostrar menos' : `Ver todos (${allies.length})`}
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* Nemesis */}
            {nemeses.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-metis-text-dim uppercase tracking-wide mb-3">
                  Nemesis ({nemeses.length})
                </h2>
                <div className="bg-metis-surface border border-metis-border rounded-xl overflow-hidden">
                  {nemeses.slice(0, showAllNemeses ? undefined : 5).map((n, i) => (
                    <Link
                      key={n.puuid}
                      href={`/players/${encodeURIComponent(`${n.game_name}#${n.tag_line}`)}`}
                      className={`flex items-center gap-3 px-3 py-2.5 hover:bg-metis-bg/40 transition-colors ${i > 0 ? 'border-t border-metis-border/50' : ''}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-[10px] font-bold text-red-300 flex-shrink-0">
                        {n.game_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-metis-text truncate">{n.game_name}#{n.tag_line}</p>
                        <p className="text-[10px] text-metis-text-dim">{n.times_faced}x · {n.champions_used.slice(0, 3).join(', ')}</p>
                      </div>
                      <span className={`text-xs font-semibold flex-shrink-0 ${n.winrate_against > 55 ? 'text-green-400' : n.winrate_against < 45 ? 'text-red-400' : 'text-metis-text-dim'}`}>
                        {n.winrate_against}%
                      </span>
                    </Link>
                  ))}
                  {nemeses.length > 5 && (
                    <button onClick={() => setShowAllNemeses(v => !v)}
                      className="w-full py-2 text-xs text-metis-text-dim hover:text-metis-accent transition-colors border-t border-metis-border">
                      {showAllNemeses ? 'Mostrar menos' : `Ver todos (${nemeses.length})`}
                    </button>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── Recomendacoes de Campeao ── */}
        {recommendations.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-metis-text-dim uppercase tracking-wide mb-3">
              Recomendados pra voce
            </h2>
            <div className="bg-metis-surface border border-metis-border rounded-xl overflow-hidden">
              {recommendations.map((r, i) => (
                <div key={`${r.champion}-${r.role}`}>
                  <button
                    onClick={() => setSelectedRec(selectedRec === `${r.champion}-${r.role}` ? null : `${r.champion}-${r.role}`)}
                    className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-metis-bg/40 transition-colors text-left ${i > 0 ? 'border-t border-metis-border/50' : ''}`}
                  >
                    <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-metis-accent/30 flex-shrink-0">
                      <Image src={championIconUrl(r.champion, DDRAGON_VERSION)} alt={r.champion} fill className="object-cover" unoptimized />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-metis-text">{r.champion}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-metis-border/50 text-metis-text-dim">{r.role_label}</span>
                      </div>
                      <p className="text-[10px] text-metis-text-dim">
                        {r.winrate}% WR · {r.games_in_db}j
                        {r.times_played > 0 && ` · jogou ${r.times_played}x`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${
                        r.confidence >= 80 ? 'text-green-400' :
                        r.confidence >= 60 ? 'text-metis-accent' :
                        r.confidence >= 40 ? 'text-amber-400' : 'text-metis-text-dim'
                      }`}>{r.confidence}%</p>
                      <p className="text-[10px] text-metis-text-dim">match</p>
                    </div>
                  </button>

                  {/* Detalhes expandidos com radar chart */}
                  {selectedRec === `${r.champion}-${r.role}` && r.player_profile && r.champion_profile && (
                    <div className="px-3 pb-4 border-t border-metis-border/30">
                      {/* Radar SVG */}
                      <div className="flex justify-center py-3">
                        <RadarChart
                          playerProfile={r.player_profile}
                          championProfile={r.champion_profile}
                          labels={['AGR', 'MAP', 'EFC', 'PRS', 'SBV', 'UTL', 'ERL', 'CST']}
                        />
                      </div>
                      {/* Legenda */}
                      <div className="flex justify-center gap-4 text-[10px] mb-2">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-metis-accent rounded" /> Voce</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-amber-400 rounded" /> {r.champion}</span>
                      </div>
                      {/* Dimensoes detalhadas */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {['Agressividade', 'Mapa', 'Eficiencia', 'Pressao', 'Sobrevivencia', 'Utilidade', 'Early Game', 'Consistencia'].map((label, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <span className="text-[9px] text-metis-text-dim w-20 truncate">{label}</span>
                            <div className="flex-1 bg-metis-border/30 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full bg-metis-accent/70 rounded-full" style={{ width: `${((r.player_profile?.[idx] ?? 0) / 10) * 100}%` }} />
                            </div>
                            <span className="text-[9px] text-metis-text-dim w-6 text-right">{(r.player_profile?.[idx] ?? 0).toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                      {/* Reasons */}
                      {r.reasons && r.reasons.length > 0 && (
                        <p className="text-[9px] text-metis-accent mt-2 text-center">{r.reasons.join(' · ')}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-metis-muted mt-1.5 text-center">
              8 dimensoes · similaridade de cosseno + distancia euclidiana
            </p>
          </section>
        )}

        </div>{/* fim coluna esquerda */}

        {/* ── Coluna direita: historico ── */}
        <div>

        {/* ── Histórico de partidas ── */}
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
          ) : !resolvedPuuid ? null
          : matchError ? (
            <div className="bg-metis-surface border border-metis-border rounded-xl p-6 text-center">
              <p className="text-sm text-metis-text-dim">{matchError}</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="bg-metis-surface border border-metis-border rounded-xl p-6 text-center">
              <p className="text-sm text-metis-text-dim">Nenhuma partida ranqueada encontrada no banco.</p>
              <p className="text-xs text-metis-text-dim mt-1">Clique em "Ver partidas novas" para importar ou aguarde o pipeline diário.</p>
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

        </div>{/* fim coluna direita */}
        </div>{/* fim grid */}
      </main>
    </div>
  )
}

// ── Radar Chart SVG ─────────────────────────────────────────────

function RadarChart({ playerProfile, championProfile, labels }: {
  playerProfile: number[]
  championProfile: number[]
  labels: string[]
}) {
  const n = labels.length
  const cx = 90, cy = 90, r = 70
  const angleStep = (2 * Math.PI) / n

  function point(idx: number, val: number): [number, number] {
    const angle = angleStep * idx - Math.PI / 2
    const dist = (val / 10) * r
    return [cx + dist * Math.cos(angle), cy + dist * Math.sin(angle)]
  }

  function polygon(values: number[]): string {
    return values.map((v, i) => point(i, v).join(',')).join(' ')
  }

  // Grid rings
  const rings = [2.5, 5, 7.5, 10]

  return (
    <svg viewBox="0 0 180 180" className="w-44 h-44">
      {/* Grid */}
      {rings.map(rv => (
        <polygon
          key={rv}
          points={Array.from({ length: n }, (_, i) => point(i, rv).join(',')).join(' ')}
          fill="none" stroke="rgb(var(--metis-border))" strokeWidth="0.5" opacity="0.4"
        />
      ))}
      {/* Axes */}
      {labels.map((_, i) => {
        const [px, py] = point(i, 10)
        return <line key={i} x1={cx} y1={cy} x2={px} y2={py} stroke="rgb(var(--metis-border))" strokeWidth="0.5" opacity="0.3" />
      })}
      {/* Champion polygon */}
      <polygon
        points={polygon(championProfile)}
        fill="rgba(251,191,36,0.15)" stroke="rgba(251,191,36,0.7)" strokeWidth="1.5"
      />
      {/* Player polygon */}
      <polygon
        points={polygon(playerProfile)}
        fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.8)" strokeWidth="1.5"
      />
      {/* Labels */}
      {labels.map((label, i) => {
        const [px, py] = point(i, 12)
        return (
          <text key={i} x={px} y={py} textAnchor="middle" dominantBaseline="central"
            className="fill-metis-text-dim" style={{ fontSize: '7px' }}>
            {label}
          </text>
        )
      })}
    </svg>
  )
}
