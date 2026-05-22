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
      className="relative flex h-8 w-10 items-center rounded-md border px-0.5 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        backgroundColor: 'var(--color-surface-overlay)',
        borderColor: 'var(--color-border)',
        '--tw-ring-color': 'var(--color-focus)',
        '--tw-ring-offset-color': 'var(--color-surface)',
      } as React.CSSProperties}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded-[4px] transition-transform duration-300"
        style={{
          transform: dark ? 'translateX(16px)' : 'translateX(0)',
          backgroundColor: 'var(--color-surface-raised)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}
      >
        {dark
          ? <Moon size={11} color="var(--color-toggle-icon-moon)" strokeWidth={2.5} />
          : <Sun size={11} color="var(--color-toggle-icon-sun)" strokeWidth={2.5} />
        }
      </span>
    </button>
  )
}
