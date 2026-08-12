import { buildSeedIssues } from '../data/seed'
import { PROJECT_COLORS } from '../lib/colors'
import type { Issue, IssueInput, Project } from '../types'
import * as issuesSvc from './issues'
import * as projectsSvc from './projects'

const DEFAULT_PROJECT = { name: 'T뽑기', keyPrefix: 'T', color: PROJECT_COLORS[0] }

export type ExportData = { projects: Project[]; issues: Issue[] }

function seedItems(projectId: string): { key: string; input: IssueInput }[] {
  return buildSeedIssues(projectId).map((input, i) => ({ key: `T-${i + 1}`, input }))
}

// Module-level lock so StrictMode's double-mounted effects run init only once
let initPromise: Promise<{ projects: Project[]; issues: Issue[] }> | null = null

export function initData(): Promise<{ projects: Project[]; issues: Issue[] }> {
  if (!initPromise) initPromise = doInit()
  return initPromise
}

async function doInit(): Promise<{ projects: Project[]; issues: Issue[] }> {
  let projects = await projectsSvc.listProjects()
  if (projects.length === 0) {
    await projectsSvc.createProject(DEFAULT_PROJECT)
    projects = await projectsSvc.listProjects()
  }
  const defaultId = projects[0].id

  let issues = await issuesSvc.listIssues()
  if (issues.length === 0) {
    // First run: populate with the real project schedule
    await issuesSvc.replaceAllIssues(seedItems(defaultId))
    issues = await issuesSvc.listIssues()
  } else {
    // Migrate pre-multi-project issues into the default project
    const orphans = issues.filter((i) => !i.projectId)
    if (orphans.length > 0) {
      for (const i of orphans) {
        await issuesSvc.updateIssue(i.id, { projectId: defaultId })
      }
      issues = await issuesSvc.listIssues()
    }
  }
  return { projects, issues }
}

/** Wipe everything and restore the T뽑기 project with its seed schedule. */
export async function resetAllData(): Promise<void> {
  const projects = await projectsSvc.listProjects()
  for (const p of projects) await projectsSvc.deleteProject(p.id)
  await projectsSvc.createProject(DEFAULT_PROJECT)
  const [project] = await projectsSvc.listProjects()
  await issuesSvc.replaceAllIssues(seedItems(project.id))
}

/**
 * Import a JSON backup.
 * - New format `{ projects, issues }`: replaces projects and issues, remapping
 *   issue.projectId to the newly created project ids.
 * - Legacy format `Issue[]`: replaces issues only; issues whose projectId is
 *   unknown fall back to the first existing project.
 */
export async function importData(parsed: unknown): Promise<{ projects: number; issues: number }> {
  if (Array.isArray(parsed)) {
    const items = parsed as Issue[]
    if (items.some((i) => !i.title || !i.startDate)) throw new Error('invalid')
    const projects = await projectsSvc.listProjects()
    const validIds = new Set(projects.map((p) => p.id))
    const fallback = projects[0]?.id ?? ''
    await issuesSvc.replaceAllIssues(
      items.map((item) => {
        const { id: _id, key, createdAt: _c, updatedAt: _u, ...rest } = item
        const input: IssueInput = {
          ...rest,
          projectId: validIds.has(item.projectId) ? item.projectId : fallback,
        }
        return { key, input }
      }),
    )
    return { projects: projects.length, issues: items.length }
  }

  const data = parsed as ExportData
  if (
    !data ||
    !Array.isArray(data.projects) ||
    !Array.isArray(data.issues) ||
    data.projects.length === 0 ||
    data.issues.some((i) => !i.title || !i.startDate)
  ) {
    throw new Error('invalid')
  }

  const existing = await projectsSvc.listProjects()
  for (const p of existing) await projectsSvc.deleteProject(p.id)

  const idMap = new Map<string, string>()
  for (const p of data.projects) {
    const newId = await projectsSvc.createProject({
      name: p.name,
      keyPrefix: p.keyPrefix || 'P',
      color: p.color || PROJECT_COLORS[0],
    })
    idMap.set(p.id, newId)
  }
  const fallback = idMap.values().next().value ?? ''

  await issuesSvc.replaceAllIssues(
    data.issues.map((item) => {
      const { id: _id, key, createdAt: _c, updatedAt: _u, ...rest } = item
      const input: IssueInput = {
        ...rest,
        projectId: idMap.get(item.projectId) ?? fallback,
      }
      return { key, input }
    }),
  )
  return { projects: data.projects.length, issues: data.issues.length }
}
