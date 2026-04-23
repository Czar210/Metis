import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type Props = {
  children: ReactNode
  icon?: IconName
  right?: ReactNode
}

export function SectionLabel({ children, icon, right }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--m-text-dim)',
        }}
      >
        {icon && <Icon name={icon} size={14} style={{ color: 'var(--m-accent)' }} />}
        {children}
      </div>
      {right}
    </div>
  )
}
