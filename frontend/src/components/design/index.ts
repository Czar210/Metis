/**
 * Metis design system — barrel export.
 *
 * Uso em páginas:
 *   import { Card, Stat, AppHeader, Icon } from '@/components/design'
 *
 * TODAS as telas do redesign devem estar embrulhadas em um container com
 * className="metis-scope" para ativar os tokens --m-* definidos em globals.css.
 */

export { Icon, type IconName } from './Icon'
export { Card } from './Card'
export { SectionLabel } from './SectionLabel'
export { Pill } from './Pill'
export { Stat } from './Stat'
export { Bar } from './Bar'
export { RoleGlyph } from './RoleGlyph'
export { ChampPortrait } from './ChampPortrait'
export { TierBadge } from './TierBadge'
export { RankBadge } from './RankBadge'
export { WinLossDots } from './WinLossDots'
export { Sparkline } from './Sparkline'
export { Donut } from './Donut'
export { StackedBar, type StackedSegment } from './StackedBar'
export { AreaChart } from './AreaChart'
export { RadarChart, type RadarAxis } from './RadarChart'
export { Logo } from './Logo'
export { AppHeader } from './AppHeader'
export { LangSwitcher } from './LangSwitcher'

export {
  TIER_COLORS,
  ROLES_PT,
  RANK_COLORS,
  PILL_COLORS,
  type Tier,
  type Role,
  type PillColor,
} from './tokens'
