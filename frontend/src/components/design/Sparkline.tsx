type Props = {
  data: number[]
  width?: number
  height?: number
  color?: string
  fill?: boolean
  strokeW?: number
}

export function Sparkline({
  data,
  width = 120,
  height = 36,
  color = 'var(--m-accent)',
  fill = true,
  strokeW = 2,
}: Props) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map<[number, number]>((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return [x, y]
  })
  const path = pts
    .map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1))
    .join(' ')
  const area = path + ` L ${width} ${height} L 0 ${height} Z`

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {fill && (
        <>
          <defs>
            <linearGradient id="metis-spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#metis-spark-fill)" />
        </>
      )}
      <path
        d={path}
        stroke={color}
        strokeWidth={strokeW}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
