// Mapeamento completo de TODAS as runas (keystones + menores)
// Fonte: https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/...
const RUNE_PATHS: Record<number, string> = {
  // ── Precisao (8000) ──────────────────────────────────────────
  // Keystones
  8005: 'Precision/PressTheAttack/PressTheAttack',
  8008: 'Precision/LethalTempo/LethalTempoTemp',
  8010: 'Precision/Conqueror/Conqueror',
  8021: 'Precision/FleetFootwork/FleetFootwork',
  // Slot 1
  9101: 'Precision/Overheal',
  9111: 'Precision/Triumph',
  8009: 'Precision/PresenceOfMind/PresenceOfMind',
  // Slot 2
  9104: 'Precision/LegendAlacrity/LegendAlacrity',
  9105: 'Precision/LegendTenacity/LegendTenacity',
  9103: 'Precision/LegendBloodline/LegendBloodline',
  // Slot 3
  8014: 'Precision/CoupDeGrace/CoupDeGrace',
  8017: 'Precision/CutDown/CutDown',
  8299: 'Precision/LastStand/LastStand',

  // ── Dominacao (8100) ─────────────────────────────────────────
  // Keystones
  8112: 'Domination/Electrocute/Electrocute',
  8124: 'Domination/Predator/Predator',
  8128: 'Domination/DarkHarvest/DarkHarvest',
  9923: 'Domination/HailOfBlades/HailOfBlades',
  // Slot 1
  8126: 'Domination/CheapShot/CheapShot',
  8139: 'Domination/TasteOfBlood/TasteOfBlood',
  8143: 'Domination/SuddenImpact/SuddenImpact',
  // Slot 2
  8136: 'Domination/ZombieWard/ZombieWard',
  8120: 'Domination/GhostPoro/GhostPoro',
  8138: 'Domination/EyeballCollection/EyeballCollection',
  // Slot 3
  8135: 'Domination/TreasureHunter/TreasureHunter',
  8105: 'Domination/RelentlessHunter/RelentlessHunter',
  8106: 'Domination/UltimateHunter/UltimateHunter',

  // ── Feiticaria (8200) ────────────────────────────────────────
  // Keystones
  8214: 'Sorcery/ArcaneComet/ArcaneComet',
  8229: 'Sorcery/PhaseRush/PhaseRush',
  8230: 'Sorcery/SummonAery/SummonAery',
  // Slot 1
  8224: 'Sorcery/NullifyingOrb/NullifyingOrb',
  8226: 'Sorcery/ManaflowBand/ManaflowBand',
  8275: 'Sorcery/NimbusCloak/NimbusCloak',
  // Slot 2
  8210: 'Sorcery/Transcendence/Transcendence',
  8234: 'Sorcery/Celerity/Celerity',
  8233: 'Sorcery/AbsoluteFocus/AbsoluteFocus',
  // Slot 3
  8237: 'Sorcery/Scorch/Scorch',
  8232: 'Sorcery/Waterwalking/Waterwalking',
  8236: 'Sorcery/GatheringStorm/GatheringStorm',

  // ── Determinacao (8400) ──────────────────────────────────────
  // Keystones
  8437: 'Resolve/GraspOfTheUndying/GraspOfTheUndying',
  8439: 'Resolve/VeteranAftershock/Aftershock',
  8465: 'Resolve/Guardian/Guardian',
  // Slot 1
  8446: 'Resolve/Demolish/Demolish',
  8463: 'Resolve/FontOfLife/FontOfLife',
  8401: 'Resolve/ShieldBash/ShieldBash',
  // Slot 2
  8429: 'Resolve/Conditioning/Conditioning',
  8444: 'Resolve/SecondWind/SecondWind',
  8473: 'Resolve/BonePlating/BonePlating',
  // Slot 3
  8451: 'Resolve/Overgrowth/Overgrowth',
  8453: 'Resolve/Revitalize/Revitalize',
  8242: 'Resolve/Unflinching/Unflinching',

  // ── Inspiracao (8300) ────────────────────────────────────────
  // Keystones
  8351: 'Inspiration/GlacialAugment/GlacialAugment',
  8360: 'Inspiration/UnsealedSpellbook/UnsealedSpellbook',
  8369: 'Inspiration/FirstStrike/FirstStrike',
  // Slot 1
  8306: 'Inspiration/HextechFlashtraption/HextechFlashtraption',
  8304: 'Inspiration/MagicalFootwear/MagicalFootwear',
  8313: 'Inspiration/PerfectTiming/PerfectTiming',
  // Slot 2
  8321: 'Inspiration/FuturesMarket/FuturesMarket',
  8316: 'Inspiration/MinionDematerializer/MinionDematerializer',
  8345: 'Inspiration/BiscuitDelivery/BiscuitDelivery',
  // Slot 3
  8347: 'Inspiration/CosmicInsight/CosmicInsight',
  8410: 'Inspiration/ApproachVelocity/ApproachVelocity',
  8352: 'Inspiration/TimeWarpTonic/TimeWarpTonic',

  // ── Stat Shards (fragments) ──────────────────────────────────
  5008: 'StatMods/StatModsAdaptiveForceIcon',
  5005: 'StatMods/StatModsAttackSpeedIcon',
  5007: 'StatMods/StatModsCDRScalingIcon',
  5001: 'StatMods/StatModsHealthScalingIcon',
  5002: 'StatMods/StatModsArmorIcon',
  5003: 'StatMods/StatModsMagicResIcon',
}

export function runeIconUrl(runeId: number, version: string): string | null {
  const path = RUNE_PATHS[runeId]
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
