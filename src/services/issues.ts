import { addOne, listAll, removeOne, setAll, updateOne, type StoredDoc } from '../lib/store'
import { normalizeAssignees } from '../lib/people'
import type { Deliverable, Issue, IssueInput } from '../types'

const COL = 'trackerIssues'

function mapIssue(d: StoredDoc): Issue {
  return {
    id: d.id,
    key: (d.key as string) ?? '',
    projectId: (d.projectId as string) ?? '',
    track: (d.track as string) ?? '',
    title: (d.title as string) ?? '',
    description: (d.description as string) ?? '',
    status: (d.status as Issue['status']) ?? 'todo',
    priority: (d.priority as Issue['priority']) ?? 'medium',
    startDate: (d.startDate as string) ?? '',
    dueDate: (d.dueDate as string) ?? '',
    deliverables: (d.deliverables as Deliverable[]) ?? [],
    assigneeIds: normalizeAssignees(d.assigneeIds),
    createdAt: (d.createdAt as string) ?? '',
    updatedAt: (d.updatedAt as string) ?? '',
  }
}

export async function listIssues(): Promise<Issue[]> {
  const docs = await listAll(COL)
  return docs.map(mapIssue).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.key.localeCompare(b.key))
}

export function nextKey(existing: Issue[], projectId: string, prefix: string): string {
  const max = existing
    .filter((i) => i.projectId === projectId)
    .reduce((acc, i) => {
      const n = Number(i.key.slice(i.key.lastIndexOf('-') + 1))
      return Number.isFinite(n) && n > acc ? n : acc
    }, 0)
  return `${prefix}-${max + 1}`
}

export async function createIssue(input: IssueInput, key: string): Promise<string> {
  const now = new Date().toISOString()
  return addOne(COL, {
    ...input,
    assigneeIds: normalizeAssignees(input.assigneeIds),
    key,
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateIssue(id: string, patch: Partial<Issue>): Promise<void> {
  const next: Partial<Issue> & { updatedAt: string } = { ...patch, updatedAt: new Date().toISOString() }
  if (patch.assigneeIds) next.assigneeIds = normalizeAssignees(patch.assigneeIds)
  await updateOne(COL, id, next)
}

export async function deleteIssue(id: string): Promise<void> {
  await removeOne(COL, id)
}

export async function deleteIssuesByProject(projectId: string): Promise<void> {
  const docs = await listAll(COL)
  for (const d of docs) {
    if ((d.projectId as string) === projectId) await removeOne(COL, d.id)
  }
}

/** Replace the whole issue set in one write (seeding / reset / import). */
export async function replaceAllIssues(items: { key: string; input: IssueInput }[]): Promise<void> {
  const now = new Date().toISOString()
  await setAll(
    COL,
    items.map(({ key, input }) => ({
      ...input,
      assigneeIds: normalizeAssignees(input.assigneeIds),
      key,
      createdAt: now,
      updatedAt: now,
    })),
  )
}
