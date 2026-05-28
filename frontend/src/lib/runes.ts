/**
 * runes.ts — Mapa de ícones de runas.
 *
 * O mapa é carregado dinamicamente de /api/v1/static/runes (via refreshRuneMap).
 * Enquanto o refresh não ocorre, usa FALLBACK_RUNE_MAP (stat shards + keystones
 * mais comuns) para não quebrar a UI no primeiro render.
 *
 * Uso em componentes:
 *   useEffect(() => { refreshRuneMap(apiFetch) }, [])
 *   runeIconUrl(id)  ← síncrono, usa o cache atual
 */

import { apiFetch } from '@/lib/api'

// Paths no formato que DDragon usa: "perk-images/Styles/..." ou "perk-images/StatMods/..."
// Stat shards são estáveis entre patches — os demais são atualizados via refreshRuneMap.
const FALLBACK_RUNE_MAP: Record<string, string> = {
  // ── Stat Shards ─────────────────────────────────────────────────
  '5008': 'perk-images/StatMods/StatModsAdaptiveForceIcon.png',
  '5005': 'perk-images/StatMods/StatModsAttackSpeedIcon.png',
  '5007': 'perk-images/StatMods/StatModsCDRScalingIcon.png',
  '5001': 'perk-images/StatMods/StatModsHealthScalingIcon.png',
  '5002': 'perk-images/StatMods/StatModsArmorIcon.png',
  '5003': 'perk-images/StatMods/StatModsMagicResIcon.png',

  // ── Keystones (fallback para o primeiro render) ──────────────────
  '8005': 'perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png',
  '8008': 'perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png',
  '8010': 'perk-images/Styles/Precision/Conqueror/Conqueror.png',
  '8021': 'perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png',
  '8112': 'perk-images/Styles/Domination/Electrocute/Electrocute.png',
  '8124': 'perk-images/Styles/Domination/Predator/Predator.png',
  '8128': 'perk-images/Styles/Domination/DarkHarvest/DarkHarvest.png',
  '9923': 'perk-images/Styles/Domination/HailOfBlades/HailOfBlades.png',
  '8214': 'perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png',
  '8229': 'perk-images/Styles/Sorcery/PhaseRush/PhaseRush.png',
  '8230': 'perk-images/Styles/Sorcery/SummonAery/SummonAery.png',
  '8351': 'perk-images/Styles/Inspiration/GlacialAugment/GlacialAugment.png',
  '8360': 'perk-images/Styles/Inspiration/UnsealedSpellbook/UnsealedSpellbook.png',
  '8369': 'perk-images/Styles/Inspiration/FirstStrike/FirstStrike.png',
  '8437': 'perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png',
  '8439': 'perk-images/Styles/Resolve/VeteranAftershock/Aftershock.png',
  '8465': 'perk-images/Styles/Resolve/Guardian/Guardian.png',
}

let _runeMap: Record<string, string> = { ...FALLBACK_RUNE_MAP }
let _lastRefresh = 0
const _TTL_MS = 24 * 60 * 60 * 1000 // 24h

/**
 * Busca o mapa atualizado do backend e atualiza o cache em memória.
 * Chamar uma vez por sessão num useEffect — idempotente se TTL não expirou.
 */
export async function refreshRuneMap(): Promise<void> {
  const now = Date.now()
  if (now - _lastRefresh < _TTL_MS) return
  try {
    const res = await apiFetch('/api/v1/static/runes')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: Record<string, string> = await res.json()
    _runeMap = data
    _lastRefresh = now
  } catch (err) {
    console.warn('[runes] refreshRuneMap falhou, usando fallback:', err)
  }
}

/**
 * URL do ícone de uma runa. Síncrono — usa o cache atual.
 * Retorna null se a runa não está no mapa (ícone omitido no UI).
 */
export function runeIconUrl(runeId: number): string | null {
  const iconPath = _runeMap[String(runeId)]
  if (!iconPath) return null
  return `https://ddragon.leagueoflegends.com/cdn/img/${iconPath}`
}

/** Árvores de runas (style IDs) — estáveis entre patches */
export const RUNE_TREES: Record<number, { name: string; color: string }> = {
  8000: { name: 'Precisao',     color: 'text-yellow-400' },
  8100: { name: 'Dominacao',    color: 'text-red-400' },
  8200: { name: 'Feiticaria',   color: 'text-blue-400' },
  8300: { name: 'Inspiracao',   color: 'text-cyan-400' },
  8400: { name: 'Determinacao', color: 'text-green-400' },
}
