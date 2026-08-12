import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { buildSeedIssues } from '../data/seed'
import * as svc from '../services/issues'
import type { Issue, IssueInput } from '../types'

type IssuesContextValue = {
  issues: Issue[]
  loading: boolean
  tracks: string[]
  refresh: () => Promise<void>
  create: (input: IssueInput) => Promise<void>
  update: (id: string, patch: Partial<Issue>) => Promise<void>
  remove: (id: string) => Promise<void>
  resetToSeed: () => Promise<void>
  importIssues: (items: Issue[]) => Promise<void>
}

const IssuesContext = createContext<IssuesContextValue | null>(null)

function seedItems(): { key: string; input: IssueInput }[] {
  return buildSeedIssues().map((input, i) => ({ key: `T-${i + 1}`, input }))
}

// Module-level lock so StrictMode's double-mounted effect runs init only once
let initPromise: Promise<Issue[]> | null = null

async function initOnce(): Promise<Issue[]> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    let list = await svc.listIssues()
    // First run: populate with the real project schedule
    if (list.length === 0) {
      await svc.replaceAllIssues(seedItems())
      list = await svc.listIssues()
    }
    return list
  })()
  return initPromise
}

export function IssuesProvider({ children }: { children: ReactNode }) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const list = await svc.listIssues()
    setIssues(list)
  }, [])

  useEffect(() => {
    let cancelled = false
    void initOnce().then((list) => {
      if (!cancelled) {
        setIssues(list)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Live-reload when data/issues.json is edited externally (e.g. from Cursor)
  useEffect(() => {
    const hot = import.meta.hot
    if (!hot) return
    const handler = () => void refresh()
    hot.on('issues-file-changed', handler)
    return () => hot.off('issues-file-changed', handler)
  }, [refresh])

  const create = useCallback(
    async (input: IssueInput) => {
      await svc.createIssue(input, svc.nextKey(issues))
      await refresh()
    },
    [issues, refresh],
  )

  const update = useCallback(
    async (id: string, patch: Partial<Issue>) => {
      // Optimistic update keeps drag & drop and checkbox toggles snappy
      setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
      await svc.updateIssue(id, patch)
      await refresh()
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      setIssues((prev) => prev.filter((i) => i.id !== id))
      await svc.deleteIssue(id)
      await refresh()
    },
    [refresh],
  )

  const resetToSeed = useCallback(async () => {
    await svc.replaceAllIssues(seedItems())
    await refresh()
  }, [refresh])

  const importIssues = useCallback(
    async (items: Issue[]) => {
      await svc.replaceAllIssues(
        items.map((item) => {
          const { id: _id, key, createdAt: _c, updatedAt: _u, ...input } = item
          return { key, input: input as IssueInput }
        }),
      )
      await refresh()
    },
    [refresh],
  )

  const tracks = useMemo(() => {
    const seen: string[] = []
    for (const i of issues) {
      if (!seen.includes(i.track)) seen.push(i.track)
    }
    return seen
  }, [issues])

  const value = useMemo(
    () => ({ issues, loading, tracks, refresh, create, update, remove, resetToSeed, importIssues }),
    [issues, loading, tracks, refresh, create, update, remove, resetToSeed, importIssues],
  )

  return <IssuesContext.Provider value={value}>{children}</IssuesContext.Provider>
}

export function useIssues(): IssuesContextValue {
  const ctx = useContext(IssuesContext)
  if (!ctx) throw new Error('useIssues must be used within IssuesProvider')
  return ctx
}
