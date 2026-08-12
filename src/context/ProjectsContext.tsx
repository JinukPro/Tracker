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

const SELECT_KEY = 'tracker:selectedProjects'

type ProjectsContextValue = {
  projects: Project[]
  loading: boolean
  selectedIds: string[]
  selectedProjects: Project[]
  toggleProject: (id: string) => void
  projectById: (id: string) => Project | undefined
  refresh: () => Promise<void>
  addProject: (input: ProjectInput) => Promise<void>
  editProject: (id: string, patch: Partial<ProjectInput>) => Promise<void>
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
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void initData().then(({ projects: list }) => {
      if (cancelled) return
      setProjects(list)
      const stored = loadSelection()
      const valid = stored?.filter((id) => list.some((p) => p.id === id)) ?? []
      setSelectedIds(valid.length > 0 ? valid : list.map((p) => p.id))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!loading) localStorage.setItem(SELECT_KEY, JSON.stringify(selectedIds))
  }, [selectedIds, loading])

  const refresh = useCallback(async () => {
    const list = await svc.listProjects()
    setProjects(list)
    setSelectedIds((prev) => {
      const valid = prev.filter((id) => list.some((p) => p.id === id))
      return valid.length > 0 ? valid : list.map((p) => p.id)
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
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        // Keep at least one project selected
        return prev.length > 1 ? prev.filter((x) => x !== id) : prev
      }
      return [...prev, id]
    })
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
      selectedIds,
      selectedProjects,
      toggleProject,
      projectById,
      refresh,
      addProject,
      editProject,
      removeProject,
    }),
    [
      projects,
      loading,
      selectedIds,
      selectedProjects,
      toggleProject,
      projectById,
      refresh,
      addProject,
      editProject,
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
