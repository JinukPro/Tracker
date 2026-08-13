import { TRACK_PALETTE } from './colors'
import { UNASSIGNED_ID, type Issue, type Member, type Project } from '../types'

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

export function memberIdsOf(project: Pick<Project, 'memberIds'> | undefined): string[] {
  return normalizeAssignees(project?.memberIds)
}

/** Declared project members, plus anyone already assigned on those projects' issues. */
export function rosterIdsForProjects(
  projects: Pick<Project, 'id' | 'memberIds'>[],
  issues: Pick<Issue, 'projectId' | 'assigneeIds'>[] = [],
): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  const projectIds = new Set(projects.map((p) => p.id))
  function add(id: string) {
    if (!id || seen.has(id)) return
    seen.add(id)
    ids.push(id)
  }
  for (const p of projects) {
    for (const id of memberIdsOf(p)) add(id)
  }
  for (const i of issues) {
    if (!projectIds.has(i.projectId)) continue
    for (const id of i.assigneeIds ?? []) add(id)
  }
  return ids
}

export function peopleForProjects(
  people: Member[],
  projects: Pick<Project, 'id' | 'memberIds'>[],
  issues: Pick<Issue, 'projectId' | 'assigneeIds'>[] = [],
): Member[] {
  const ids = new Set(rosterIdsForProjects(projects, issues))
  return people.filter((p) => ids.has(p.id))
}
