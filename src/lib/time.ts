export function ageText(iso: string | null | undefined): string {
  if (!iso) return ''

  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ''

  const mins = Math.max(0, Math.floor(ms / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
}

export function durationSinceText(iso: string | null | undefined): string {
  if (!iso) return ''

  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''

  const mins = Math.floor(ms / 60000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`

  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  if (hours < 24) return remainingMins === 0 ? `${hours}h` : `${hours}h ${remainingMins}m`

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours === 0 ? `${days}d` : `${days}d ${remainingHours}h`
}
