'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { DDRAGON_VERSION, championIconUrl, roleIconPath } from '@/lib/ddragon'
import { apiFetch } from '@/lib/api'
import {
  AppHeader,
  Card,
  SectionLabel,
  Stat,
  Bar,
  Pill,
  Icon,
  ChampPortrait,
  Donut,
  AreaChart,
  RadarChart as DsRadarChart,
  StackedBar,
  WinLossDots,
  ROLES_PT,
  type Role,
} from '@/components/design'

// ── Types ──────────────────────────────────────────────────────────
const PAGE_SIZE = 10
const SERVERS = ['BR1', 'NA1', 'EUW1', 'KR', 'EUNE1', 'JP1', 'LA1', 'LA2', 'OC1']

type PlayerInfo = {
  game_name: string
  tag_line: string
  server: string | null
  profile_icon_id: number | null
  tier: string | null
}

type MatchData = {
  champion_name: string
  team_position: string
  team_id: number | null
  win: boolean
  kills: number
  deaths: number
  assists: number
  gold_earned: number
  total_damage_dealt_to_champions: number
  vision_score: number | null
  kill_participation: number | null
  damage_per_minute: number | null
  total_cs: number | null
  cs_per_minute: number | null
  champion_level: number | null
  items: number[] | null
  rune_keystone: number | null
  summoner1_id: number | null
  summoner2_id: number | null
  matches: {
    match_id: string
    game_version: string
    game_duration: number
    queue_id: number
    end_type: string
    game_end_timestamp: number | null
  }
}

type ChampStat = {
  champion: string
  games: number
  wins: number
  winrate: number
  avg_kills: number
  avg_deaths: number
  avg_assists: number
  avg_cs_per_minute: number
}

type AllyData = {
  puuid: string
  game_name: string
  tag_line: string
  server: string | null
  games_together: number
  wins_together: number
  winrate: number
}

type NemesisData = {
  puuid: string
  game_name: string
  tag_line: string
  server: string | null
  times_faced: number
  wins_against: number
  winrate_against: number
  champions_used: string[]
}

type Recommendation = {
  champion: string
  role: string
  role_label: string
  similarity: number
  confidence: number
  winrate: number
  games_in_db: number
  times_played: number
  reasons?: string[]
  player_profile?: number[]
  champion_profile?: number[]
}

