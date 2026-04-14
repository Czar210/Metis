// Mapeamento keystone ID → caminho na DDragon perk-images
// Fonte: https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/...
const KEYSTONE_PATHS: Record<number, string> = {
  // Precisão
  8008: 'Precision/LethalTempo/LethalTempoTemp',
  8005: 'Precision/PressTheAttack/PressTheAttack',
  8021: 'Precision/FleetFootwork/FleetFootwork',
  8010: 'Precision/Conqueror/Conqueror',
  // Dominação
  8112: 'Domination/Electrocute/Electrocute',
  8124: 'Domination/Predator/Predator',
  8128: 'Domination/DarkHarvest/DarkHarvest',
  9923: 'Domination/HailOfBlades/HailOfBlades',
  // Feitiçaria
  8214: 'Sorcery/ArcaneComet/ArcaneComet',
  8229: 'Sorcery/PhaseRush/PhaseRush',
  8230: 'Sorcery/SummonAery/SummonAery',
  // Determinação
  8437: 'Resolve/GraspOfTheUndying/GraspOfTheUndying',
  8439: 'Resolve/VeteranAftershock/Aftershock',
  8465: 'Resolve/Guardian/Guardian',
  // Inspiração
  8351: 'Inspiration/GlacialAugment/GlacialAugment',
  8360: 'Inspiration/UnsealedSpellbook/UnsealedSpellbook',
  8369: 'Inspiration/FirstStrike/FirstStrike',
}

export function runeIconUrl(keystoneId: number, version: string): string | null {
  const path = KEYSTONE_PATHS[keystoneId]
  if (!path) return null
  return `https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/${path}.png`
}

// Arvores de runas (style IDs)
export const RUNE_TREES: Record<number, { name: string; color: string }> = {
  8000: { name: 'Precisao',    color: 'text-yellow-400' },
  8100: { name: 'Dominacao',   color: 'text-red-400' },
  8200: { name: 'Feiticaria',  color: 'text-blue-400' },
  8300: { name: 'Inspiracao',  color: 'text-cyan-400' },
  8400: { name: 'Determinacao', color: 'text-green-400' },
}

// Gera URL pra qualquer runa/perk (nao so keystones)
export function perkIconUrl(perkId: number): string {
  // Keystones tem path especifico
  const kp = KEYSTONE_PATHS[perkId]
  if (kp) return `https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/${kp}.png`
  // Fallback generico via community dragon (funciona pra todas as runas)
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/runesicon.png`
}
