import type { Locale } from '@/i18n/config'

const BCP47: Record<Locale, string> = {
  pt: 'pt-BR',
  en: 'en-US',
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(BCP47[locale]).format(value)
}

export function formatPercent(value: number, locale: Locale, fractionDigits = 1): string {
  return new Intl.NumberFormat(BCP47[locale], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value) + '%'
}
