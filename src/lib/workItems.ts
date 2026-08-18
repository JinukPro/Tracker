import { addDays, diffDays, formatWithDay, parseISO, startOfWeek, toISO, todayISO } from './dates'
import { UNASSIGNED_ID, type Issue, type WorkItem } from '../types'

export type WorkRangePreset = 'today' | 'week' | 'soon' | 'custom'

export function newWorkItemId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function normalizeWorkItems(raw: unknown): WorkItem[] {
  if (!Array.isArray(raw)) return []
  const out: WorkItem[] = []
  const seen = new Set<string>()
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title.trim() : ''
    if (!title) continue
    let id = typeof o.id === 'string' ? o.id : ''
    if (!id || seen.has(id)) id = newWorkItemId()
    seen.add(id)
    const assigneeId = typeof o.assigneeId === 'string' && o.assigneeId ? o.assigneeId : undefined
    out.push({
      id,
      title,
      date: typeof o.date === 'string' ? o.date : '',
      done: Boolean(o.done),
      ...(assigneeId ? { assigneeId } : {}),
    })
  }
  return out
}

export function remapWorkItemAssignees(
  items: WorkItem[],
  remap: (id: string) => string,
): WorkItem[] {
  return items.map((w) =>
    w.assigneeId ? { ...w, assigneeId: remap(w.assigneeId) } : w,
  )
}

/** Who should see this item in the person-grouped 단위업무 tab. */
export function workItemOwnerIds(issue: Pick<Issue, 'assigneeIds'>, item: WorkItem): string[] {
  if (item.assigneeId) return [item.assigneeId]
  if (issue.assigneeIds.length > 0) return issue.assigneeIds
  return [UNASSIGNED_ID]
}

export function workRangeBounds(
  preset: WorkRangePreset,
  customFrom: string,
  customTo: string,
  today = todayISO(),
): { from: string; to: string } {
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'week') {
    const start = toISO(startOfWeek(parseISO(today)))
    return { from: start, to: toISO(addDays(parseISO(start), 6)) }
  }
  if (preset === 'soon') return { from: today, to: toISO(addDays(parseISO(today), 6)) }
  const from = customFrom || today
  const to = customTo && customTo >= from ? customTo : from
  return { from, to }
}

export function defaultWorkItemDate(startDate: string, dueDate: string, today = todayISO()): string {
  if (startDate && today < startDate) return startDate
  if (dueDate && today > dueDate) return dueDate
  return today
}

export function formatWorkDate(iso: string, today = todayISO()): string {
  if (!iso) return '날짜 없음'
  if (iso === today) return '오늘'
  const delta = diffDays(parseISO(today), parseISO(iso))
  if (delta === 1) return '내일'
  if (delta === -1) return '어제'
  return formatWithDay(iso)
}

export function isWorkItemOverdue(item: WorkItem, today = todayISO()): boolean {
  return !item.done && Boolean(item.date) && item.date < today
}
