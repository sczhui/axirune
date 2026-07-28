import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'

export type AppRoute =
  | '/'
  | '/playground'
  | '/ide'
  | '/docs'
  | '/examples'
  | '/benchmarks'
  | '/download'

const routes = new Set<AppRoute>([
  '/',
  '/playground',
  '/ide',
  '/docs',
  '/examples',
  '/benchmarks',
  '/download',
])

function currentRoute(): AppRoute {
  if (typeof window === 'undefined') return '/'
  const cleaned = window.location.pathname.replace(/\/+$/, '') || '/'
  if (routes.has(cleaned as AppRoute)) return cleaned as AppRoute

  const matchingSuffix = [...routes]
    .filter((route) => route !== '/')
    .find((route) => cleaned.endsWith(route))
  return matchingSuffix ?? '/'
}

export function useRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(currentRoute)

  useEffect(() => {
    const update = () => setRoute(currentRoute())
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [route])

  return route
}

export function navigate(path: AppRoute): void {
  if (typeof window === 'undefined') return
  if (currentRoute() === path) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

type LinkProps = {
  to: AppRoute
  children: ReactNode
  className?: string
  ariaLabel?: string
  onNavigate?: () => void
}

export function Link({ to, children, className, ariaLabel, onNavigate }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    event.preventDefault()
    navigate(to)
    onNavigate?.()
  }

  return (
    <a href={to} className={className} aria-label={ariaLabel} onClick={handleClick}>
      {children}
    </a>
  )
}

