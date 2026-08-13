import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { personColor as colorOf } from '../lib/people'
import * as svc from '../services/members'
import { GROUP_BY_ORDER, UNASSIGNED_ID, type GroupBy, type Member } from '../types'
import { useAuth } from './AuthContext'

const GROUP_KEY = 'tracker:groupBy'
const SELECT_KEY = 'tracker:selectedPeople'

type StoredSelection = { ids: string[]; selectAll: boolean }

type PeopleContextValue = {
  people: Member[]
  loading: boolean
  groupBy: GroupBy
  setGroupBy: (next: GroupBy) => void
  selectedIds: string[]
  selectionReady: boolean
  togglePerson: (id: string) => void
  personById: (id: string) => Member | undefined
  personColor: (id: string) => string
  refresh: () => Promise<void>
  addMember: (displayName: string) => Promise<string>
  editMember: (id: string, displayName: string) => Promise<void>
  removeMember: (id: string) => Promise<void>
}

const PeopleContext = createContext<PeopleContextValue | null>(null)

function loadGroupBy(): GroupBy {
  const raw = localStorage.getItem(GROUP_KEY)
  return GROUP_BY_ORDER.includes(raw as GroupBy) ? (raw as GroupBy) : 'project'
}

function loadSelection(): StoredSelection | null {
  try {
    const raw = localStorage.getItem(SELECT_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as { ids?: unknown; selectAll?: unknown }
      if (Array.isArray(obj.ids)) {
        return { ids: obj.ids.filter((x) => typeof x === 'string'), selectAll: Boolean(obj.selectAll) }
      }
    }
    if (Array.isArray(parsed)) return { ids: parsed as string[], selectAll: false }
    return null
  } catch {
    return null
  }
}

export function PeopleProvider({ children }: { children: ReactNode }) {
  const { user, localMode } = useAuth()
  const [people, setPeople] = useState<Member[]>([])
  const [groupBy, setGroupByState] = useState<GroupBy>(loadGroupBy)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(true)
  const [loading, setLoading] = useState(true)

  const authReady = localMode || Boolean(user)

  const allIds = useMemo(() => [UNASSIGNED_ID, ...people.map((p) => p.id)], [people])

  const refresh = useCallback(async () => {
    const list = await svc.listPeople()
    setPeople(list)
    const ids = [UNASSIGNED_ID, ...list.map((p) => p.id)]
    setSelectedIds((prev) => {
      if (selectAll) return ids
      return prev.filter((id) => ids.includes(id))
    })
  }, [selectAll])

  useEffect(() => {
    if (!authReady) return
    let cancelled = false
    svc
      .listPeople()
      .then((list) => {
        if (cancelled) return
        setPeople(list)
        const ids = [UNASSIGNED_ID, ...list.map((p) => p.id)]
        const stored = loadSelection()
        if (stored === null || stored.selectAll) {
          setSelectedIds(ids)
          setSelectAll(true)
        } else {
          const valid = stored.ids.filter((id) => ids.includes(id))
          setSelectedIds(valid)
          setSelectAll(valid.length === ids.length)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error('담당자 목록 불러오기 실패:', err)
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [authReady])

  useEffect(() => {
    const hot = import.meta.hot
    if (!hot) return
    const handler = () => void refresh()
    hot.on('data-file-changed', handler)
    return () => hot.off('data-file-changed', handler)
  }, [refresh])

  useEffect(() => {
    if (loading) return
    localStorage.setItem(SELECT_KEY, JSON.stringify({ ids: selectedIds, selectAll }))
  }, [selectedIds, selectAll, loading])

  const setGroupBy = useCallback((next: GroupBy) => {
    setGroupByState(next)
    localStorage.setItem(GROUP_KEY, next)
  }, [])

  const togglePerson = useCallback(
    (id: string) => {
      const current = selectAll ? allIds : selectedIds
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
      setSelectedIds(next)
      setSelectAll(next.length === allIds.length && allIds.every((x) => next.includes(x)))
    },
    [allIds, selectAll, selectedIds],
  )

  const personById = useCallback((id: string) => people.find((p) => p.id === id), [people])

  const personColor = useCallback((id: string) => colorOf(id, people), [people])

  const addMember = useCallback(
    async (displayName: string) => {
      const id = await svc.createMember(displayName)
      await refresh()
      setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      return id
    },
    [refresh],
  )

  const editMember = useCallback(
    async (id: string, displayName: string) => {
      await svc.updateMember(id, { displayName: displayName.trim() })
      await refresh()
    },
    [refresh],
  )

  const removeMember = useCallback(
    async (id: string) => {
      await svc.deleteMember(id)
      await refresh()
    },
    [refresh],
  )

  const effectiveIds = selectAll ? allIds : selectedIds

  const value = useMemo(
    () => ({
      people,
      loading,
      groupBy,
      setGroupBy,
      selectedIds: effectiveIds,
      selectionReady: !loading,
      togglePerson,
      personById,
      personColor,
      refresh,
      addMember,
      editMember,
      removeMember,
    }),
    [
      people,
      loading,
      groupBy,
      setGroupBy,
      effectiveIds,
      togglePerson,
      personById,
      personColor,
      refresh,
      addMember,
      editMember,
      removeMember,
    ],
  )

  return <PeopleContext.Provider value={value}>{children}</PeopleContext.Provider>
}

export function usePeople(): PeopleContextValue {
  const ctx = useContext(PeopleContext)
  if (!ctx) throw new Error('usePeople must be used within PeopleProvider')
  return ctx
}
