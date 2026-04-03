import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ui/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Metis — Estrategista de LoL',
  description: 'Sua aliada tática no League of Legends. Análise real, sem achismos.',
}

// Script inline: aplica modo e cor ANTES da hidratação do React para evitar flash.
const THEME_SCRIPT = `
(function() {
  try {
    var mode  = localStorage.getItem('metis-mode')  || 'dark';
    var color = localStorage.getItem('metis-color') || 'blue';
    var root = document.documentElement;
    root.setAttribute('data-mode', mode);
    root.setAttribute('data-color', color);
  } catch(e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
