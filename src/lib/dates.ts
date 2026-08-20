export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

export function diffDays(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime()
  return Math.round(ms / 86400000)
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function todayISO(): string {
  return toISO(new Date())
}

/** Sunday-based week start */
export function startOfWeek(d: Date): Date {
  return addDays(startOfDay(d), -d.getDay())
}

export function formatShort(iso: string): string {
  const d = parseISO(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function formatWithDay(iso: string): string {
  const d = parseISO(iso)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
}

/** Calendar days past due. 0 when actual is on or before due. */
export function delayDays(dueDate: string, actualDate: string): number {
  if (!dueDate || !actualDate || actualDate <= dueDate) return 0
  return diffDays(parseISO(dueDate), parseISO(actualDate))
}