// ── Helpers ────────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatRelativeDate(ts: number | null): string {
  if (!ts) return '—'
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins}m`
  if (hours < 24) return `há ${hours}h`
  if (days < 7) return `há ${days}d`
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

const RANK_COLOR: Record<string, string> = {
  IRON: '#857668',        BRONZE: '#A96C3C',      SILVER: '#B4C0CF',
  GOLD: '#E8B841',        PLATINUM: '#4FC6CC',    EMERALD: '#44D19E',
  DIAMOND: '#9FB7E6',     MASTER: '#C581E6',      GRANDMASTER: '#E87070',
  CHALLENGER: '#66D7F0',
}

// ── Page ───────────────────────────────────────────────────────────
export default function PlayerPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const rawParam = decodeURIComponent(params.puuid as string)
  const isRiotId = rawParam.includes('#')
  const [riotName, riotTag] = isRiotId ? rawParam.split('#', 2) : ['', '']

  const [resolvedPuuid, setResolvedPuuid] = useState<string | null>(isRiotId ? null : rawParam)
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null)
  const [notInDb, setNotInDb] = useState(false)

  const [syncServer, setSyncServer] = useState('BR1')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null)
  const [cooldownLeft, setCooldownLeft] = useState(0)

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

  const [champStats, setChampStats] = useState<ChampStat[]>([])
  const [showAllChamps, setShowAllChamps] = useState(false)
  const [champRole, setChampRole] = useState('')
  const [champSeason, setChampSeason] = useState('S1-2026')
  const [champPatch, setChampPatch] = useState('')
  const [seasons, setSeasons] = useState<string[]>([])
  const [patchList, setPatchList] = useState<string[]>([])

  const [allies, setAllies] = useState<AllyData[]>([])
  const [nemeses, setNemeses] = useState<NemesisData[]>([])
  const [nameHistory, setNameHistory] = useState<
    { old_game_name: string; old_tag_line: string; changed_at: string }[]
  >([])

  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [selectedRec, setSelectedRec] = useState<string | null>(null)

  // ── Cooldown
  const cooldownKey = `sync_cooldown_${resolvedPuuid ?? rawParam}`
  useEffect(() => {
    const stored = localStorage.getItem(cooldownKey)
    if (stored) {
      const end = parseInt(stored, 10)
      if (end > Date.now()) setCooldownEnd(end)
      else localStorage.removeItem(cooldownKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedPuuid])

  useEffect(() => {
    if (!cooldownEnd) {
      setCooldownLeft(0)
      return
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooldownEnd])

  // ── Resolver Riot ID → PUUID
  useEffect(() => {
    if (!isRiotId) return
    supabase
      .from('players')
      .select('puuid, game_name, tag_line, server, profile_icon_id, tier')
      .ilike('game_name', riotName.trim())
      .ilike('tag_line', riotTag.trim())
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          setResolvedPuuid(data.puuid)
          setPlayerInfo({
            game_name: data.game_name,
            tag_line: data.tag_line,
            server: data.server,
            profile_icon_id: data.profile_icon_id,
            tier: data.tier ?? null,
          })
        } else {
          const { data: oldData } = await supabase
            .from('player_name_history')
            .select('puuid, players(game_name, tag_line, server, profile_icon_id, tier)')
            .ilike('old_game_name', riotName.trim())
            .ilike('old_tag_line', riotTag.trim())
            .limit(1)
            .maybeSingle()
          if (oldData?.players) {
            const p = oldData.players as unknown as Record<string, unknown>
            router.replace(`/players/${encodeURIComponent(`${p.game_name}#${p.tag_line}`)}`)
          } else {
            setNotInDb(true)
            setLoadingMatches(false)
          }
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── PUUID → info completa
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedPuuid])

  // ── Auth + watched
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedPuuid])

  // ── Fetches agregados
  useEffect(() => {
    if (!resolvedPuuid) return
    loadHistory(resolvedPuuid, 0)

    const p = encodeURIComponent(resolvedPuuid)
    apiFetch(`/api/v1/player/frequent-allies?puuid=${p}&min_games=2`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setAllies)
      .catch(() => {})
    apiFetch(`/api/v1/player/nemesis?puuid=${p}&min_games=2`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setNemeses)
      .catch(() => {})
    apiFetch(`/api/v1/player/name-history?puuid=${p}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setNameHistory)
      .catch(() => {})
    apiFetch(`/api/v1/player/recommendations?puuid=${p}&top_n=6&reasons=true`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setRecommendations)
      .catch(() => {})
    apiFetch('/api/v1/player/seasons')
      .then((r) => (r.ok ? r.json() : []))
      .then(setSeasons)
      .catch(() => {})
    apiFetch('/api/v1/stats/patches')
      .then((r) => (r.ok ? r.json() : []))
      .then(setPatchList)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedPuuid])

  // ── Champ stats (filtros)
  useEffect(() => {
    if (!resolvedPuuid) return
    const params = new URLSearchParams({ puuid: resolvedPuuid })
    if (champRole) params.set('role', champRole)
    if (champPatch) params.set('patch', champPatch)
    else if (champSeason) params.set('season', champSeason)
    apiFetch(`/api/v1/player/champion-stats?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setChampStats)
      .catch(() => {})
  }, [resolvedPuuid, champRole, champPatch, champSeason])

  async function loadHistory(puuid: string, startOffset: number) {
    setLoadingMatches(true)
    setMatchError(null)
    try {
      const res = await apiFetch(
        `/api/v1/player/history?puuid=${encodeURIComponent(puuid)}&limit=20&offset=${startOffset}`
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
      const res = await apiFetch(
        `/api/v1/player/history?puuid=${encodeURIComponent(resolvedPuuid)}&limit=${PAGE_SIZE}&offset=${offset}`
      )
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMatches((prev) => [...prev, ...(data.matches ?? [])])
      setHasMore(data.has_more ?? false)
      setOffset((prev) => prev + (data.matches?.length ?? 0))
    } catch {
      /* silencioso */
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleSync() {
    const name = isRiotId ? riotName : playerInfo?.game_name
    const tag = isRiotId ? riotTag : playerInfo?.tag_line
    const server = playerInfo?.server ?? syncServer
    if (!name || !tag) return

    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await apiFetch('/api/v1/player/sync', {
        method: 'POST',
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
      if (!res.ok)
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Erro desconhecido')
      if (isRiotId && data.puuid) {
        router.replace(`/players/${encodeURIComponent(data.puuid)}`)
        return
      }
      const novas = data.novas ?? 0
      setSyncMsg(novas > 0 ? `${novas} nova(s) partida(s) importada(s)` : 'Nenhuma partida nova encontrada')
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
    if (!userId) {
      router.push('/auth')
      return
    }
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
    await supabase
      .from('watched_players')
      .upsert(
        { user_id: userId, puuid: puuidToUse, label: watchLabel || null },
        { onConflict: 'user_id,puuid' }
      )
    setWatched(true)
    setShowLabelInput(false)
    setSavingWatch(false)
  }

  // ── Computed
  const summary = useMemo(() => {
    if (!matches.length) return null
    const wins = matches.filter((m) => m.win).length
    const losses = matches.length - wins
    const avgCspm =
      matches.reduce((acc, m) => acc + (m.cs_per_minute ?? 0), 0) / matches.length
    const avgKda =
      matches.reduce((acc, m) => {
        return acc + (m.deaths === 0 ? m.kills + m.assists : (m.kills + m.assists) / m.deaths)
      }, 0) / matches.length
    const avgKills = matches.reduce((a, m) => a + m.kills, 0) / matches.length
    const avgDeaths = matches.reduce((a, m) => a + m.deaths, 0) / matches.length
    const avgAssists = matches.reduce((a, m) => a + m.assists, 0) / matches.length
    const avgVision =
      matches.reduce((a, m) => a + (m.vision_score ?? 0), 0) / matches.length
    return {
      wins,
      losses,
      winrate: Math.round((wins / matches.length) * 100),
      avgCspm: avgCspm.toFixed(1),
      avgKda: avgKda.toFixed(2),
      avgKills: avgKills.toFixed(1),
      avgDeaths: avgDeaths.toFixed(1),
      avgAssists: avgAssists.toFixed(1),
      avgVision: avgVision.toFixed(0),
    }
  }, [matches])

  const seasonSummary = useMemo(() => {
    if (!champStats.length) return null
    const totalGames = champStats.reduce((acc, c) => acc + c.games, 0)
    const wins = champStats.reduce((acc, c) => acc + c.wins, 0)
    return {
      totalGames,
      wins,
      losses: totalGames - wins,
      winrate: Math.round((wins / totalGames) * 100),
      uniqueChamps: champStats.length,
    }
  }, [champStats])

  // Role distribution a partir das matches carregadas.
  const roleDist = useMemo(() => {
    if (!matches.length) return null
    const counts: Record<Role, number> = {
      TOP: 0, JUNGLE: 0, MIDDLE: 0, BOTTOM: 0, UTILITY: 0,
    }
    for (const m of matches) {
      const r = m.team_position as Role
      if (r && r in counts) counts[r]++
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1
    return {
      TOP: Math.round((counts.TOP / total) * 100),
      JUNGLE: Math.round((counts.JUNGLE / total) * 100),
      MIDDLE: Math.round((counts.MIDDLE / total) * 100),
      BOTTOM: Math.round((counts.BOTTOM / total) * 100),
      UTILITY: Math.round((counts.UTILITY / total) * 100),
    }
  }, [matches])

  // Winrate vector (últimas 20) — pro sparkline
  const wrVector = useMemo(
    () =>
      matches
        .slice(0, 20)
        .reverse()
        .map((_, i, arr) => {
          const wins = arr.slice(0, i + 1).reduce((a, _m, idx) => a + (arr[idx] ? 0 : 0), 0)
          // Winrate cumulativo das matches do perfil (mais recentes → antigas invertidas)
          const partial = arr.slice(0, i + 1)
          const w = partial.filter((_, idx) => matches[idx]?.win).length
          return Math.round((w / partial.length) * 100)
        }),
    [matches]
  )

  const wrSeries = useMemo(() => {
    if (!matches.length) return []
    // Serie de WR cumulativa das últimas 20 partidas (da mais antiga pra mais nova)
    const recent = matches.slice(0, 20)
    const oldestFirst = [...recent].reverse()
    const series: number[] = []
    let w = 0
    oldestFirst.forEach((m, i) => {
      if (m.win) w++
      series.push(Math.round((w / (i + 1)) * 100))
    })
    return series
  }, [matches])

  const winLossResults = useMemo(() => {
    // Últimas 10 partidas: 1=win, 0=loss. Array pra WinLossDots (da antiga pra nova).
    return matches
      .slice(0, 10)
      .reverse()
      .map((m) => (m.win ? 1 : 0)) as Array<0 | 1>
  }, [matches])

  // Perfil do jogador (pra radar) — vem das recomendações.
  const playerRadarAxes = useMemo(() => {
    const labels = ['Agressão', 'Mapa', 'Eficiência', 'Pressão', 'Sobrev.', 'Utilid.', 'Early', 'Consist.']
    const src = recommendations.find((r) => r.player_profile)?.player_profile
    if (!src) return null
    return src.map((v, i) => ({ label: labels[i] ?? '', value: Math.min(1, v / 10) }))
  }, [recommendations])

  const displayName = playerInfo
    ? `${playerInfo.game_name}#${playerInfo.tag_line}`
    : isRiotId
    ? rawParam
    : null

  const profileIconUrl = playerInfo?.profile_icon_id
    ? `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${playerInfo.profile_icon_id}.png`
    : null

  const tierColor = playerInfo?.tier
    ? RANK_COLOR[playerInfo.tier.toUpperCase()] ?? 'var(--m-accent)'
    : 'var(--m-accent)'

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
      <AppHeader active="home" />

      {/* ══════════ Banner ══════════ */}
      <div
        style={{
          position: 'relative',
          borderBottom: '1px solid var(--m-border)',
          background:
            'linear-gradient(180deg, rgb(var(--m-accent-rgb) / 0.1) 0%, transparent 100%), var(--m-bg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -80,
            right: -60,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgb(var(--m-accent-rgb) / 0.18), transparent 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '32px 28px 24px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 16,
              background: 'var(--m-surface-2)',
              border: `2px solid ${tierColor}66`,
              overflow: 'hidden',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {profileIconUrl ? (
              <Image
                src={profileIconUrl}
                alt=""
                width={88}
                height={88}
                unoptimized
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 36,
                  fontWeight: 800,
                  color: tierColor,
                  background: `linear-gradient(135deg, ${tierColor}33, #1a1510)`,
                }}
              >
                {(displayName ?? rawParam).charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Nome + tier */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <h1
                className="font-display"
                style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', wordBreak: 'break-all' }}
              >
                {playerInfo?.game_name ?? (isRiotId ? riotName : rawParam)}
                {playerInfo?.tag_line && (
                  <span style={{ color: 'var(--m-text-dim)', fontWeight: 500 }}>#{playerInfo.tag_line}</span>
                )}
              </h1>
              {playerInfo?.server && (
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: 'var(--m-surface-2)',
                    border: '1px solid var(--m-border-2)',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--m-text-dim)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {playerInfo.server}
                </span>
              )}
            </div>
            {playerInfo?.tier && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 10px 4px 6px',
                  borderRadius: 999,
                  background: 'var(--m-surface-2)',
                  border: '1px solid var(--m-border-2)',
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: `radial-gradient(circle at 30% 30%, ${tierColor}, ${tierColor}88)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#0B0D12',
                  }}
                >
                  ◆
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: tierColor,
                  }}
                >
                  {playerInfo.tier}
                </span>
              </div>
            )}
            {nameHistory.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--m-muted)', marginTop: 6 }}>
                antes: {nameHistory.map((n) => `${n.old_game_name}#${n.old_tag_line}`).join(' → ')}
              </div>
            )}
            {watched && watchLabel && (
              <div style={{ fontSize: 12, color: 'var(--m-accent)', fontWeight: 600, marginTop: 6 }}>
                {watchLabel}
              </div>
            )}
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleToggleWatch}
              disabled={savingWatch}
              className="m-hover-surface"
              style={{
                padding: '9px 14px',
                background: 'var(--m-surface-2)',
                border: '1px solid var(--m-border-2)',
                borderRadius: 10,
                color: 'var(--m-text)',
                fontSize: 12,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: savingWatch ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: savingWatch ? 0.5 : 1,
              }}
            >
              <Icon name="star" size={14} style={{ color: watched ? 'var(--m-accent)' : 'var(--m-text-dim)' }} />
              {watched ? 'Remover' : 'Supervisionar'}
            </button>
            <Link
              href="/chat"
              className="m-hover-accent"
              style={{
                padding: '9px 14px',
                background: 'var(--m-accent)',
                border: 'none',
                borderRadius: 10,
                color: '#1a1510',
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
              }}
            >
              <Icon name="brain" size={14} />
              Analisar com IA
            </Link>
          </div>
        </div>

        {/* Label input + Sync */}
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 28px 20px',
            position: 'relative',
          }}
        >
          {showLabelInput && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                value={watchLabel}
                onChange={(e) => setWatchLabel(e.target.value)}
                placeholder="Apelido (opcional)"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'var(--m-bg)',
                  border: '1px solid var(--m-border-2)',
                  borderRadius: 8,
                  color: 'var(--m-text)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                  maxWidth: 320,
                }}
              />
              <button
                type="button"
                onClick={handleSaveWatch}
                disabled={savingWatch}
                className="m-hover-accent"
                style={{
                  padding: '8px 16px',
                  background: 'var(--m-accent)',
                  color: '#1a1510',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: savingWatch ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: savingWatch ? 0.5 : 1,
                }}
              >
                Salvar
              </button>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              paddingTop: 12,
              borderTop: '1px solid var(--m-border)',
            }}
          >
            {!playerInfo?.server && (
              <select
                value={syncServer}
                onChange={(e) => setSyncServer(e.target.value)}
                style={{
                  padding: '6px 10px',
                  background: 'var(--m-bg)',
                  border: '1px solid var(--m-border-2)',
                  borderRadius: 7,
                  color: 'var(--m-text)',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              >
                {SERVERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing || cooldownLeft > 0 || (!isRiotId && !playerInfo)}
              className="m-hover-surface"
              style={{
                padding: '6px 12px',
                background: 'var(--m-surface-2)',
                border: '1px solid var(--m-border-2)',
                borderRadius: 7,
                color: 'var(--m-text)',
                fontSize: 11,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor:
                  syncing || cooldownLeft > 0 || (!isRiotId && !playerInfo)
                    ? 'not-allowed'
                    : 'pointer',
                fontFamily: 'inherit',
                opacity:
                  syncing || cooldownLeft > 0 || (!isRiotId && !playerInfo) ? 0.55 : 1,
                minWidth: 160,
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  transition: 'transform 0.2s',
                  transform: syncing ? 'rotate(360deg)' : 'none',
                  animation: syncing ? 'm-spin 1s linear infinite' : 'none',
                }}
              >
                <Icon name="compass" size={12} />
              </span>
              {syncing
                ? 'Sincronizando...'
                : cooldownLeft > 0
                ? `${Math.floor(cooldownLeft / 60)}m ${String(cooldownLeft % 60).padStart(2, '0')}s`
                : 'Ver partidas novas'}
            </button>
            {syncMsg && (
              <span
                style={{
                  fontSize: 11,
                  color: syncMsg.startsWith('Erro') ? 'var(--m-red)' : 'var(--m-green)',
                }}
              >
                {syncMsg}
              </span>
            )}
            <span style={{ fontSize: 10, color: 'var(--m-muted)', marginLeft: 'auto', maxWidth: 420 }}>
              O histórico abaixo é o cache do banco. Clique pra puxar as últimas 15 partidas da Riot.
            </span>
          </div>
        </div>
      </div>

      {/* ══════════ Not in DB ══════════ */}
      {notInDb && (
        <div style={{ maxWidth: 1200, margin: '20px auto 0', padding: '0 28px' }}>
          <Card>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                {rawParam} não está no nosso banco ainda
              </div>
              <div style={{ fontSize: 12, color: 'var(--m-text-dim)' }}>
                Escolha o servidor e clique em &quot;Ver partidas novas&quot; acima pra importar o histórico.
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════ Main grid ══════════ */}
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '24px 28px 48px',
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: 20,
        }}
      >
        {/* ─── LEFT COL ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* KPI row */}
          {summary && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              <Card>
                <SectionLabel icon="target">Últimas {matches.length}</SectionLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Donut
                    value={summary.winrate}
                    size={84}
                    thickness={9}
                    color="var(--m-accent)"
                    track="rgb(var(--m-accent-rgb) / 0.1)"
                  >
                    <div
                      className="tabular font-display"
                      style={{ fontSize: 20, fontWeight: 700 }}
                    >
                      {summary.winrate}
                      <span style={{ fontSize: 12, color: 'var(--m-text-dim)' }}>%</span>
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: 'var(--m-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      winrate
                    </div>
                  </Donut>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span className="tabular" style={{ color: 'var(--m-green)', fontWeight: 600 }}>
                        {summary.wins}V
                      </span>
                      <span className="tabular" style={{ color: 'var(--m-red)', fontWeight: 600 }}>
                        {summary.losses}D
                      </span>
                    </div>
                    {winLossResults.length > 0 && (
                      <WinLossDots results={winLossResults} size={7} gap={3} />
                    )}
                  </div>
                </div>
              </Card>

              <Card>
                <SectionLabel icon="sword">KDA médio</SectionLabel>
                <div className="tabular font-display" style={{ fontSize: 28, fontWeight: 700 }}>
                  {summary.avgKda}
                </div>
                <div className="tabular" style={{ fontSize: 11, color: 'var(--m-text-dim)', marginTop: 4 }}>
                  <span style={{ color: 'var(--m-green)' }}>{summary.avgKills}</span> /{' '}
                  <span style={{ color: 'var(--m-red)' }}>{summary.avgDeaths}</span> /{' '}
                  <span style={{ color: 'var(--m-cyan)' }}>{summary.avgAssists}</span>
                </div>
              </Card>

              <Card>
                <SectionLabel icon="crosshair">CS / min</SectionLabel>
                <div className="tabular font-display" style={{ fontSize: 28, fontWeight: 700 }}>
                  {summary.avgCspm}
                </div>
                <div style={{ fontSize: 11, color: 'var(--m-text-dim)', marginTop: 4 }}>
                  média por partida
                </div>
                <div style={{ marginTop: 10 }}>
                  <Bar
                    value={Math.min(parseFloat(summary.avgCspm), 10)}
                    max={10}
                    color={
                      parseFloat(summary.avgCspm) >= 8
                        ? 'var(--m-green)'
                        : parseFloat(summary.avgCspm) >= 6
                        ? 'var(--m-accent)'
                        : 'var(--m-red)'
                    }
                    height={4}
                  />
                </div>
              </Card>

              <Card>
                <SectionLabel icon="eye">Score de visão</SectionLabel>
                <div className="tabular font-display" style={{ fontSize: 28, fontWeight: 700 }}>
                  {summary.avgVision}
                </div>
                <div style={{ fontSize: 11, color: 'var(--m-text-dim)', marginTop: 4 }}>
                  média por partida
                </div>
                <div style={{ marginTop: 10 }}>
                  <Bar
                    value={Math.min(parseFloat(summary.avgVision), 60)}
                    max={60}
                    color="var(--m-cyan)"
                    height={4}
                  />
                </div>
              </Card>
            </div>
          )}

          {/* Winrate ao longo das últimas 20 partidas */}
          {wrSeries.length > 2 && (
            <Card>
              <SectionLabel icon="trending">
                Winrate cumulativo · últimas {wrSeries.length} partidas
              </SectionLabel>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <span className="tabular font-display" style={{ fontSize: 32, fontWeight: 700 }}>
                  {wrSeries[wrSeries.length - 1]}
                  <span style={{ fontSize: 14, color: 'var(--m-text-dim)' }}>%</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--m-text-dim)' }}>
                  no fim da janela
                </span>
                <span
                  className="tabular"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    marginLeft: 'auto',
                    color:
                      wrSeries[wrSeries.length - 1] - wrSeries[0] >= 0
                        ? 'var(--m-green)'
                        : 'var(--m-red)',
                  }}
                >
                  {wrSeries[wrSeries.length - 1] - wrSeries[0] >= 0 ? '+' : ''}
                  {wrSeries[wrSeries.length - 1] - wrSeries[0]}% vs início
                </span>
              </div>
              <AreaChart data={wrSeries} height={140} color="var(--m-accent)" />
            </Card>
          )}

          {/* Stats por campeão */}
          {resolvedPuuid && (
            <Card pad={0}>
              <div style={{ padding: '16px 20px 12px' }}>
                <SectionLabel
                  icon="gamepad"
                  right={
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <select
                        value={champSeason}
                        onChange={(e) => {
                          setChampSeason(e.target.value)
                          setChampPatch('')
                        }}
                        style={{
                          padding: '4px 8px',
                          background: 'var(--m-bg)',
                          border: '1px solid var(--m-border-2)',
                          borderRadius: 6,
                          color: 'var(--m-text)',
                          fontSize: 10,
                          fontFamily: 'inherit',
                          outline: 'none',
                        }}
                      >
                        <option value="">Geral</option>
                        {seasons.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <select
                        value={champPatch}
                        onChange={(e) => {
                          setChampPatch(e.target.value)
                          if (e.target.value) setChampSeason('')
                        }}
                        style={{
                          padding: '4px 8px',
                          background: 'var(--m-bg)',
                          border: '1px solid var(--m-border-2)',
                          borderRadius: 6,
                          color: 'var(--m-text)',
                          fontSize: 10,
                          fontFamily: 'inherit',
                          outline: 'none',
                        }}
                      >
                        <option value="">Patch</option>
                        {patchList.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <select
                        value={champRole}
                        onChange={(e) => setChampRole(e.target.value)}
                        style={{
                          padding: '4px 8px',
                          background: 'var(--m-bg)',
                          border: '1px solid var(--m-border-2)',
                          borderRadius: 6,
                          color: 'var(--m-text)',
                          fontSize: 10,
                          fontFamily: 'inherit',
                          outline: 'none',
                        }}
                      >
                        <option value="">Role</option>
                        <option value="TOP">Top</option>
                        <option value="JUNGLE">Jungle</option>
                        <option value="MIDDLE">Mid</option>
                        <option value="BOTTOM">ADC</option>
                        <option value="UTILITY">Sup</option>
                      </select>
                    </div>
                  }
                >
                  Campeões jogados
                </SectionLabel>
              </div>
              {champStats.length === 0 ? (
                <div
                  style={{
                    padding: '24px 20px',
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'var(--m-text-dim)',
                  }}
                >
                  Sem dados pros filtros selecionados.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 60px 90px 80px 80px',
                      gap: 8,
                      padding: '6px 20px',
                      fontSize: 10,
                      color: 'var(--m-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      fontWeight: 600,
                      borderTop: '1px solid var(--m-border)',
                      borderBottom: '1px solid var(--m-border)',
                    }}
                  >
                    <span>Campeão</span>
                    <span className="tabular">Jogos</span>
                    <span>WR</span>
                    <span className="tabular">KDA</span>
                    <span className="tabular">CS/m</span>
                  </div>
                  {champStats.slice(0, showAllChamps ? undefined : 5).map((c) => {
                    const kda =
                      c.avg_deaths > 0
                        ? ((c.avg_kills + c.avg_assists) / c.avg_deaths).toFixed(2)
                        : '∞'
                    return (
                      <Link
                        key={c.champion}
                        href={`/champions/${encodeURIComponent(c.champion)}`}
                        className="m-hover-row"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 60px 90px 80px 80px',
                          gap: 8,
                          padding: '10px 20px',
                          alignItems: 'center',
                          borderBottom: '1px solid rgba(34,40,56,0.4)',
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <ChampPortrait name={c.champion} size={32} />
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{c.champion}</span>
                        </div>
                        <span className="tabular" style={{ fontSize: 13, fontWeight: 600 }}>
                          {c.games}
                        </span>
                        <div>
                          <div
                            className="tabular"
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color:
                                c.winrate > 55
                                  ? 'var(--m-green)'
                                  : c.winrate > 45
                                  ? 'var(--m-text)'
                                  : 'var(--m-red)',
                            }}
                          >
                            {c.winrate.toFixed(0)}%
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--m-text-dim)' }}>
                            {c.wins}V {c.games - c.wins}D
                          </div>
                        </div>
                        <span className="tabular" style={{ fontSize: 12, color: 'var(--m-text-dim)' }}>
                          {kda}
                        </span>
                        <span className="tabular" style={{ fontSize: 12, color: 'var(--m-text-dim)' }}>
                          {c.avg_cs_per_minute?.toFixed(1) ?? '—'}
                        </span>
                      </Link>
                    )
                  })}
                  {champStats.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllChamps((v) => !v)}
                      className="m-hover-surface"
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'transparent',
                        border: 'none',
                        borderTop: '1px solid var(--m-border)',
                        color: 'var(--m-text-dim)',
                        fontSize: 11,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {showAllChamps ? 'Mostrar menos' : `Ver todos (${champStats.length})`}
                    </button>
                  )}
                </>
              )}
            </Card>
          )}

          {/* Recomendações */}
          {recommendations.length > 0 && (
            <Card pad={0}>
              <div style={{ padding: '16px 20px 12px' }}>
                <SectionLabel icon="sparkles">Recomendados pra você</SectionLabel>
              </div>
              {recommendations.map((r, i) => {
                const key = `${r.champion}-${r.role}`
                const expanded = selectedRec === key
                return (
                  <div key={key}>
                    <button
                      type="button"
                      onClick={() => setSelectedRec(expanded ? null : key)}
                      className="m-hover-row"
                      style={{
                        width: '100%',
                        display: 'grid',
                        gridTemplateColumns: '36px 1fr 80px 80px',
                        gap: 12,
                        padding: '10px 20px',
                        alignItems: 'center',
                        background: 'transparent',
                        border: 'none',
                        borderTop: i ? '1px solid rgba(34,40,56,0.4)' : 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        textAlign: 'left',
                      }}
                    >
                      <ChampPortrait name={r.champion} size={32} role={r.role as Role} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {r.champion}{' '}
                          <span
                            style={{
                              fontSize: 9,
                              padding: '1px 5px',
                              background: 'var(--m-surface-2)',
                              borderRadius: 3,
                              color: 'var(--m-text-dim)',
                              marginLeft: 4,
                            }}
                          >
                            {r.role_label}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--m-text-dim)', marginTop: 2 }}>
                          {r.winrate.toFixed(0)}% WR · {r.games_in_db}j
                          {r.times_played > 0 && ` · jogou ${r.times_played}×`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          className="tabular"
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color:
                              r.confidence >= 80
                                ? 'var(--m-green)'
                                : r.confidence >= 60
                                ? 'var(--m-accent)'
                                : r.confidence >= 40
                                ? 'var(--m-orange)'
                                : 'var(--m-text-dim)',
                          }}
                        >
                          {r.confidence.toFixed(0)}%
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--m-muted)' }}>match</div>
                      </div>
                      <Icon
                        name={expanded ? 'chevronUp' : 'chevronDown'}
                        size={14}
                        style={{ color: 'var(--m-text-dim)', justifySelf: 'end' }}
                      />
                    </button>
                    {expanded && r.player_profile && r.champion_profile && (
                      <div
                        style={{
                          padding: '12px 20px 16px',
                          borderTop: '1px solid rgba(34,40,56,0.4)',
                          background: 'var(--m-bg)',
                        }}
                      >
                        <DualRadar
                          playerProfile={r.player_profile}
                          championProfile={r.champion_profile}
                        />
                        {r.reasons && r.reasons.length > 0 && (
                          <div
                            style={{
                              fontSize: 10,
                              color: 'var(--m-accent)',
                              textAlign: 'center',
                              marginTop: 8,
                            }}
                          >
                            {r.reasons.join(' · ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              <div
                style={{
                  padding: '10px',
                  textAlign: 'center',
                  fontSize: 10,
                  color: 'var(--m-muted)',
                  borderTop: '1px solid var(--m-border)',
                }}
              >
                8 dimensões · similaridade de cosseno + distância euclidiana
              </div>
            </Card>
          )}

          {/* Match history */}
          <Card pad={0}>
            <div
              style={{
                padding: '16px 20px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <SectionLabel icon="clock">Últimas partidas</SectionLabel>
              <Pill color="accent" icon="shield" active>
                SoloQ / Flex
              </Pill>
            </div>
            {loadingMatches ? (
              <div
                style={{
                  padding: '40px 20px',
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--m-accent)',
                      animation: 'm-bounce 1.4s infinite ease-in-out both',
                      animationDelay: `${d}ms`,
                    }}
                  />
                ))}
              </div>
            ) : matchError ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--m-text-dim)',
                }}
              >
                {matchError}
              </div>
            ) : matches.length === 0 ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--m-text-dim)',
                }}
              >
                Nenhuma partida ranqueada encontrada no banco. Clique em &quot;Ver partidas novas&quot; pra importar.
              </div>
            ) : (
              <>
                {matches.map((m, i) => (
                  <MatchRow
                    key={m.matches?.match_id ?? i}
                    m={m}
                    puuid={resolvedPuuid!}
                  />
                ))}
                {hasMore && (
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="m-hover-surface"
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'transparent',
                      border: 'none',
                      borderTop: '1px solid var(--m-border)',
                      color: 'var(--m-text-dim)',
                      fontSize: 12,
                      cursor: loadingMore ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      opacity: loadingMore ? 0.5 : 1,
                    }}
                  >
                    {loadingMore ? (
                      <>
                        {[0, 150, 300].map((d) => (
                          <span
                            key={d}
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              background: 'var(--m-accent)',
                              animation: 'm-bounce 1.4s infinite ease-in-out both',
                              animationDelay: `${d}ms`,
                            }}
                          />
                        ))}
                      </>
                    ) : (
                      <>
                        <Icon name="chevronDown" size={12} />
                        Carregar mais partidas
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </Card>
        </div>

        {/* ─── RIGHT COL ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Season summary */}
          {seasonSummary && (
            <Card>
              <SectionLabel icon="medal">Temporada</SectionLabel>
              <div className="tabular font-display" style={{ fontSize: 26, fontWeight: 700 }}>
                {seasonSummary.totalGames}
                <span style={{ fontSize: 12, color: 'var(--m-text-dim)', fontWeight: 500 }}>
                  {' '}partidas
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                <span
                  className="tabular"
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color:
                      seasonSummary.winrate >= 55
                        ? 'var(--m-green)'
                        : seasonSummary.winrate >= 50
                        ? 'var(--m-accent)'
                        : 'var(--m-red)',
                  }}
                >
                  {seasonSummary.winrate}%
                </span>
                <span style={{ fontSize: 11, color: 'var(--m-text-dim)' }}>
                  {seasonSummary.wins}V {seasonSummary.losses}D · {seasonSummary.uniqueChamps} campeões
                </span>
              </div>
            </Card>
          )}

          {/* Role distribution */}
          {roleDist && (
            <Card>
              <SectionLabel icon="pieChart">Roles · {matches.length} partidas</SectionLabel>
              <div style={{ marginTop: 6, marginBottom: 12 }}>
                <StackedBar
                  segments={[
                    { label: 'Top', value: roleDist.TOP, color: 'var(--m-violet)' },
                    { label: 'Jungle', value: roleDist.JUNGLE, color: 'var(--m-accent)' },
                    { label: 'Mid', value: roleDist.MIDDLE, color: 'var(--m-cyan)' },
                    { label: 'ADC', value: roleDist.BOTTOM, color: 'var(--m-pink)' },
                    { label: 'Sup', value: roleDist.UTILITY, color: 'var(--m-green)' },
                  ]}
                  height={10}
                  radius={5}
                />
              </div>
              {(
                [
                  { label: 'Top', value: roleDist.TOP, color: 'var(--m-violet)', role: 'TOP' },
                  { label: 'Jungle', value: roleDist.JUNGLE, color: 'var(--m-accent)', role: 'JUNGLE' },
                  { label: 'Mid', value: roleDist.MIDDLE, color: 'var(--m-cyan)', role: 'MIDDLE' },
                  { label: 'ADC', value: roleDist.BOTTOM, color: 'var(--m-pink)', role: 'BOTTOM' },
                  { label: 'Sup', value: roleDist.UTILITY, color: 'var(--m-green)', role: 'UTILITY' },
                ] as const
              ).map((s) => (
                <div
                  key={s.label}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}
                >
                  <Image
                    src={roleIconPath(s.role)}
                    alt=""
                    width={14}
                    height={14}
                    unoptimized
                    style={{ objectFit: 'contain', opacity: 0.8 }}
                  />
                  <span style={{ fontSize: 12, flex: 1 }}>{s.label}</span>
                  <span
                    className="tabular"
                    style={{ fontSize: 12, fontWeight: 600, color: s.value > 0 ? s.color : 'var(--m-muted)' }}
                  >
                    {s.value}%
                  </span>
                </div>
              ))}
            </Card>
          )}

          {/* Player radar (das recomendações) */}
          {playerRadarAxes && (
            <Card>
              <SectionLabel icon="target">Perfil de jogo</SectionLabel>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '4px -10px -10px' }}>
                <DsRadarChart size={220} color="var(--m-accent)" axes={playerRadarAxes} />
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--m-muted)',
                  textAlign: 'center',
                  padding: '4px 0 0',
                }}
              >
                8 dimensões Neo-Artemis
              </div>
            </Card>
          )}

          {/* Insights teaser */}
          <Card accent>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgb(var(--m-accent-rgb) / 0.15)',
                  color: 'var(--m-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="brain" size={15} />
              </div>
              <div className="font-display" style={{ fontSize: 13, fontWeight: 600 }}>
                Pergunte à Metis
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--m-text-dim)', lineHeight: 1.55 }}>
              A Metis pode analisar suas últimas {matches.length || 'N'} partidas, identificar padrões
              e sugerir o que mudar na próxima ranqueada.
            </p>
            <Link
              href="/chat"
              className="m-hover-accent"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                marginTop: 12,
                padding: '9px 12px',
                background: 'var(--m-accent)',
                border: 'none',
                borderRadius: 8,
                color: '#1a1510',
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <Icon name="messageCircle" size={13} />
              Abrir Chat
            </Link>
          </Card>

          {/* Allies */}
          {allies.length > 0 && (
            <Card pad={0}>
              <div style={{ padding: '16px 20px 12px' }}>
                <SectionLabel icon="users">Jogou com</SectionLabel>
              </div>
              {allies.slice(0, 5).map((a, i) => (
                <Link
                  key={a.puuid}
                  href={`/players/${encodeURIComponent(`${a.game_name}#${a.tag_line}`)}`}
                  className="m-hover-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 20px',
                    borderTop: i ? '1px solid rgba(34,40,56,0.4)' : '1px solid var(--m-border)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'var(--m-surface-2)',
                      border: '1px solid var(--m-border-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--m-text-dim)',
                      flexShrink: 0,
                    }}
                  >
                    {a.game_name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.game_name}#{a.tag_line}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--m-text-dim)', marginTop: 2 }}>
                      {a.games_together}j · {a.wins_together}V {a.games_together - a.wins_together}D
                    </div>
                  </div>
                  <span
                    className="tabular"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color:
                        a.winrate > 55
                          ? 'var(--m-green)'
                          : a.winrate < 45
                          ? 'var(--m-red)'
                          : 'var(--m-text-dim)',
                    }}
                  >
                    {a.winrate}%
                  </span>
                </Link>
              ))}
            </Card>
          )}

          {/* Nemeses */}
          {nemeses.length > 0 && (
            <Card pad={0}>
              <div style={{ padding: '16px 20px 12px' }}>
                <SectionLabel icon="crosshair">Nemesis</SectionLabel>
              </div>
              {nemeses.slice(0, 5).map((n, i) => (
                <Link
                  key={n.puuid}
                  href={`/players/${encodeURIComponent(`${n.game_name}#${n.tag_line}`)}`}
                  className="m-hover-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 20px',
                    borderTop: i ? '1px solid rgba(34,40,56,0.4)' : '1px solid var(--m-border)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'rgba(248,113,113,0.1)',
                      border: '1px solid rgba(248,113,113,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--m-red)',
                      flexShrink: 0,
                    }}
                  >
                    {n.game_name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {n.game_name}#{n.tag_line}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--m-text-dim)', marginTop: 2 }}>
                      {n.times_faced}× · {n.champions_used.slice(0, 3).join(', ')}
                    </div>
                  </div>
                  <span
                    className="tabular"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color:
                        n.winrate_against > 55
                          ? 'var(--m-green)'
                          : n.winrate_against < 45
                          ? 'var(--m-red)'
                          : 'var(--m-text-dim)',
                    }}
                  >
                    {n.winrate_against}%
                  </span>
                </Link>
              ))}
            </Card>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes m-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        @keyframes m-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ── Inline MatchRow ───────────────────────────────────────────────
