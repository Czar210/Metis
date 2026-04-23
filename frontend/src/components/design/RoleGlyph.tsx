import type { ReactElement } from 'react'
import type { Role } from './tokens'

const GLYPHS: Record<Role, ReactElement | ReactElement[]> = {
  TOP:     <path d="M3 3h12v3H6v9H3z" />,
  JUNGLE:  <path d="M9 2l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" />,
  MIDDLE:  <path d="M3 15L15 3M3 3h5M15 15v-5" />,
  BOTTOM:  <path d="M15 15H3v-3h9V3h3z" />,
  UTILITY: [
    <circle key="a" cx="9" cy="9" r="6" />,
    <path key="b" d="M9 5v8M5 9h8" />,
  ],
}

type Props = {
  role: Role | string
  size?: number
}

export function RoleGlyph({ role, size = 12 }: Props) {
  const key = (role as Role) in GLYPHS ? (role as Role) : 'MIDDLE'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {GLYPHS[key]}
    </svg>
  )
}
