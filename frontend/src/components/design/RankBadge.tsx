import { RANK_COLORS } from './tokens'

type Props = {
  tier?: string
  rank?: string
  lp?: number
}

export function RankBadge({
  tier = 'DIAMOND',
  rank = 'II',
  lp = 0,
}: Props) {
  const c = RANK_COLORS[tier] || '#9FB7E6'
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px 4px 4px',
        borderRadius: 999,
        background: 'var(--m-surface-2)',
        border: '1px solid var(--m-border-2)',
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, ${c}, ${c}88)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 800,
          color: '#0B0D12',
        }}
      >
        ◆
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: c,
        }}
      >
        {tier}
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--m-text-dim)' }}>
        {rank}
      </div>
      <div
        className="tabular"
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--m-text)',
          paddingLeft: 6,
          borderLeft: '1px solid var(--m-border-2)',
        }}
      >
        {lp} LP
      </div>
    </div>
  )
}
