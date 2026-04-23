import type { CSSProperties, ReactNode } from 'react'

type Props = {
  children: ReactNode
  style?: CSSProperties
  className?: string
  pad?: number
  /** Adiciona glow dourado — usado para destacar o card "IA Metis". */
  accent?: boolean
}

export function Card({
  children,
  style,
  className = '',
  pad = 20,
  accent = false,
}: Props) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--m-surface)',
        border: '1px solid var(--m-border)',
        borderRadius: 14,
        padding: pad,
        position: 'relative',
        ...(accent
          ? {
              borderColor: 'rgb(var(--m-accent-rgb) / 0.35)',
              boxShadow:
                '0 0 0 1px rgb(var(--m-accent-rgb) / 0.15), 0 20px 40px -20px rgb(var(--m-accent-rgb) / 0.35)',
            }
          : {}),
        ...(style || {}),
      }}
    >
      {children}
    </div>
  )
}
