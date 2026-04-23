export type StackedSegment = {
  label: string
  value: number
  color: string
}

type Props = {
  segments: StackedSegment[]
  height?: number
  radius?: number
}

export function StackedBar({ segments, height = 8, radius = 4 }: Props) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height,
        borderRadius: radius,
        overflow: 'hidden',
        background: 'var(--m-border)',
      }}
    >
      {segments.map((s, i) => (
        <div
          key={i}
          style={{
            width: `${(s.value / total) * 100}%`,
            background: s.color,
            transition: 'width .4s',
          }}
          title={`${s.label}: ${s.value}%`}
        />
      ))}
    </div>
  )
}
