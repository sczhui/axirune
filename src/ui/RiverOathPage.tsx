import type { Locale } from '../content/site'
import { RiverOathShowcase } from './arcade/RiverOathShowcase'

export function RiverOathPage({ locale }: { locale: Locale }) {
  return (
    <div className="river-oath-route">
      <RiverOathShowcase locale={locale} />
    </div>
  )
}
