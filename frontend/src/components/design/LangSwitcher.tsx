'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { setLocale } from '@/i18n/actions'
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from '@/i18n/config'

export function LangSwitcher() {
  const current = useLocale() as Locale
  const t = useTranslations('header')
  const [pending, start] = useTransition()

  return (
    <div
      role="group"
      aria-label={t('switch_language')}
      title={t('current_language', { label: LOCALE_LABELS[current] })}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: 2,
        borderRadius: 8,
        background: 'var(--m-surface-2)',
        border: '1px solid var(--m-border-2)',
        fontSize: 11,
        fontWeight: 600,
        opacity: pending ? 0.55 : 1,
      }}
    >
      {SUPPORTED_LOCALES.map((loc) => {
        const active = loc === current
        return (
          <button
            key={loc}
            type="button"
            disabled={pending || active}
            onClick={() => start(() => setLocale(loc))}
            style={{
              padding: '3px 8px',
              borderRadius: 6,
              border: 'none',
              background: active ? 'var(--m-accent)' : 'transparent',
              color: active ? '#1a1510' : 'var(--m-text-dim)',
              fontFamily: 'inherit',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              cursor: active ? 'default' : 'pointer',
            }}
          >
            {LOCALE_LABELS[loc]}
          </button>
        )
      })}
    </div>
  )
}
