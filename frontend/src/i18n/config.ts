export const SUPPORTED_LOCALES = ['pt', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'pt'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export const LOCALE_LABELS: Record<Locale, string> = {
  pt: 'PT',
  en: 'EN',
}

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'pt' || value === 'en'
}
