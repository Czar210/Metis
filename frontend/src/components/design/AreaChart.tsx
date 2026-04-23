type Props = {
  data: number[]
  width?: number
  height?: number
  color?: string
  grid?: boolean
}

export function AreaChart({
  data,
  width = 480,
  height = 140,
  color = 'var(--m-accent)',
  grid = true,
}: Props) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padX = 0
  const padY = 8
  const pts = data.map<[number, number]>((v, i) => {
    const x = padX + (i / (data.length - 1)) * (width - padX * 2)
    const y = padY + (1 - (v - min) / range) * (height - padY * 2)
    return [x, y]
  })
  const path = pts
    .map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1))
    .join(' ')
  const area = path + ` L ${width - padX} ${height} L ${padX} ${height} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', width: '100%' }}
    >
      <defs>
        <linearGradient id="metis-area-gr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid &&
        [0.25, 0.5, 0.75].map((t, i) => (
          <line
            key={i}
            x1={0}
            x2={width}
            y1={height * t}
            y2={height * t}
            stroke="var(--m-border)"
            strokeDasharray="2 4"
          />
        ))}
      <path d={area} fill="url(#metis-area-gr)" />
      <path
        d={path}
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r="2.5"
          fill="var(--m-bg)"
          stroke={color}
          strokeWidth="1.5"
        />
      ))}
    </svg>
  )
}
