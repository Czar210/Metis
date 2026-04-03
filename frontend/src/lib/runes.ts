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
