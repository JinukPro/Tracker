import { addOne, listAll, removeOne, updateOne, type StoredDoc } from '../lib/store'
import type { Project, ProjectInput } from '../types'

const COL = 'trackerProjects'

function mapProject(d: StoredDoc): Project {
  return {
    id: d.id,
    name: (d.name as string) ?? '',
    keyPrefix: (d.keyPrefix as string) ?? 'T',
    color: (d.color as string) ?? '#0052cc',
    tracks: (d.tracks as string[]) ?? [],
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
  return addOne(COL, { ...input, createdAt: new Date().toISOString() })
}

export async function updateProject(id: string, patch: Partial<ProjectInput>): Promise<void> {
  await updateOne(COL, id, patch)
}

export async function deleteProject(id: string): Promise<void> {
  await removeOne(COL, id)
}
