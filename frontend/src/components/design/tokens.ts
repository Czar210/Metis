/**
 * Metis Redesign — design tokens em TS.
 *
 * Espelha as CSS custom properties definidas em `.metis-scope` (globals.css).
 * Use via var('--m-*') em style inline para manter consistência com o CSS;
 * estas constantes servem pra acesso direto (arrays, paleta dinâmica).
 */

// ── Tiers (S+/S/A/B/C) — visual badges ──────────────────────────────────
export const TIER_COLORS = {
  'S+': { bg: 'rgba(245,200,66,0.12)',  border: '#F5C842', text: '#F5C842' },
  'S':  { bg: 'rgba(251,146,60,0.12)',  border: '#FB923C', text: '#FBAD5A' },
  'A':  { bg: 'rgba(74,222,128,0.12)',  border: '#4ADE80', text: '#4ADE80' },
  'B':  { bg: 'rgba(96,165,250,0.12)',  border: '#60A5FA', text: '#60A5FA' },
  'C':  { bg: 'rgba(138,147,166,0.12)', border: '#5A6378', text: '#8A93A6' },
  'D':  { bg: 'rgba(248,113,113,0.12)', border: '#7F1D1D', text: '#F87171' },
} as const

export type Tier = keyof typeof TIER_COLORS

// ── Roles — label em pt-BR ──────────────────────────────────────────────
export const ROLES_PT = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'ADC',
  UTILITY: 'Suporte',
} as const

export type Role = keyof typeof ROLES_PT

// ── Elos (rank badge) ───────────────────────────────────────────────────
export const RANK_COLORS: Record<string, string> = {
  IRON:        '#857668',
  BRONZE:      '#A96C3C',
  SILVER:      '#B4C0CF',
  GOLD:        '#E8B841',
  PLATINUM:    '#4FC6CC',
  EMERALD:     '#44D19E',
  DIAMOND:     '#9FB7E6',
  MASTER:      '#C581E6',
  GRANDMASTER: '#E87070',
  CHALLENGER:  '#66D7F0',
}

// ── Pills — mapeamento de cor por variante ──────────────────────────────
// Pill "accent" segue o ThemeSwitcher via --m-accent-rgb. Outras cores são
// acentos secundários intencionais (ex: verde = sucesso, violet = Metis AI).
export const PILL_COLORS = {
  default: { bg: 'var(--m-surface-2)',               bd: 'var(--m-border-2)',              fg: 'var(--m-text-dim)' },
  accent:  { bg: 'rgb(var(--m-accent-rgb) / 0.12)',  bd: 'rgb(var(--m-accent-rgb) / 0.35)', fg: 'var(--m-accent)'  },
  green:   { bg: 'rgba(74,222,128,0.12)',            bd: 'rgba(74,222,128,0.3)',           fg: 'var(--m-green)'    },
  red:     { bg: 'rgba(248,113,113,0.12)',           bd: 'rgba(248,113,113,0.3)',          fg: 'var(--m-red)'      },
  cyan:    { bg: 'rgba(91,227,212,0.12)',            bd: 'rgba(91,227,212,0.3)',           fg: 'var(--m-cyan)'     },
  violet:  { bg: 'rgba(139,127,255,0.12)',           bd: 'rgba(139,127,255,0.3)',          fg: 'var(--m-violet)'   },
} as const

export type PillColor = keyof typeof PILL_COLORS
