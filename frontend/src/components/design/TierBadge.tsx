import { TIER_COLORS, type Tier } from './tokens'

type Props = {
  tier: Tier | string
  size?: 'sm' | 'md' | 'lg'
}

export function TierBadge({ tier, size = 'md' }: Props) {
  const c = TIER_COLORS[tier as Tier] || TIER_COLORS.B
  const dims =
    size === 'sm' ? { w: 24, h: 20, fs: 10 }
    : size === 'lg' ? { w: 44, h: 36, fs: 18 }
    : { w: 32, h: 26, fs: 13 }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dims.w,
        height: dims.h,
        borderRadius: 6,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        fontSize: dims.fs,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        flexShrink: 0,
      }}
    >
      {tier}
    </span>
  )
}
