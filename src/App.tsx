import { useEffect, useState } from 'react'
import type { Locale } from './content/site'
import { ArcadePage } from './ui/ArcadePage'
import { BenchmarksPage } from './ui/BenchmarksPage'
import { CapsuleLabPage } from './ui/CapsuleLabPage'
import { DocsPage } from './ui/DocsPage'
import { DownloadPage } from './ui/DownloadPage'
import { ExamplesPage } from './ui/ExamplesPage'
import { HomePage } from './ui/HomePage'
import { IdePage } from './ui/IdePage'
import { LedgerShowcasePage } from './ui/LedgerShowcasePage'
import { PlaygroundPage } from './ui/PlaygroundPage'
import { useRoute } from './ui/Router'
import { PageFrame } from './ui/Shell'

const titles = {
  '/': 'Axirune — Make intent axiomatic. Bound every effect.',
  '/capsule-lab': 'Capsule Lab — Axirune',
  '/arcade': 'Axirune Arcade — Verified rules, original worlds',
  '/playground': 'Playground — Axirune',
  '/ide': 'Online IDE — Axirune',
  '/docs': 'Language Documentation — Axirune',
  '/examples': 'Example Programs — Axirune',
  '/showcase/ledger': 'AxiLedger — Built with Axirune',
  '/benchmarks': 'Benchmarks — Axirune',
  '/download': 'Download Axirune 0.4.0-alpha.3',
} as const

function initialLocale(): Locale {
  if (typeof window === 'undefined') return 'zh'
  const stored = window.localStorage.getItem('axirune-locale')
  if (stored === 'zh' || stored === 'en') return stored
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export default function App() {
  const route = useRoute()
  const [locale, setLocale] = useState<Locale>(initialLocale)

  useEffect(() => {
    document.title = titles[route]
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale, route])

  const changeLocale = (next: Locale) => {
    setLocale(next)
    window.localStorage.setItem('axirune-locale', next)
  }

  return (
    <PageFrame route={route} locale={locale} onLocaleChange={changeLocale}>
      {route === '/' ? <HomePage locale={locale} /> : null}
      {route === '/capsule-lab' ? <CapsuleLabPage locale={locale} /> : null}
      {route === '/arcade' ? <ArcadePage locale={locale} /> : null}
      {route === '/playground' ? <PlaygroundPage locale={locale} /> : null}
      {route === '/ide' ? <IdePage locale={locale} /> : null}
      {route === '/docs' ? <DocsPage locale={locale} /> : null}
      {route === '/examples' ? <ExamplesPage locale={locale} /> : null}
      {route === '/showcase/ledger' ? <LedgerShowcasePage locale={locale} /> : null}
      {route === '/benchmarks' ? <BenchmarksPage locale={locale} /> : null}
      {route === '/download' ? <DownloadPage locale={locale} /> : null}
    </PageFrame>
  )
}