function MatchRow({ m, puuid }: { m: MatchData; puuid: string }) {
  const dur = formatDuration(m.matches?.game_duration ?? 0)
  const when = formatRelativeDate(m.matches?.game_end_timestamp ?? null)
  const mode = m.matches?.queue_id === 440 ? 'Flex' : 'Ranked Solo'
  const items = (m.items ?? []).filter((id) => id && id > 0).slice(0, 6)

  return (
    <Link
      href={`/matches/${encodeURIComponent(m.matches?.match_id ?? '')}?as=${encodeURIComponent(puuid)}`}
      className="m-hover-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '4px 44px 1fr 220px 110px 80px 70px',
        gap: 14,
        padding: '14px 20px',
        alignItems: 'center',
        borderTop: '1px solid rgba(34,40,56,0.4)',
        background: m.win
          ? 'linear-gradient(90deg, rgba(74,222,128,0.05), transparent 30%)'
          : 'linear-gradient(90deg, rgba(248,113,113,0.05), transparent 30%)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          width: 4,
          height: 44,
          borderRadius: 2,
          background: m.win ? 'var(--m-green)' : 'var(--m-red)',
        }}
      />
      <ChampPortrait
        name={m.champion_name}
        size={44}
        role={m.team_position as Role | undefined}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: m.win ? 'var(--m-green)' : 'var(--m-red)',
            }}
          >
            {m.win ? 'Vitória' : 'Derrota'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--m-text-dim)' }}>· {mode}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--m-muted)', marginTop: 2 }}>
          {when} · {dur} · {m.team_position && ROLES_PT[m.team_position as Role] ? ROLES_PT[m.team_position as Role] : m.team_position}
        </div>
      </div>
      {/* Items */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {items.length === 0
          ? Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  background: 'var(--m-surface-2)',
                  border: '1px solid var(--m-border-2)',
                }}
              />
            ))
          : items.map((id, i) => (
              <div
                key={i}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  background: 'var(--m-surface-2)',
                  border: '1px solid var(--m-border-2)',
                  backgroundImage: `url(https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${id}.png)`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            ))}
      </div>
      <div>
        <div className="tabular" style={{ fontSize: 13, fontWeight: 600 }}>
          <span>{m.kills}</span>
          <span style={{ color: 'var(--m-muted)' }}> / </span>
          <span style={{ color: 'var(--m-red)' }}>{m.deaths}</span>
          <span style={{ color: 'var(--m-muted)' }}> / </span>
          <span>{m.assists}</span>
        </div>
        {m.kill_participation != null && (
          <div className="tabular" style={{ fontSize: 10, color: 'var(--m-text-dim)', marginTop: 2 }}>
            {Math.round((m.kill_participation ?? 0) * 100)}% KP
          </div>
        )}
      </div>
      <div>
        <div className="tabular" style={{ fontSize: 12, fontWeight: 500 }}>
          {m.total_cs ?? 0} CS
        </div>
        <div className="tabular" style={{ fontSize: 10, color: 'var(--m-text-dim)', marginTop: 2 }}>
          {m.cs_per_minute?.toFixed(1) ?? '—'} /min
        </div>
      </div>
      <span
        className="tabular"
        style={{ fontSize: 11, color: 'var(--m-text-dim)', justifySelf: 'end' }}
      >
        {m.champion_level ? `lvl ${m.champion_level}` : '—'}
      </span>
    </Link>
  )
}

