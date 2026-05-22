import { ReactNode } from 'react'
import { Check, AlertTriangle, AlertCircle, Info } from 'lucide-react'

export type StatusType = 'success' | 'warning' | 'danger' | 'info' | 'default'
export type StatusSize = 'sm' | 'md'

interface StatusBadgeProps {
  type?: StatusType
  size?: StatusSize
  children: ReactNode
  withIcon?: boolean
  className?: string
}

const typeStyles = {
  success: {
    borderColor: 'var(--color-border-success)',
    backgroundColor: 'var(--color-bg-success-weak)',
    color: 'var(--color-text-success)',
    icon: Check,
  },
  warning: {
    borderColor: 'var(--color-border-warning)',
    backgroundColor: 'var(--color-bg-warning-weak)',
    color: 'var(--color-text-warning)',
    icon: AlertTriangle,
  },
  danger: {
    borderColor: 'var(--color-border-danger)',
    backgroundColor: 'var(--color-bg-danger-weak)',
    color: 'var(--color-text-danger)',
    icon: AlertCircle,
  },
  info: {
    borderColor: 'var(--color-border-info)',
    backgroundColor: 'var(--color-bg-info-weak)',
    color: 'var(--color-text-info)',
    icon: Info,
  },
  default: {
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-bg-info-weak)',
    color: 'var(--color-text-secondary)',
    icon: Info,
  },
}

const sizeStyles = {
  sm: 'px-2 py-0.5 text-[10px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
}

export function StatusBadge({
  type = 'default',
  size = 'sm',
  children,
  withIcon = false,
  className = '',
}: StatusBadgeProps) {
  const styles = typeStyles[type]
  const Icon = styles.icon

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border font-semibold uppercase leading-none ${sizeStyles[size]} ${className}`}
      style={{
        borderColor: styles.borderColor,
        backgroundColor: styles.backgroundColor,
        color: styles.color,
      }}
      role="status"
    >
      {withIcon && <Icon size={size === 'sm' ? 10 : 12} aria-hidden="true" />}
      {children}
    </span>
  )
}
