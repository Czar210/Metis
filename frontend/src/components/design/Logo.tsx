import Link from 'next/link'

type Props = {
  size?: number
}

export function Logo({ size = 24 }: Props) {
  return (
    <Link
      href="/"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        textDecoration: 'none',
        color: 'var(--m-text)',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path
          d="M6 26V6l10 14L26 6v20"
          stroke="var(--m-accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="16" cy="26" r="1.5" fill="var(--m-accent)" />
      </svg>
      <span
        className="font-display"
        style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}
      >
        Metis
      </span>
    </Link>
  )
}
