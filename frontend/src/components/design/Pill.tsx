import type { CSSProperties, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { PILL_COLORS, type PillColor } from './tokens'

type Props = {
  children: ReactNode
  color?: PillColor
  icon?: IconName
  onClick?: () => void
  active?: boolean
  style?: CSSProperties
}

export function Pill({
  children,
  color = 'default',
  icon,
  onClick,
  active = false,
  style,
}: Props) {
  const c = PILL_COLORS[color]
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: active ? c.bg : 'transparent',
        border: `1px solid ${active ? c.bd : 'var(--m-border)'}`,
        color: active ? c.fg : 'var(--m-text-dim)',
        padding: '5px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        transition: 'all .15s',
        ...(style || {}),
      }}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </button>
  )
}
