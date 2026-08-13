import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { initData } from '../services/bootstrap'
import * as issuesSvc from '../services/issues'
import * as svc from '../services/projects'
import type { Project, ProjectInput } from '../types'
import { useAuth } from './AuthContext'

const SELECT_KEY = 'tracker:selectedProjects'

type ProjectsContextValue = {
  projects: Project[]
  loading: boolean
  /** Non-empty when initial data loading failed (e.g. Firestore permission-denied) */
  initError: string
  selectedIds: string[]
  selectedProjects: Project[]
  toggleProject: (id: string) => void
  projectById: (id: string) => Project | undefined
  refresh: () => Promise<void>
  addProject: (input: ProjectInput) => Promise<void>
  editProject: (id: string, patch: Partial<ProjectInput>) => Promise<void>
  addMembersToProject: (projectId: string, memberIds: string[]) => Promise<void>
  removeProject: (id: string) => Promise<void>
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null)

function loadSelection(): string[] | null {
  try {
    const raw = localStorage.getItem(SELECT_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return Array.isArray(parsed) ? (parsed as string[]) : null
  } catch {
    return null
  }
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { user, localMode } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [initError, setInitError] = useState('')

  // With Firebase, Firestore rules require auth, so wait for sign-in before
  // reading — otherwise the first query fails with permission-denied.
  const authReady = localMode || Boolean(user)

  useEffect(() => {
    if (!authReady) return
    let cancelled = false
    initData()
      .then(({ projects: list }) => {
        if (cancelled) return
        setProjects(list)
        const stored = loadSelection()
        const valid = (stored ?? []).filter((id) => list.some((p) => p.id === id))
        // Select everything when there is no saved selection, when the project
        // bar is hidden (single project), or when the saved ids no longer exist.
        // A saved empty selection (user deselected all) is kept as-is.
        const invalidated = stored !== null && stored.length > 0 && valid.length === 0
        setSelectedIds(
          stored === null || list.length <= 1 || invalidated ? list.map((p) => p.id) : valid,
        )
        setInitError('')
        setLoading(false)
      })
      .catch((err) => {
        console.error('프로젝트 초기화 실패:', err)
        if (!cancelled) {
          setInitError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [authReady])

  useEffect(() => {
    if (!loading) localStorage.setItem(SELECT_KEY, JSON.stringify(selectedIds))
  }, [selectedIds, loading])

  const refresh = useCallback(async () => {
    const list = await svc.listProjects()
    setProjects(list)
    setSelectedIds((prev) => {
      const valid = prev.filter((id) => list.some((p) => p.id === id))
      // Reset to all only when the selection was invalidated (e.g. import
      // recreated projects with new ids) or the project bar is hidden.
      if (list.length <= 1 || (prev.length > 0 && valid.length === 0)) {
        return list.map((p) => p.id)
      }
      return valid
    })
  }, [])

  // Live-reload when data files are edited externally (e.g. from Cursor)
  useEffect(() => {
    const hot = import.meta.hot
    if (!hot) return
    const handler = () => void refresh()
    hot.on('data-file-changed', handler)
    return () => hot.off('data-file-changed', handler)
  }, [refresh])

  const toggleProject = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const projectById = useCallback(
    (id: string) => projects.find((p) => p.id === id),
    [projects],
  )

  const addProject = useCallback(
    async (input: ProjectInput) => {
      const id = await svc.createProject(input)
      await refresh()
      setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    },
    [refresh],
  )

  const editProject = useCallback(
    async (id: string, patch: Partial<ProjectInput>) => {
      await svc.updateProject(id, patch)
      await refresh()
    },
    [refresh],
  )

  const addMembersToProject = useCallback(
    async (projectId: string, memberIds: string[]) => {
      const changed = await svc.addMembersToProject(projectId, memberIds)
      if (changed) await refresh()
    },
    [refresh],
  )

  const removeProject = useCallback(
    async (id: string) => {
      await issuesSvc.deleteIssuesByProject(id)
      await svc.deleteProject(id)
      await refresh()
    },
    [refresh],
  )

  const selectedProjects = useMemo(
    () => projects.filter((p) => selectedIds.includes(p.id)),
    [projects, selectedIds],
  )

  const value = useMemo(
    () => ({
      projects,
      loading,
      initError,
      selectedIds,
      selectedProjects,
      toggleProject,
      projectById,
      refresh,
      addProject,
      editProject,
      addMembersToProject,
      removeProject,
    }),
    [
      projects,
      loading,
      initError,
      selectedIds,
      selectedProjects,
      toggleProject,
      projectById,
      refresh,
      addProject,
      editProject,
      addMembersToProject,
      removeProject,
    ],
  )

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext)
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider')
  return ctx
}
