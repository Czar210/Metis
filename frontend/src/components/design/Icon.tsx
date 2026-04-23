/**
 * Icon — inline SVG icons no estilo Lucide (stroke 1.75, viewBox 24x24).
 *
 * Paridade 1:1 com `metis/icons.jsx` do handoff. Evita pagar o custo de
 * `lucide-react` (~40kb) quando já há o set fechado que as telas precisam.
 */

import type { CSSProperties, ReactElement, SVGProps } from 'react'

type IconPath = ReactElement | ReactElement[]

const PATHS: Record<string, IconPath> = {
  search: <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />,
  star:   <path d="M12 2l3 7 7.5.6-5.7 5 1.8 7.4L12 18l-6.6 4 1.8-7.4L1.5 9.6 9 9l3-7z" />,
  trending: <path d="M3 17l6-6 4 4 7-7M14 8h7v7" />,
  chevronRight: <path d="M9 18l6-6-6-6" />,
  chevronDown:  <path d="M6 9l6 6 6-6" />,
  chevronUp:    <path d="M18 15l-6-6-6 6" />,
  sword:  <path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M15 5l4-4M20 6l1-1" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  eye: [
    <path key="eye-a" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />,
    <circle key="eye-b" cx="12" cy="12" r="3" />,
  ],
  brain: <path d="M12 5a3 3 0 1 0-5.9.8 3 3 0 0 0-2 5.4 3 3 0 0 0 2 5.4A3 3 0 1 0 12 19a3 3 0 1 0 5.9-2.4 3 3 0 0 0 2-5.4 3 3 0 0 0-2-5.4A3 3 0 1 0 12 5z" />,
  zap: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  users: [
    <path key="u-a" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />,
    <circle key="u-b" cx="9" cy="7" r="4" />,
    <path key="u-c" d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />,
  ],
  clock: [
    <circle key="c-a" cx="12" cy="12" r="10" />,
    <path key="c-b" d="M12 6v6l4 2" />,
  ],
  crosshair: [
    <circle key="x-a" cx="12" cy="12" r="10" />,
    <path key="x-b" d="M22 12h-4M6 12H2M12 6V2M12 22v-4" />,
  ],
  filter: <path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z" />,
  sparkles: [
    <path key="s-a" d="M12 3l1.6 4.8L18 9.5l-4.4 1.7L12 16l-1.6-4.8L6 9.5l4.4-1.7L12 3z" />,
    <path key="s-b" d="M19 13l.8 2.4L22 16l-2.2.6L19 19l-.8-2.4L16 16l2.2-.6L19 13z" />,
  ],
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  home: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  check: <path d="M20 6L9 17l-5-5" />,
  arrowUp:    <path d="M12 19V5M5 12l7-7 7 7" />,
  arrowDown:  <path d="M12 5v14M19 12l-7 7-7-7" />,
  arrowRight: <path d="M5 12h14M12 5l7 7-7 7" />,
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1 0 2-1 2-2.5 0-1.5-1-2-2-3-1.5-1-2.5-2-2.5-3.5C8.5 6 11 5 12 5c-.5 1.5 1 2 2 3.5 1 1 2 2 2 4 0 3-2.5 5-6 5s-6-2-6-5c0-1 0-2 1-3 0 1.5 1.5 3.5 3.5 3.5z" />,
  dollar: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6" />,
  bolt: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  messageCircle: <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />,
  compass: [
    <circle key="co-a" cx="12" cy="12" r="10" />,
    <path key="co-b" d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />,
  ],
  gamepad: [
    <path key="g-a" d="M6 11h4M8 9v4M15 12h.01M18 10h.01" />,
    <path key="g-b" d="M17.32 5H6.68a4 4 0 0 0-3.98 3.6l-1 10A2 2 0 0 0 3.68 21h.14a3 3 0 0 0 2.7-1.66l.24-.48A3 3 0 0 1 9.48 17h5.04a3 3 0 0 1 2.7 1.66l.24.48a3 3 0 0 0 2.71 1.66h.14a2 2 0 0 0 2-2.2l-1-10A4 4 0 0 0 17.32 5z" />,
  ],
  target: [
    <circle key="t-a" cx="12" cy="12" r="10" />,
    <circle key="t-b" cx="12" cy="12" r="6" />,
    <circle key="t-c" cx="12" cy="12" r="2" />,
  ],
  medal: [
    <path key="m-a" d="M7.21 15L2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" />,
    <circle key="m-b" cx="12" cy="17" r="5" />,
    <path key="m-c" d="M11 12l-1 5h4l-1-5" />,
  ],
  bookOpen: <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />,
  barChart: <path d="M12 20V10M18 20V4M6 20v-6" />,
  pieChart: [
    <path key="p-a" d="M21.21 15.89A10 10 0 1 1 8 2.83" />,
    <path key="p-b" d="M22 12A10 10 0 0 0 12 2v10z" />,
  ],
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  dot: <circle cx="12" cy="12" r="3" />,
  x: <path d="M18 6L6 18M6 6l12 12" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  settings: [
    <circle key="se-a" cx="12" cy="12" r="3" />,
    <path key="se-b" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />,
  ],
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  creditCard: [
    <rect key="cc-a" x="2" y="5" width="20" height="14" rx="2" />,
    <path key="cc-b" d="M2 10h20" />,
  ],
  info: [
    <circle key="in-a" cx="12" cy="12" r="10" />,
    <path key="in-b" d="M12 16v-4M12 8h.01" />,
  ],
  copy: [
    <rect key="cp-a" x="9" y="9" width="13" height="13" rx="2" />,
    <path key="cp-b" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />,
  ],
  gift: [
    <path key="gi-a" d="M20 12v10H4V12" />,
    <path key="gi-b" d="M2 7h20v5H2z" />,
    <path key="gi-c" d="M12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" />,
  ],
  calendar: [
    <rect key="ca-a" x="3" y="4" width="18" height="18" rx="2" />,
    <path key="ca-b" d="M16 2v4M8 2v4M3 10h18" />,
  ],
  mail: [
    <rect key="ma-a" x="2" y="4" width="20" height="16" rx="2" />,
    <path key="ma-b" d="M22 7l-10 7L2 7" />,
  ],
  globe: [
    <circle key="gl-a" cx="12" cy="12" r="10" />,
    <path key="gl-b" d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />,
  ],
  palette: [
    <circle key="pa-a" cx="13.5" cy="6.5" r="1" />,
    <circle key="pa-b" cx="17.5" cy="10.5" r="1" />,
    <circle key="pa-c" cx="8.5" cy="7.5" r="1" />,
    <circle key="pa-d" cx="6.5" cy="12.5" r="1" />,
    <path key="pa-e" d="M12 2a10 10 0 0 0 0 20 3 3 0 0 0 3-3 2 2 0 0 1 2-2h1.5a4.5 4.5 0 0 0 4.5-4.5A10 10 0 0 0 12 2z" />,
  ],
  shieldCheck: [
    <path key="sc-a" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    <path key="sc-b" d="M9 12l2 2 4-4" />,
  ],
  key: [
    <circle key="ke-a" cx="8" cy="15" r="4" />,
    <path key="ke-b" d="M11 12l8-8 3 3-2 2 2 2-2 2-2-2-2 2-3-3" />,
  ],
  lock: [
    <rect key="lo-a" x="3" y="11" width="18" height="11" rx="2" />,
    <path key="lo-b" d="M7 11V7a5 5 0 0 1 10 0v4" />,
  ],
  trash: [
    <path key="tr-a" d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />,
    <path key="tr-b" d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />,
  ],
  refresh: <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />,
}

export type IconName = keyof typeof PATHS

type Props = {
  name: IconName
  size?: number
  className?: string
  style?: CSSProperties
  strokeWidth?: number
} & Omit<SVGProps<SVGSVGElement>, 'name' | 'size'>

export function Icon({
  name,
  size = 16,
  className,
  style,
  strokeWidth = 1.75,
  ...rest
}: Props) {
  const path = PATHS[name]
  if (!path) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      {...rest}
    >
      {path}
    </svg>
  )
}
