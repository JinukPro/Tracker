import { addOne, listAll, removeOne, setAll, updateOne, type StoredDoc } from '../lib/store'
import type { Deliverable, Issue, IssueInput } from '../types'

const COL = 'trackerIssues'

function mapIssue(d: StoredDoc): Issue {
  return {
    id: d.id,
    key: (d.key as string) ?? '',
    track: (d.track as string) ?? '',
    title: (d.title as string) ?? '',
    description: (d.description as string) ?? '',
    status: (d.status as Issue['status']) ?? 'todo',
    priority: (d.priority as Issue['priority']) ?? 'medium',
    startDate: (d.startDate as string) ?? '',
    dueDate: (d.dueDate as string) ?? '',
    deliverables: (d.deliverables as Deliverable[]) ?? [],
    createdAt: (d.createdAt as string) ?? '',
    updatedAt: (d.updatedAt as string) ?? '',
  }
}

export async function listIssues(): Promise<Issue[]> {
  const docs = await listAll(COL)
  return docs.map(mapIssue).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.key.localeCompare(b.key))
}

export function nextKey(existing: Issue[]): string {
  const max = existing.reduce((acc, i) => {
    const n = Number(i.key.split('-')[1])
    return Number.isFinite(n) && n > acc ? n : acc
  }, 0)
  return `T-${max + 1}`
}

export async function createIssue(input: IssueInput, key: string): Promise<string> {
  const now = new Date().toISOString()
  return addOne(COL, { ...input, key, createdAt: now, updatedAt: now })
}

export async function updateIssue(id: string, patch: Partial<Issue>): Promise<void> {
  await updateOne(COL, id, { ...patch, updatedAt: new Date().toISOString() })
}

export async function deleteIssue(id: string): Promise<void> {
  await removeOne(COL, id)
}

/** Replace the whole issue set in one write (seeding / reset / import). */
export async function replaceAllIssues(items: { key: string; input: IssueInput }[]): Promise<void> {
  const now = new Date().toISOString()
  await setAll(
    COL,
    items.map(({ key, input }) => ({ ...input, key, createdAt: now, updatedAt: now })),
  )
}
