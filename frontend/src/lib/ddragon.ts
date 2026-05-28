/**
 * ddragon.ts — utilitários para o Data Dragon da Riot
 *
 * Versão: buscada dinamicamente da API de versões do DDragon.
 * Fallback para 16.7.1 se a requisição falhar (ex: SSR, offline).
 */

const FALLBACK_VERSION = '16.10.1'
const VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json'

let cachedVersion: string | null = null

export async function getDDragonVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion
  try {
    const res = await fetch(VERSIONS_URL, { next: { revalidate: 3600 } })
    const versions: string[] = await res.json()
    cachedVersion = versions[0] ?? FALLBACK_VERSION
  } catch {
    cachedVersion = FALLBACK_VERSION
  }
  return cachedVersion
}

/** URL do ícone de um campeão. Aceita versão como argumento para uso em Client Components. */
export function championIconUrl(champion: string, version = FALLBACK_VERSION) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion}.png`
}

/** Ícone de role servido localmente (public/roles/) */
export function roleIconPath(role: string): string {
  const map: Record<string, string> = {
    TOP:     '/roles/position-top.png',
    JUNGLE:  '/roles/position-jungle.png',
    MIDDLE:  '/roles/position-middle.png',
    BOTTOM:  '/roles/position-bottom.png',
    UTILITY: '/roles/position-utility.png',
  }
  return map[role.toUpperCase()] ?? ''
}

/** Emblema de elo servido localmente (public/emblems/) */
export function emblemPath(elo: string): string {
  const capitalized = elo.charAt(0).toUpperCase() + elo.slice(1).toLowerCase()
  return `/emblems/Emblem_${capitalized}.png`
}

export { FALLBACK_VERSION as DDRAGON_VERSION }
