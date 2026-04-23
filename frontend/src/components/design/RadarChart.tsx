export type RadarAxis = {
  label: string
  /** 0..1 */
  value: number
}

type Props = {
  axes: RadarAxis[]
  size?: number
  color?: string
}

export function RadarChart({ axes, size = 200, color = 'var(--m-accent)' }: Props) {
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38
  const n = axes.length
  const ptAt = (i: number, ratio: number): [number, number] => {
    const ang = -Math.PI / 2 + (i / n) * Math.PI * 2
    return [cx + Math.cos(ang) * r * ratio, cy + Math.sin(ang) * r * ratio]
  }
  const grid = [0.25, 0.5, 0.75, 1]
  const poly = axes.map((a, i) => ptAt(i, a.value).join(',')).join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {grid.map((g, i) => (
        <polygon
          key={i}
          points={Array.from({ length: n }, (_, j) => ptAt(j, g).join(',')).join(' ')}
          fill="none"
          stroke="var(--m-border)"
          strokeWidth="1"
          opacity={i === grid.length - 1 ? 0.8 : 0.4}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = ptAt(i, 1)
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--m-border)"
            strokeWidth="1"
            opacity="0.3"
          />
        )
      })}
      <polygon
        points={poly}
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeWidth="1.5"
      />
      {axes.map((a, i) => {
        const [x, y] = ptAt(i, a.value)
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />
      })}
      {axes.map((a, i) => {
        const [x, y] = ptAt(i, 1.16)
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9"
            fill="var(--m-text-dim)"
            fontWeight="600"
            style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            {a.label}
          </text>
        )
      })}
    </svg>
  )
}
