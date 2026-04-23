type Props = {
  value: number
  max?: number
  color?: string
  track?: string
  height?: number
  rounded?: boolean
}

export function Bar({
  value,
  max = 100,
  color = 'var(--m-accent)',
  track = 'var(--m-border)',
  height = 6,
  rounded = true,
}: Props) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div
      style={{
        width: '100%',
        height,
        background: track,
        borderRadius: rounded ? height / 2 : 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: rounded ? height / 2 : 0,
          transition: 'width .4s',
        }}
      />
    </div>
  )
}
