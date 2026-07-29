import { useEffect, useState } from 'react'
import type { Locale } from './content/site'
import { BenchmarksPage } from './ui/BenchmarksPage'
import { DocsPage } from './ui/DocsPage'
import { DownloadPage } from './ui/DownloadPage'
import { ExamplesPage } from './ui/ExamplesPage'
import { HomePage } from './ui/HomePage'
import { IdePage } from './ui/IdePage'
import { PlaygroundPage } from './ui/PlaygroundPage'
import { useRoute } from './ui/Router'
import { PageFrame } from './ui/Shell'

const titles = {
  '/': 'Nexilume — Illuminate intent. Bound every effect.',
  '/playground': 'Playground — Nexilume',
  '/ide': 'Online IDE — Nexilume',
  '/docs': 'Language Documentation — Nexilume',
  '/examples': 'Example Programs — Nexilume',
  '/benchmarks': 'Benchmarks — Nexilume',
  '/download': 'Download Nexilume 0.2.0',
} as const

function initialLocale(): Locale {
  if (typeof window === 'undefined') return 'zh'
  const stored = window.localStorage.getItem('nexilume-locale')
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
    window.localStorage.setItem('nexilume-locale', next)
  }

  return (
    <PageFrame route={route} locale={locale} onLocaleChange={changeLocale}>
      {route === '/' ? <HomePage locale={locale} /> : null}
      {route === '/playground' ? <PlaygroundPage locale={locale} /> : null}
      {route === '/ide' ? <IdePage locale={locale} /> : null}
      {route === '/docs' ? <DocsPage locale={locale} /> : null}
      {route === '/examples' ? <ExamplesPage locale={locale} /> : null}
      {route === '/benchmarks' ? <BenchmarksPage locale={locale} /> : null}
      {route === '/download' ? <DownloadPage locale={locale} /> : null}
    </PageFrame>
  )
}
