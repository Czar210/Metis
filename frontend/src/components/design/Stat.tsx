import { Icon, type IconName } from './Icon'

type Props = {
  label: string
  value: string | number
  sub?: string
  accent?: string
  icon?: IconName
  size?: 'sm' | 'md' | 'lg'
}

export function Stat({ label, value, sub, accent, icon, size = 'md' }: Props) {
  const dims =
    size === 'lg'
      ? { v: 32, l: 11, s: 11 }
      : size === 'sm'
      ? { v: 18, l: 10, s: 10 }
      : { v: 24, l: 10, s: 10 }
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontSize: dims.l,
          fontWeight: 600,
          color: 'var(--m-text-dim)',
        }}
      >
        {icon && <Icon name={icon} size={12} />}
        {label}
      </div>
      <div
        className="tabular font-display"
        style={{
          fontSize: dims.v,
          fontWeight: 700,
          color: accent || 'var(--m-text)',
          marginTop: 4,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: dims.s, color: 'var(--m-muted)', marginTop: 3 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
