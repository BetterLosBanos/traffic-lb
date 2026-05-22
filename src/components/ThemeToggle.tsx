import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof document === 'undefined') return false
    return document.documentElement.classList.contains('dark')
  })

  const applyTheme = (next: boolean) => {
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const mq = window.matchMedia('(prefers-color-scheme: dark)')

    if (!stored) {
      setDark(mq.matches)
      document.documentElement.classList.toggle('dark', mq.matches)
    }

    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        setDark(e.matches)
        document.documentElement.classList.toggle('dark', e.matches)
      }
    }

    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <button
      type="button"
      onClick={() => applyTheme(!dark)}
      className="h-8 w-8 rounded-md border flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-colors duration-150"
      style={{
        backgroundColor: dark ? 'var(--color-surface-raised)' : 'var(--color-surface-overlay)',
        borderColor: 'var(--color-border)',
        color: dark ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
        '--tw-ring-color': 'var(--color-focus)',
        '--tw-ring-offset-color': 'var(--color-surface)',
      } as React.CSSProperties}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark
        ? <Moon size={14} strokeWidth={2} aria-hidden="true" />
        : <Sun size={14} strokeWidth={2} aria-hidden="true" />
      }
    </button>
  )
}
