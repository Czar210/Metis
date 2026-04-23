'use client'

import { useId, useState } from 'react'

export type DualRadarAxis = {
  label: string
  /** Valor do jogador, escala 0..10. Backend envia nessa escala hoje. */
  player: number
  /** Valor ideal do campeão, mesma escala. */
  ideal: number
}

type Props = {
  axes: DualRadarAxis[]
  size?: number
  /** Baixa confiança (poucas partidas) — desenha player dashed + opacity baixa. */
  confidence?: 'high' | 'low'
  playerLabel: string
  idealLabel: string
  /** Fire ao clicar num vértice/eixo. */
  onAxisClick?: (idx: number, axis: DualRadarAxis) => void
}

/**
 * DualRadar — sobreposição de dois polígonos (player vs ideal do campeão).
 *
 * Spec do HANDOFF-TECNICO.md seção 2.2:
 *   - player: preenchido com opacity 0.25, stroke sólida 2px, dots 3px
 *   - ideal: só outline, stroke tracejado (3 3), opacity 0.7, sem fill
 *   - legenda: 2 dots coloridos + labels
 */
export function DualRadar({
  axes,
  size = 200,
  confidence = 'high',
  playerLabel,
  idealLabel,
  onAxisClick,
}: Props) {
  const [hovered, setHovered] = useState<number | null>(null)
  const uid = useId()
  const n = axes.length
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.39
  const MAX = 10

  function point(idx: number, val: number): [number, number] {
    const angle = -Math.PI / 2 + ((2 * Math.PI) / n) * idx
    const dist = Math.min(1, val / MAX) * r
    return [cx + dist * Math.cos(angle), cy + dist * Math.sin(angle)]
  }

  const polyStr = (vs: number[]) => vs.map((v, i) => point(i, v).join(',')).join(' ')

  const rings = [0.25, 0.5, 0.75, 1]
  const lowConfidence = confidence === 'low'

  const playerPts = axes.map((a) => a.player)
  const idealPts = axes.map((a) => a.ideal)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: size + 40, maxWidth: '100%' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={playerLabel}>
          {/* Grid radial */}
          {rings.map((ratio, i) => (
            <polygon
              key={ratio}
              points={Array.from({ length: n }, (_, j) => point(j, ratio * MAX).join(',')).join(' ')}
              fill="none"
              stroke="var(--m-border)"
              strokeWidth="1"
              opacity={i === rings.length - 1 ? 0.7 : 0.35}
            />
          ))}
          {/* Raios */}
          {axes.map((_, i) => {
            const [x, y] = point(i, MAX)
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="var(--m-border)"
                strokeWidth="1"
                opacity="0.25"
              />
            )
          })}

          {/* Ideal: outline dashed (spec) */}
          <polygon
            points={polyStr(idealPts)}
            fill="none"
            stroke="rgb(251,191,36)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.7"
          />

          {/* Player: preenchido */}
          <polygon
            points={polyStr(playerPts)}
            fill="rgb(var(--m-accent-rgb) / 0.25)"
            stroke="var(--m-accent)"
            strokeWidth={lowConfidence ? 1.5 : 2}
            strokeDasharray={lowConfidence ? '4 3' : undefined}
            opacity={lowConfidence ? 0.5 : 1}
          />

          {/* Dots nos vértices do player */}
          {axes.map((a, i) => {
            const [x, y] = point(i, a.player)
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={hovered === i ? 4.5 : 3}
                fill="var(--m-accent)"
                opacity={lowConfidence ? 0.6 : 1}
              />
            )
          })}

          {/* Labels + hit-area transparente pra hover/click */}
          {axes.map((a, i) => {
            const [labelX, labelY] = point(i, MAX * 1.18)
            const [vertexX, vertexY] = point(i, MAX)
            return (
              <g key={i}>
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="9"
                  fill={hovered === i ? 'var(--m-accent)' : 'var(--m-text-dim)'}
                  fontWeight="600"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.06em', pointerEvents: 'none', userSelect: 'none' }}
                >
                  {a.label}
                </text>
                {/* Hit area — invisível, cobre do centro até fora do label */}
                <polygon
                  points={buildWedge(cx, cy, i, n, r * 1.3)}
                  fill="transparent"
                  style={{ cursor: onAxisClick ? 'pointer' : 'default' }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
                  onClick={() => onAxisClick?.(i, a)}
                  aria-label={`${a.label}: player ${a.player.toFixed(1)}, ideal ${a.ideal.toFixed(1)}`}
                />
                {/* Tooltip */}
                {hovered === i && (
                  <foreignObject
                    x={labelX - 60}
                    y={Math.max(labelY - 52, 0)}
                    width={120}
                    height={48}
                    style={{ pointerEvents: 'none' }}
                  >
                    <div
                      style={{
                        background: 'var(--m-surface-2)',
                        border: '1px solid var(--m-border-2)',
                        borderRadius: 6,
                        padding: '6px 8px',
                        fontSize: 10,
                        lineHeight: 1.35,
                        color: 'var(--m-text)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: 'var(--m-accent)', letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 9 }}>
                        {a.label}
                      </div>
                      <div className="tabular" style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 2 }}>
                        <span style={{ color: 'var(--m-accent)' }}>{a.player.toFixed(1)}</span>
                        <span style={{ color: 'var(--m-muted)' }}>/</span>
                        <span style={{ color: 'rgb(251,191,36)' }}>{a.ideal.toFixed(1)}</span>
                      </div>
                    </div>
                  </foreignObject>
                )}
                {/* Vertex key pra screen reader */}
                <title id={`${uid}-axis-${i}`}>{`${a.label}: ${a.player.toFixed(1)} / ${a.ideal.toFixed(1)}`}</title>
                <circle cx={vertexX} cy={vertexY} r="0" />
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'var(--m-text-dim)', marginTop: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 2, background: 'var(--m-accent)' }} />
          {playerLabel}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 10, height: 0, borderTop: '2px dashed rgb(251,191,36)',
          }} />
          {idealLabel}
        </span>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────

/**
 * Constrói um "wedge" (fatia de pizza) SVG polygon pra área de hover/click
 * de um eixo. Divide o círculo em N fatias centradas no eixo i.
 */
function buildWedge(cx: number, cy: number, i: number, n: number, radius: number): string {
  const step = (2 * Math.PI) / n
  const mid = -Math.PI / 2 + i * step
  const start = mid - step / 2
  const end = mid + step / 2
  const x1 = cx + Math.cos(start) * radius
  const y1 = cy + Math.sin(start) * radius
  const x2 = cx + Math.cos(end) * radius
  const y2 = cy + Math.sin(end) * radius
  return `${cx},${cy} ${x1},${y1} ${x2},${y2}`
}
