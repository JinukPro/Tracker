import { delayDays, formatShort, todayISO } from './dates'
import type { Issue } from '../types'

export function issueDelayDays(
  issue: Pick<Issue, 'status' | 'dueDate' | 'completedDate'>,
  today = todayISO(),
): number {
  if (issue.status === 'done') return delayDays(issue.dueDate, issue.completedDate ?? '')
  return delayDays(issue.dueDate, today)
}

export function isOverdue(
  issue: Pick<Issue, 'status' | 'dueDate' | 'completedDate'>,
  today = todayISO(),
): boolean {
  return issue.status !== 'done' && issueDelayDays(issue, today) > 0
}

export function isLateDone(issue: Pick<Issue, 'status' | 'dueDate' | 'completedDate'>): boolean {
  return issue.status === 'done' && issueDelayDays(issue) > 0
}

/** Last day the issue occupies on charts (completedDate when finished late). */
export function issueSpanEnd(issue: Pick<Issue, 'status' | 'dueDate' | 'completedDate'>): string {
  return isLateDone(issue) && issue.completedDate ? issue.completedDate : issue.dueDate
}

export function issueDateTip(
  issue: Pick<Issue, 'key' | 'title' | 'status' | 'startDate' | 'dueDate' | 'completedDate'>,
  today = todayISO(),
): string {
  const delay = issueDelayDays(issue, today)
  const planned = `${formatShort(issue.startDate)}~${formatShort(issue.dueDate)}`
  if (isLateDone(issue) && issue.completedDate) {
    return `${issue.key} ${issue.title} (${planned} → ${formatShort(issue.completedDate)} D+${delay})`
  }
  if (isOverdue(issue, today)) {
    return `${issue.key} ${issue.title} (${planned} D+${delay})`
  }
  return `${issue.key} ${issue.title} (${planned})`
}

/** Fill or clear completedDate when status changes. Keeps an explicit date from the caller. */
export function withCompletedDate<T extends Partial<Pick<Issue, 'status' | 'completedDate'>>>(
  patch: T,
  current?: Pick<Issue, 'status' | 'completedDate'>,
  today = todayISO(),
): T {
  const nextStatus = patch.status ?? current?.status
  if (nextStatus !== 'done') {
    if (patch.status !== undefined) return { ...patch, completedDate: '' }
    return patch
  }

  const explicit = patch.completedDate?.trim()
  if (explicit) return patch
  const existing = current?.completedDate?.trim()
  if (existing) return { ...patch, completedDate: existing }
  // Already done with no recorded date: do not invent one
  if (current?.status === 'done') return { ...patch, completedDate: '' }
  return { ...patch, completedDate: today }
}
