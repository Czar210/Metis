'use client'

import { useState, useMemo } from 'react'

// ── Tipos ─────────────────────────────────────────────────────

type Frame = {
  t_min: number
  t_ms: number
  p: Record<string, { cs: number; cspm: number; gold: number; level: number; xp: number }>
}

type TLParticipant = {
  puuid: string
  team_id: number
  champion_name: string
  players: { game_name: string; tag_line: string } | null
}

type Metric = 'cspm' | 'gold' | 'xp'

const METRIC_LABELS: Record<Metric, string> = {
  cspm: 'CS/m',
  gold: 'Ouro',
  xp:   'XP',
}

// ── Paletas por time ──────────────────────────────────────────

const BLUE_COLORS = ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8']
const RED_COLORS  = ['#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c']

// ── SVG layout ────────────────────────────────────────────────

const W         = 600
const H         = 190
const PAD_L     = 42
const PAD_R     = 12
const PAD_T     = 12
const PAD_B     = 22
const CHART_W   = W - PAD_L - PAD_R
const CHART_H   = H - PAD_T - PAD_B

// ── Componente ────────────────────────────────────────────────

export function TimelineChart({
  frames,
  participants,
  highlightedPuuid,
}: {
  frames: Frame[]
  participants: TLParticipant[]
  highlightedPuuid: string | null
}) {
  const [metric, setMetric] = useState<Metric>('gold')

  // Cor por PUUID
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {}
    const blue = participants.filter(p => p.team_id === 100)
    const red  = participants.filter(p => p.team_id === 200)
    blue.forEach((p, i) => { map[p.puuid] = BLUE_COLORS[i % BLUE_COLORS.length] })
    red.forEach ((p, i) => { map[p.puuid] = RED_COLORS [i % RED_COLORS.length]  })
    return map
  }, [participants])

  // Séries: array de pontos por participante
  const series = useMemo(() => {
    return participants.map(p => ({
      puuid: p.puuid,
      points: frames
        .filter(f => f.p[p.puuid] !== undefined)
        .map(f => ({ min: f.t_min, value: f.p[p.puuid][metric] })),
    }))
  }, [frames, participants, metric])

  // Escalas
  const maxMin = Math.max(...frames.map(f => f.t_min), 1)
  const maxVal = Math.max(...series.flatMap(s => s.points.map(pt => pt.value)), 1)

  const xScale = (min: number)  => PAD_L + (min / maxMin) * CHART_W
  const yScale = (val: number)  => PAD_T + CHART_H - (val / maxVal) * CHART_H

  // Grid horizontal (4 linhas)
  const gridRatios = [0.25, 0.5, 0.75, 1]
  const gridLines = gridRatios.map(r => ({
    y: PAD_T + CHART_H - r * CHART_H,
    label: metric === 'gold'
      ? `${(maxVal * r / 1000).toFixed(1)}k`
      : metric === 'xp'
        ? `${Math.round(maxVal * r / 1000)}k`
        : (maxVal * r).toFixed(1),
  }))

  // Labels do eixo X
  const step = maxMin > 30 ? 10 : maxMin > 15 ? 5 : 3
  const xLabels: number[] = []
  for (let m = 0; m <= maxMin; m += step) xLabels.push(m)

  return (
    <div className="space-y-3">

      {/* Tabs de métrica */}
      <div className="flex gap-1.5">
        {(Object.keys(METRIC_LABELS) as Metric[]).map(m => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`text-[11px] px-3 py-1 rounded-md transition-colors font-medium ${
              metric === m
                ? 'bg-metis-accent text-white'
                : 'text-metis-text-dim hover:text-metis-text bg-metis-bg border border-metis-border'
            }`}
          >
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      {/* SVG */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="overflow-visible"
        aria-label={`Timeline de ${METRIC_LABELS[metric]}`}
      >
        {/* Grid horizontal */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD_L} y1={g.y} x2={W - PAD_R} y2={g.y}
              stroke="#1e2533" strokeWidth={0.5} strokeDasharray="3 3"
            />
            <text
              x={PAD_L - 5} y={g.y + 3.5}
              textAnchor="end" fill="#8892a4" fontSize={7.5}
            >
              {g.label}
            </text>
          </g>
        ))}

        {/* Labels do eixo X */}
        {xLabels.map(m => (
          <text
            key={m}
            x={xScale(m)} y={H - 5}
            textAnchor="middle" fill="#8892a4" fontSize={7.5}
          >
            {m}&apos;
          </text>
        ))}

        {/* Linhas — não-destacadas primeiro (fundo) */}
        {series
          .filter(s => s.puuid !== highlightedPuuid && s.points.length > 1)
          .map(s => (
            <polyline
              key={s.puuid}
              points={s.points.map(pt => `${xScale(pt.min)},${yScale(pt.value)}`).join(' ')}
              fill="none"
              stroke={colorMap[s.puuid] ?? '#4f8ef7'}
              strokeWidth={1}
              strokeOpacity={0.45}
              strokeLinejoin="round"
            />
          ))}

        {/* Linha destacada por cima */}
        {highlightedPuuid && (() => {
          const s = series.find(s => s.puuid === highlightedPuuid)
          if (!s || s.points.length < 2) return null
          return (
            <polyline
              points={s.points.map(pt => `${xScale(pt.min)},${yScale(pt.value)}`).join(' ')}
              fill="none"
              stroke={colorMap[highlightedPuuid] ?? '#fff'}
              strokeWidth={2.5}
              strokeOpacity={1}
              strokeLinejoin="round"
            />
          )
        })()}

        {/* Eixos */}
        <line
          x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + CHART_H}
          stroke="#1e2533" strokeWidth={1}
        />
        <line
          x1={PAD_L} y1={PAD_T + CHART_H} x2={W - PAD_R} y2={PAD_T + CHART_H}
          stroke="#1e2533" strokeWidth={1}
        />
      </svg>

      {/* Legenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
        {participants.map(p => {
          const name = p.players
            ? `${p.players.game_name}#${p.players.tag_line}`
            : p.champion_name
          const isHL = p.puuid === highlightedPuuid
          return (
            <div key={p.puuid} className="flex items-center gap-1.5">
              <div
                style={{
                  width: 14,
                  height: isHL ? 3 : 2,
                  borderRadius: 2,
                  backgroundColor: colorMap[p.puuid] ?? '#8892a4',
                  opacity: isHL ? 1 : 0.55,
                }}
              />
              <span className={`text-[9px] ${isHL ? 'text-metis-text font-semibold' : 'text-metis-text-dim'}`}>
                {name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
