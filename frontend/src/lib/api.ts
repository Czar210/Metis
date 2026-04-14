/**
 * api.ts — Fetch wrapper que adiciona X-API-Key em todas as requests.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''
const API_KEY = process.env.NEXT_PUBLIC_METIS_API_KEY ?? ''

export function apiUrl(path: string): string {
  return `${API_URL}${path}`
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (API_KEY) headers.set('X-API-Key', API_KEY)
  if (!headers.has('Content-Type') && init?.method === 'POST') {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(apiUrl(path), {
    ...init,
    headers,
  })
}
