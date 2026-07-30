import { useMemo, useRef, type CSSProperties, type UIEvent } from 'react'

type CodeEditorProps = {
  value: string
  onChange?: (value: string) => void
  label?: string
  readOnly?: boolean
  compact?: boolean
  minHeight?: number
  className?: string
}

export function CodeEditor({
  value,
  onChange,
  label = 'Axirune source editor',
  readOnly = false,
  compact = false,
  minHeight,
  className = '',
}: CodeEditorProps) {
  const gutterRef = useRef<HTMLDivElement>(null)
  const lineNumbers = useMemo(
    () => Array.from({ length: Math.max(1, value.split('\n').length) }, (_, index) => index + 1),
    [value],
  )

  const syncScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop
  }

  const style = minHeight ? ({ '--editor-min-height': `${minHeight}px` } as CSSProperties) : undefined

  return (
    <div
      className={`code-editor ${compact ? 'code-editor--compact' : ''} ${className}`}
      style={style}
    >
      <div className="code-editor__gutter" ref={gutterRef} aria-hidden="true">
        {lineNumbers.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
      <textarea
        className="code-editor__input"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        onScroll={syncScroll}
        aria-label={label}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
      />
    </div>
  )
}

export function StaticCode({ code, label = 'Axirune source code' }: { code: string; label?: string }) {
  return (
    <pre className="static-code" aria-label={label}>
      <code>{code}</code>
    </pre>
  )
}
