import { Sun, Moon } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
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
      onClick={toggle}
      className="relative w-10 h-7 rounded-full transition-colors duration-300 flex items-center px-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ backgroundColor: dark ? 'var(--color-surface-overlay)' : 'var(--color-border)', outlineColor: 'var(--color-focus)' }}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span
        className="flex items-center justify-center w-5 h-5 rounded-full transition-transform duration-300"
        style={{
          transform: dark ? 'translateX(16px)' : 'translateX(0)',
          backgroundColor: 'var(--color-toggle-thumb)',
          boxShadow: '0 1px 3px var(--color-toggle-shadow)',
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
