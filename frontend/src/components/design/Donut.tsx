import type { ReactNode } from 'react'

type Props = {
  value: number
  max?: number
  size?: number
  thickness?: number
  color?: string
  track?: string
  children?: ReactNode
}

export function Donut({
  value,
  max = 100,
  size = 120,
  thickness = 10,
  color = 'var(--m-accent)',
  track = 'var(--m-border)',
  children,
}: Props) {
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(1, Math.max(0, value / max))
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={track}
          strokeWidth={thickness}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={thickness}
          fill="none"
          strokeDasharray={`${circ * pct} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray .5s' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  )
}
