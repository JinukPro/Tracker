import { addOne, listAll, removeOne, updateOne, type StoredDoc } from '../lib/store'
import { normalizeAssignees } from '../lib/people'
import type { Issue, Project, ProjectInput } from '../types'

const COL = 'trackerProjects'

function mapProject(d: StoredDoc): Project {
  return {
    id: d.id,
    name: (d.name as string) ?? '',
    keyPrefix: (d.keyPrefix as string) ?? 'T',
    color: (d.color as string) ?? '#0052cc',
    tracks: (d.tracks as string[]) ?? [],
    memberIds: normalizeAssignees(d.memberIds),
    createdAt: (d.createdAt as string) ?? '',
  }
}

export async function listProjects(): Promise<Project[]> {
  const docs = await listAll(COL)
  return docs
    .map(mapProject)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name))
}

export async function createProject(input: ProjectInput): Promise<string> {
  return addOne(COL, {
    ...input,
    tracks: input.tracks ?? [],
    memberIds: normalizeAssignees(input.memberIds),
    createdAt: new Date().toISOString(),
  })
}

export async function updateProject(id: string, patch: Partial<ProjectInput>): Promise<void> {
  const next = { ...patch }
  if (patch.memberIds !== undefined) next.memberIds = normalizeAssignees(patch.memberIds)
  await updateOne(COL, id, next)
}

export async function deleteProject(id: string): Promise<void> {
  await removeOne(COL, id)
}

/** Write memberIds onto projects that predate the field, using issue assignees. */
export async function seedMissingMemberIds(issues: Issue[]): Promise<boolean> {
  const docs = await listAll(COL)
  let changed = false
  for (const d of docs) {
    if ('memberIds' in d) continue
    const memberIds = normalizeAssignees(
      issues.filter((i) => i.projectId === d.id).flatMap((i) => i.assigneeIds),
    )
    await updateOne(COL, d.id, { memberIds })
    changed = true
  }
  return changed
}

/** Returns true when the project's member list actually changed. */
export async function addMembersToProject(projectId: string, memberIds: string[]): Promise<boolean> {
  const added = normalizeAssignees(memberIds)
  if (!projectId || added.length === 0) return false
  const p = (await listProjects()).find((x) => x.id === projectId)
  if (!p) return false
  const next = normalizeAssignees([...p.memberIds, ...added])
  if (next.length === p.memberIds.length) return false
  await updateProject(projectId, { memberIds: next })
  return true
}
