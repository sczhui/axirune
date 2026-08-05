import { ArrowDownToLine, ArrowUpRight, Menu, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { navItems, type Locale } from '../content/site'
import { Link, type AppRoute } from './Router'

type HeaderProps = {
  route: AppRoute
  locale: Locale
  onLocaleChange: (locale: Locale) => void
}

export function Header({ route, locale, onLocaleChange }: HeaderProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => setOpen(false), [route])
  useEffect(() => {
    document.body.classList.toggle('nav-open', open)
    return () => document.body.classList.remove('nav-open')
  }, [open])

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="wordmark" ariaLabel="Axirune home" onNavigate={() => setOpen(false)}>
          <span className="wordmark__sigil" aria-hidden="true">
            <i />
            <i />
          </span>
          <span className="wordmark__name">axirune</span>
          <span className="wordmark__version">0.4α</span>
        </Link>

        <nav className={`primary-nav ${open ? 'primary-nav--open' : ''}`} aria-label="Primary">
          <div className="primary-nav__mobile-head">
            <span>INDEX / 索引</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
              <X size={22} />
            </button>
          </div>
          {navItems.map((item, index) => (
            <Link
              key={item.path}
              to={item.path}
              onNavigate={() => setOpen(false)}
              className={route === item.path ? 'is-active' : ''}
            >
              <span className="primary-nav__index">{String(index + 1).padStart(2, '0')}</span>
              <span>{item.label[locale]}</span>
            </Link>
          ))}
          <Link
            to="/showcase/ledger"
            onNavigate={() => setOpen(false)}
            className={route === '/showcase/ledger' ? 'is-active' : ''}
          >
            <span className="primary-nav__index">{String(navItems.length + 1).padStart(2, '0')}</span>
            <span>{locale === 'zh' ? '案例' : 'Showcase'}</span>
          </Link>
          <div className="primary-nav__mobile-foot">
            <p>Make intent axiomatic.</p>
            <p>Bound every effect.</p>
          </div>
        </nav>

        <div className="site-header__actions">
          <button
            className="locale-toggle"
            type="button"
            onClick={() => onLocaleChange(locale === 'zh' ? 'en' : 'zh')}
            aria-label={locale === 'zh' ? 'Switch to English' : '切换为中文'}
          >
            <span className={locale === 'zh' ? 'is-current' : ''}>中</span>
            <i />
            <span className={locale === 'en' ? 'is-current' : ''}>EN</span>
          </button>
          <Link to="/download" className="header-download" ariaLabel="Download Axirune">
            <ArrowDownToLine size={16} />
            <span>{locale === 'zh' ? '获取' : 'GET'}</span>
          </Link>
          <button
            className="menu-button"
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Menu size={22} />
          </button>
        </div>
      </div>
    </header>
  )
}

export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="site-footer">
      <div className="site-footer__statement">
        <span className="eyebrow">AXIRUNE / 0.4.0-ALPHA.2</span>
        <p>Make intent axiomatic.</p>
        <p>Bound every effect.</p>
      </div>
      <div className="site-footer__grid">
        <div>
          <span className="site-footer__label">{locale === 'zh' ? '探索' : 'EXPLORE'}</span>
          <Link to="/playground">Playground</Link>
          <Link to="/capsule-lab">Capsule Lab</Link>
          <Link to="/arcade">Axirune Arcade</Link>
          <Link to="/ide">Online IDE</Link>
          <Link to="/showcase/ledger">AxiLedger Showcase</Link>
          <Link to="/examples">Examples</Link>
        </div>
        <div>
          <span className="site-footer__label">{locale === 'zh' ? '理解' : 'LEARN'}</span>
          <Link to="/docs">Language docs</Link>
          <Link to="/benchmarks">Benchmarks</Link>
          <a href="/downloads/axirune-source-0.4.0-alpha.2.tar.gz">
            Source archive <ArrowUpRight size={13} />
          </a>
        </div>
        <div>
          <span className="site-footer__label">{locale === 'zh' ? '构建' : 'BUILD'}</span>
          <a href="/downloads/axirune-language-0.4.0-alpha.2.tgz">Compiler + LSP</a>
          <a href="/downloads/axirune-0.4.0-alpha.2.vsix">VS Code extension</a>
          <a href="https://github.com/sczhui/axirune" target="_blank" rel="noreferrer">
            GitHub source <ArrowUpRight size={13} />
          </a>
          <Link to="/download">Docker deployment</Link>
        </div>
      </div>
      <div className="site-footer__base">
        <span>© 2026 AXIRUNE LANGUAGE PROJECT</span>
        <span>{locale === 'zh' ? '确定性通用核心 · AI 可选' : 'DETERMINISTIC GENERAL CORE · OPTIONAL AI'}</span>
      </div>
    </footer>
  )
}

export function PageFrame({
  route,
  locale,
  onLocaleChange,
  children,
}: HeaderProps & { children: ReactNode }) {
  return (
    <div className="site-shell">
      <Header route={route} locale={locale} onLocaleChange={onLocaleChange} />
      <main id="main-content">{children}</main>
      <Footer locale={locale} />
    </div>
  )
}