// ── DualRadar (usado nas recomendações expandidas) ──────────────
function DualRadar({
  playerProfile,
  championProfile,
}: {
  playerProfile: number[]
  championProfile: number[]
}) {
  const labels = ['AGR', 'MAP', 'EFC', 'PRS', 'SBV', 'UTL', 'ERL', 'CST']
  const n = labels.length
  const cx = 100
  const cy = 100
  const r = 78

  function point(idx: number, val: number): [number, number] {
    const angle = ((2 * Math.PI) / n) * idx - Math.PI / 2
    const dist = Math.min(1, val / 10) * r
    return [cx + dist * Math.cos(angle), cy + dist * Math.sin(angle)]
  }

  const polygonPts = (vs: number[]) => vs.map((v, i) => point(i, v).join(',')).join(' ')
  const rings = [2.5, 5, 7.5, 10]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg viewBox="0 0 200 200" width={200} height={200}>
        {rings.map((rv) => (
          <polygon
            key={rv}
            points={Array.from({ length: n }, (_, i) => point(i, rv).join(',')).join(' ')}
            fill="none"
            stroke="var(--m-border)"
            strokeWidth="0.8"
            opacity="0.4"
          />
        ))}
        {labels.map((_, i) => {
          const [x, y] = point(i, 10)
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="var(--m-border)"
              strokeWidth="0.6"
              opacity="0.3"
            />
          )
        })}
        <polygon
          points={polygonPts(championProfile)}
          fill="rgba(251,191,36,0.18)"
          stroke="rgba(251,191,36,0.85)"
          strokeWidth="1.5"
        />
        <polygon
          points={polygonPts(playerProfile)}
          fill="rgb(var(--m-accent-rgb) / 0.2)"
          stroke="var(--m-accent)"
          strokeWidth="1.5"
        />
        {labels.map((l, i) => {
          const [x, y] = point(i, 11.5)
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              fill="var(--m-text-dim)"
              fontWeight="600"
              style={{ letterSpacing: '0.06em' }}
            >
              {l}
            </text>
          )
        })}
      </svg>
      <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'var(--m-text-dim)', marginTop: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 2, background: 'var(--m-accent)' }} />
          Você
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 2, background: 'rgb(251,191,36)' }} />
          Campeão
        </span>
      </div>
    </div>
  )
}
