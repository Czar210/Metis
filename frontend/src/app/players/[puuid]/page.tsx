'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Swords, Star, StarOff, ArrowLeft, ChevronDown, ShieldCheck, RefreshCw, UserX } from 'lucide-react'
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
  profile_icon_id: number | null
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
      .select('puuid, game_name, tag_line, server, profile_icon_id')
      .ilike('game_name', riotName.trim())
      .ilike('tag_line',  riotTag.trim())
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setResolvedPuuid(data.puuid)
          setPlayerInfo({ game_name: data.game_name, tag_line: data.tag_line, server: data.server, profile_icon_id: data.profile_icon_id })
        } else {
          // Jogador não está no nosso banco ainda
          setNotInDb(true)
          setLoadingMatches(false)
        }
      })
  }, [])

  // ── 2. Com PUUID resolvido → busca info completa do jogador ────────────────
  useEffect(() => {
    if (!resolvedPuuid || playerInfo) return
    supabase
      .from('players')
      .select('game_name, tag_line, server, profile_icon_id')
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

  // ── 4. Histórico do banco (persistente) ────────────────────────────────────
  useEffect(() => {
    if (!resolvedPuuid) return
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
              </div>
              {resolvedPuuid && (
                <p className="font-mono text-[10px] text-metis-text-dim truncate" title={resolvedPuuid}>
                  {resolvedPuuid.slice(0, 24)}…
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

        {/* ── Resumo das partidas ── */}
        {summary && (
          <div className="bg-metis-surface border border-metis-border rounded-xl p-4 mb-6">
            <p className="text-[10px] text-metis-text-dim uppercase tracking-wide font-medium mb-3">
              Resumo — últimas {matches.length} partidas
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                <span className="text-[10px] text-metis-text-dim">KDA Médio</span>
              </div>
              <div className="flex flex-col items-center gap-1 bg-metis-bg/50 rounded-lg p-3">
                <span className={`text-lg font-bold ${
                  parseFloat(summary.avgCspm) >= 8 ? 'text-green-400' : parseFloat(summary.avgCspm) >= 6 ? 'text-yellow-400' : 'text-metis-text-dim'
                }`}>{summary.avgCspm}</span>
                <span className="text-[10px] text-metis-text-dim">CS/min médio</span>
              </div>
              <div className="flex flex-col items-center gap-1 bg-metis-bg/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5">
                  <div className="relative w-8 h-8 rounded-md overflow-hidden border border-metis-border flex-shrink-0">
                    <Image src={championIconUrl(summary.topChampName, DDRAGON_VERSION)} alt={summary.topChampName} fill className="object-cover" unoptimized />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-metis-text truncate max-w-[72px]">{summary.topChampName}</p>
                    <p className="text-[10px] text-metis-text-dim">{summary.topChampGames}j · {summary.topChampWr}% WR</p>
                  </div>
                </div>
                <span className="text-[10px] text-metis-text-dim mt-0.5">Mais jogado</span>
              </div>
            </div>
          </div>
        )}

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
      </main>
    </div>
  )
}
