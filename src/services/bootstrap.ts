import seedIssuesJson from '../../data/issues.json'
import seedProjectsJson from '../../data/projects.json'
import { PROJECT_COLORS } from '../lib/colors'
import { normalizeAssignees } from '../lib/people'
import type { Issue, IssueInput, Member, Project } from '../types'
import * as issuesSvc from './issues'
import * as membersSvc from './members'
import * as projectsSvc from './projects'

const DEFAULT_PROJECT = { name: 'T뽑기', keyPrefix: 'T', color: PROJECT_COLORS[0] }

export type ExportData = { projects: Project[]; issues: Issue[]; members?: Member[] }

/**
 * Seed baked into the bundle at build time: whatever data/projects.json and
 * data/issues.json contained when the site was built (i.e. pushed to GitHub).
 */
const SEED: ExportData = {
  projects: seedProjectsJson as unknown as Project[],
  issues: seedIssuesJson as unknown as Issue[],
}

// --- init progress (what is currently loading), for the Loading UI ---

let initStage = ''
const stageListeners = new Set<() => void>()

function setStage(next: string): void {
  initStage = next
  for (const l of stageListeners) l()
}

export function getInitStage(): string {
  return initStage
}

export function subscribeInitStage(listener: () => void): () => void {
  stageListeners.add(listener)
  return () => {
    stageListeners.delete(listener)
  }
}

// Module-level lock so StrictMode's double-mounted effects run init only once
let initPromise: Promise<{ projects: Project[]; issues: Issue[] }> | null = null

export function initData(): Promise<{ projects: Project[]; issues: Issue[] }> {
  if (!initPromise) {
    initPromise = doInit().catch((err) => {
      // Drop the failed promise so a later call (e.g. after sign-in) retries
      initPromise = null
      throw err
    })
  }
  return initPromise
}

async function doInit(): Promise<{ projects: Project[]; issues: Issue[] }> {
  try {
    setStage('프로젝트 목록 불러오는 중')
    let projects = await projectsSvc.listProjects()
    setStage('일정 목록 불러오는 중')
    let issues = await issuesSvc.listIssues()

    if (projects.length === 0 && issues.length === 0) {
      // Empty store: never seed silently — tell the user and ask first
      if (SEED.projects.length === 0) {
        window.alert(
          '저장된 데이터가 없고, 빌드에 포함된 시드 데이터(data/projects.json·issues.json)도 비어 있습니다.\n빈 상태로 시작합니다. 설정에서 프로젝트를 추가하세요.',
        )
      } else if (
        window.confirm(
          `저장된 데이터가 비어 있습니다.\n시드 데이터(프로젝트 ${SEED.projects.length}개, 작업 ${SEED.issues.length}건)로 초기화할까요?`,
        )
      ) {
        setStage('시드 데이터 저장 중')
        await importData(SEED)
        projects = await projectsSvc.listProjects()
        issues = await issuesSvc.listIssues()
      }
    } else if (projects.length === 0) {
      // Legacy data: issues exist without any project — adopt them below
      setStage('기본 프로젝트 생성 중')
      await projectsSvc.createProject(DEFAULT_PROJECT)
      projects = await projectsSvc.listProjects()
    }

    // Migrate pre-multi-project issues into the default project
    if (projects.length > 0) {
      const defaultId = projects[0].id
      const orphans = issues.filter((i) => !i.projectId)
      if (orphans.length > 0) {
        setStage('이전 데이터 정리 중')
        for (const i of orphans) {
          await issuesSvc.updateIssue(i.id, { projectId: defaultId })
        }
        issues = await issuesSvc.listIssues()
      }
    }
    return { projects, issues }
  } finally {
    setStage('')
  }
}

/** Wipe everything: delete all projects and issues, leaving an empty store. */
export async function clearAllData(): Promise<void> {
  const existing = await projectsSvc.listProjects()
  for (const p of existing) await projectsSvc.deleteProject(p.id)
  await issuesSvc.replaceAllIssues([])
  await membersSvc.replaceAllMembers([])
}

/** Wipe everything and restore the seed baked into the build (data/*.json). */
export async function resetAllData(): Promise<void> {
  if (SEED.projects.length === 0) {
    window.alert('빌드에 포함된 시드 데이터가 비어 있어 초기화할 수 없습니다.')
    return
  }
  await importData(SEED)
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
          assigneeIds: normalizeAssignees(item.assigneeIds),
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
      tracks: p.tracks ?? [],
    })
    idMap.set(p.id, newId)
  }
  const fallback = idMap.values().next().value ?? ''

  const memberIdMap = new Map<string, string>()
  if (Array.isArray(data.members)) {
    await membersSvc.replaceAllMembers([])
    for (const m of data.members) {
      const newId = await membersSvc.createMember(m.displayName, m.email ?? '')
      memberIdMap.set(m.id, newId)
    }
  }

  await issuesSvc.replaceAllIssues(
    data.issues.map((item) => {
      const { id: _id, key, createdAt: _c, updatedAt: _u, ...rest } = item
      const input: IssueInput = {
        ...rest,
        projectId: idMap.get(item.projectId) ?? fallback,
        assigneeIds: normalizeAssignees(item.assigneeIds).map((id) => memberIdMap.get(id) ?? id),
      }
      return { key, input }
    }),
  )
  return { projects: data.projects.length, issues: data.issues.length }
}
