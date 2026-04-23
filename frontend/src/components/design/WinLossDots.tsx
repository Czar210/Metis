type Props = {
  /** Array de 0|1|true|false. 1/true = vitória. */
  results: Array<0 | 1 | boolean>
  size?: number
  gap?: number
}

export function WinLossDots({ results, size = 8, gap = 4 }: Props) {
  return (
    <div style={{ display: 'flex', gap }}>
      {results.map((w, i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            background: w ? 'var(--m-green)' : 'var(--m-red)',
            opacity: 0.35 + (i / results.length) * 0.65,
          }}
        />
      ))}
    </div>
  )
}
