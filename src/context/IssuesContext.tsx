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
import * as svc from '../services/issues'
import type { Issue, IssueInput } from '../types'
import { useProjects } from './ProjectsContext'

type IssuesContextValue = {
  /** Issues of the currently selected projects */
  issues: Issue[]
  /** Every issue across all projects (settings/export/track suggestions) */
  allIssues: Issue[]
  loading: boolean
  tracks: string[]
  refresh: () => Promise<void>
  create: (input: IssueInput) => Promise<void>
  update: (id: string, patch: Partial<Issue>) => Promise<void>
  remove: (id: string) => Promise<void>
}

const IssuesContext = createContext<IssuesContextValue | null>(null)

export function IssuesProvider({ children }: { children: ReactNode }) {
  const { selectedIds, projectById } = useProjects()
  const [allIssues, setAllIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const list = await svc.listIssues()
    setAllIssues(list)
  }, [])

  useEffect(() => {
    let cancelled = false
    void initData().then(({ issues: list }) => {
      if (!cancelled) {
        setAllIssues(list)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Live-reload when data files are edited externally (e.g. from Cursor)
  useEffect(() => {
    const hot = import.meta.hot
    if (!hot) return
    const handler = () => void refresh()
    hot.on('data-file-changed', handler)
    return () => hot.off('data-file-changed', handler)
  }, [refresh])

  const create = useCallback(
    async (input: IssueInput) => {
      const prefix = projectById(input.projectId)?.keyPrefix ?? 'T'
      await svc.createIssue(input, svc.nextKey(allIssues, input.projectId, prefix))
      await refresh()
    },
    [allIssues, projectById, refresh],
  )

  const update = useCallback(
    async (id: string, patch: Partial<Issue>) => {
      // Moving an issue to another project re-issues its key under the new prefix
      const current = allIssues.find((i) => i.id === id)
      let effective = patch
      if (patch.projectId && current && patch.projectId !== current.projectId) {
        const prefix = projectById(patch.projectId)?.keyPrefix ?? 'T'
        effective = { ...patch, key: svc.nextKey(allIssues, patch.projectId, prefix) }
      }
      // Optimistic update keeps drag & drop and checkbox toggles snappy
      setAllIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...effective } : i)))
      await svc.updateIssue(id, effective)
      await refresh()
    },
    [allIssues, projectById, refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      setAllIssues((prev) => prev.filter((i) => i.id !== id))
      await svc.deleteIssue(id)
      await refresh()
    },
    [refresh],
  )

  const issues = useMemo(
    () => allIssues.filter((i) => selectedIds.includes(i.projectId)),
    [allIssues, selectedIds],
  )

  const tracks = useMemo(() => {
    const seen: string[] = []
    for (const i of issues) {
      if (!seen.includes(i.track)) seen.push(i.track)
    }
    return seen
  }, [issues])

  const value = useMemo(
    () => ({ issues, allIssues, loading, tracks, refresh, create, update, remove }),
    [issues, allIssues, loading, tracks, refresh, create, update, remove],
  )

  return <IssuesContext.Provider value={value}>{children}</IssuesContext.Provider>
}

export function useIssues(): IssuesContextValue {
  const ctx = useContext(IssuesContext)
  if (!ctx) throw new Error('useIssues must be used within IssuesProvider')
  return ctx
}
