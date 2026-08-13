import { TRACK_PALETTE } from './colors'
import { UNASSIGNED_ID, type Issue, type Member } from '../types'

export function normalizeAssignees(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of ids) {
    if (typeof x !== 'string' || !x || x === UNASSIGNED_ID || seen.has(x)) continue
    seen.add(x)
    out.push(x)
  }
  return out
}

export function issueMatchesPeople(issue: Issue, selectedIds: string[]): boolean {
  if (selectedIds.length === 0) return false
  const ids = issue.assigneeIds ?? []
  if (ids.length === 0) return selectedIds.includes(UNASSIGNED_ID)
  return ids.some((id) => selectedIds.includes(id))
}

export function personColor(id: string, people: Member[]): string {
  if (id === UNASSIGNED_ID) return '#6b778c'
  const idx = people.findIndex((p) => p.id === id)
  return TRACK_PALETTE[(idx >= 0 ? idx : people.length) % TRACK_PALETTE.length]
}

export function initials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  return trimmed.slice(0, 2)
}

export function personName(id: string, people: Member[]): string {
  if (id === UNASSIGNED_ID) return '미배정'
  return people.find((p) => p.id === id)?.displayName || '알 수 없음'
}
