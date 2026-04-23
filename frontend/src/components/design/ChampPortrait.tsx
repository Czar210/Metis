/**
 * ChampPortrait — avatar do campeão via Data Dragon CDN + overlay de role.
 *
 * Role overlay usa os PNGs oficiais da Riot (public/roles/position-*.png)
 * em vez do SVG inline — é o que o César pediu.
 */

import Image from 'next/image'
import { championIconUrl, DDRAGON_VERSION, roleIconPath } from '@/lib/ddragon'
import type { Role } from './tokens'

type Props = {
  name: string
  size?: number
  border?: boolean
  role?: Role | string
  /** Anel colorido indicando time (usado na timeline). */
  ring?: 'blue' | 'red'
  /** Diminui opacidade — útil pra vítima de kill. */
  dim?: boolean
}

export function ChampPortrait({
  name,
  size = 40,
  border = true,
  role,
  ring,
  dim = false,
}: Props) {
  const ringColor =
    ring === 'blue' ? 'var(--m-green)' : ring === 'red' ? 'var(--m-red)' : null

  const roleSrc = role ? roleIconPath(String(role)) : ''
  const badgeSize = Math.round(size * 0.42)
  const roleIconSize = Math.round(badgeSize * 0.72)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size / 6,
          backgroundImage: `url(${championIconUrl(name, DDRAGON_VERSION)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: ringColor
            ? `1.5px solid ${ringColor}`
            : border
            ? '1px solid var(--m-border-2)'
            : 'none',
          opacity: dim ? 0.55 : 1,
          filter: dim ? 'grayscale(0.3)' : 'none',
        }}
      />
      {role && roleSrc && (
        <div
          style={{
            position: 'absolute',
            bottom: -3,
            right: -3,
            width: badgeSize,
            height: badgeSize,
            borderRadius: '50%',
            background: 'var(--m-surface-2)',
            border: '1px solid var(--m-border-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Image
            src={roleSrc}
            alt={String(role)}
            width={roleIconSize}
            height={roleIconSize}
            unoptimized
            style={{ objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  )
}
