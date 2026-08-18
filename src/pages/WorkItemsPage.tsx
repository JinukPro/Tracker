import { useMemo, useState } from 'react'
import { IssueModal } from '../components/IssueModal'
import { Loading } from '../components/Loading'
import { useAuth } from '../context/AuthContext'
import { useIssues } from '../context/IssuesContext'
import { usePeople } from '../context/PeopleContext'
import { useProjects } from '../context/ProjectsContext'
import { trackColor } from '../lib/colors'
import { formatShort, todayISO } from '../lib/dates'
import { issueMatchesPeople, personColor, personName } from '../lib/people'
import {
  formatWorkDate,
  isWorkItemOverdue,
  newWorkItemId,
  workItemOwnerIds,
  workRangeBounds,
  type WorkRangePreset,
} from '../lib/workItems'
import { UNASSIGNED_ID, type Issue, type WorkItem } from '../types'

const RANGE_LABELS: { id: WorkRangePreset; label: string }[] = [
  { id: 'today', label: '오늘' },
  { id: 'week', label: '이번 주' },
  { id: 'soon', label: '앞으로 7일' },
  { id: 'custom', label: '기간 지정' },
]

type IssueBlock = {
  issue: Issue
  items: WorkItem[]
}

type PersonGroup = {
  key: string
  label: string
  color: string
  total: number
  done: number
  list: IssueBlock[]
}

export function WorkItemsPage() {
  const { allIssues, tracks, update, loading } = useIssues()
  const { selectedIds: projectIds, projectById } = useProjects()
  const { people, selectedIds: personIds, selectionReady } = usePeople()
  const { profile } = useAuth()
  const multi = projectIds.length > 1
  const today = todayISO()

  const [preset, setPreset] = useState<WorkRangePreset>('today')
  const [customFrom, setCustomFrom] = useState(today)
  const [customTo, setCustomTo] = useState(today)
  const [trackFilter, setTrackFilter] = useState('')
  const [onlyPending, setOnlyPending] = useState(false)
  const [includeDoneIssues, setIncludeDoneIssues] = useState(false)
  const [mineOnly, setMineOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Issue | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { title: string; date: string }>>({})

  const { from, to } = useMemo(
    () => workRangeBounds(preset, customFrom, customTo, today),
    [preset, customFrom, customTo, today],
  )

  const scopedIssues = useMemo(
    () => allIssues.filter((i) => projectIds.includes(i.projectId)),
    [allIssues, projectIds],
  )

  const myId = profile?.uid ?? ''

  const { groups, summary } = useMemo(() => {
    const q = search.trim().toLowerCase()
    const allowedPeople = new Set(
      !selectionReady
        ? []
        : mineOnly && myId
          ? personIds.filter((id) => id === myId)
          : personIds,
    )

    const byPerson = new Map<string, Map<string, IssueBlock>>()
    let total = 0
    let done = 0
    const counted = new Set<string>()

    for (const issue of scopedIssues) {
      if (!includeDoneIssues && issue.status === 'done') continue
      if (trackFilter && issue.track !== trackFilter) continue

      for (const item of issue.workItems) {
        if (item.date && (item.date < from || item.date > to)) continue
        if (!item.date && preset !== 'custom') continue
        if (onlyPending && item.done) continue
        if (q) {
          const hay = `${issue.key} ${issue.title} ${item.title}`.toLowerCase()
          if (!hay.includes(q)) continue
        }

        const owners = workItemOwnerIds(issue, item).filter((id) => allowedPeople.has(id))
        if (owners.length === 0) continue

        if (!counted.has(item.id)) {
          counted.add(item.id)
          total += 1
          if (item.done) done += 1
        }

        for (const owner of owners) {
          let issuesMap = byPerson.get(owner)
          if (!issuesMap) {
            issuesMap = new Map()
            byPerson.set(owner, issuesMap)
          }
          let block = issuesMap.get(issue.id)
          if (!block) {
            block = { issue, items: [] }
            issuesMap.set(issue.id, block)
          }
          block.items.push(item)
        }
      }
    }

    const order = [...people.map((p) => p.id), UNASSIGNED_ID]
    const groups: PersonGroup[] = order
      .filter((id) => byPerson.has(id))
      .map((id) => {
        const list = [...(byPerson.get(id)?.values() ?? [])].map((block) => ({
          ...block,
          items: [...block.items].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'ko')),
        }))
        const gTotal = list.reduce((a, b) => a + b.items.length, 0)
        const gDone = list.reduce((a, b) => a + b.items.filter((w) => w.done).length, 0)
        return {
          key: id,
          label: personName(id, people),
          color: personColor(id, people),
          total: gTotal,
          done: gDone,
          list,
        }
      })

    return { groups, summary: { total, done } }
  }, [
    scopedIssues,
    includeDoneIssues,
    trackFilter,
    from,
    to,
    preset,
    onlyPending,
    search,
    selectionReady,
    mineOnly,
    myId,
    personIds,
    people,
  ])

  const shownIssueIds = useMemo(
    () => new Set(groups.flatMap((g) => g.list.map((b) => b.issue.id))),
    [groups],
  )

  const starterIssues = useMemo(() => {
    const allowed = mineOnly && myId ? personIds.filter((id) => id === myId) : personIds
    return scopedIssues
      .filter((issue) => {
        if (shownIssueIds.has(issue.id)) return false
        if (!includeDoneIssues && issue.status === 'done') return false
        if (trackFilter && issue.track !== trackFilter) return false
        if (issue.startDate && issue.dueDate && (issue.dueDate < from || issue.startDate > to)) return false
        if (selectionReady && !issueMatchesPeople(issue, allowed)) return false
        return true
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.key.localeCompare(b.key))
  }, [
    scopedIssues,
    shownIssueIds,
    includeDoneIssues,
    trackFilter,
    from,
    to,
    selectionReady,
    mineOnly,
    myId,
    personIds,
  ])

  function toggleWorkItem(issue: Issue, id: string, done: boolean) {
    const latest = allIssues.find((i) => i.id === issue.id) ?? issue
    const next = latest.workItems.map((w) => (w.id === id ? { ...w, done } : w))
    void update(latest.id, { workItems: next })
  }

  function removeWorkItem(issue: Issue, id: string) {
    const latest = allIssues.find((i) => i.id === issue.id) ?? issue
    const item = latest.workItems.find((w) => w.id === id)
    if (!item) return
    if (!window.confirm(`단위업무 "${item.title}"을(를) 삭제할까요?`)) return
    void update(latest.id, { workItems: latest.workItems.filter((w) => w.id !== id) })
  }

  function draftKey(personId: string, issueId: string) {
    return `${personId}:${issueId}`
  }

  function rangeDefaultDate() {
    if (today >= from && today <= to) return today
    return from
  }

  function addWorkItem(issue: Issue, personId: string, key: string) {
    const draft = drafts[key]
    const title = draft?.title.trim() ?? ''
    if (!title) return
    const date = draft?.date || rangeDefaultDate()
    const latest = allIssues.find((i) => i.id === issue.id) ?? issue
    const item: WorkItem = {
      id: newWorkItemId(),
      title,
      date,
      done: false,
      ...(personId !== UNASSIGNED_ID ? { assigneeId: personId } : {}),
    }
    void update(latest.id, { workItems: [...latest.workItems, item] })
    setDrafts((prev) => ({ ...prev, [key]: { title: '', date } }))
  }

  if (loading) return <Loading label="일정 데이터 불러오는 중" />

  const pct = summary.total ? Math.round((summary.done / summary.total) * 100) : 0
  const rangeLabel = from === to ? formatWorkDate(from, today) : `${formatShort(from)}~${formatShort(to)}`

  return (
    <div>
      <div className="page-head">
        <h1>단위업무</h1>
        <span className="muted">
          {rangeLabel} · {summary.done}/{summary.total} ({pct}%)
        </span>
      </div>

      <div className="progress-bar big">
        <div className="progress-fill" style={{ width: `${pct}%`, background: '#0052cc' }} />
      </div>

      <div className="filters">
        <div className="range-tabs">
          {RANGE_LABELS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`btn small ${preset === r.id ? 'primary' : ''}`}
              onClick={() => setPreset(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="muted">~</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={(e) => setCustomTo(e.target.value < customFrom ? customFrom : e.target.value)}
            />
          </>
        )}
        <input
          className="search-input"
          placeholder="검색 (작업·단위업무)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)}>
          <option value="">전체 트랙</option>
          {tracks.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="check inline">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
          미완료만 보기
        </label>
        <label className="check inline">
          <input
            type="checkbox"
            checked={includeDoneIssues}
            onChange={(e) => setIncludeDoneIssues(e.target.checked)}
          />
          완료된 할 일 포함
        </label>
        {myId && (
          <label className="check inline">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            내 업무만
          </label>
        )}
      </div>

      {groups.length === 0 && starterIssues.length === 0 && (
        <p className="muted">
          이 기간에 단위업무가 있는 담당자가 없습니다. 할 일을 열어 단위업무를 추가하세요.
        </p>
      )}

      {groups.map((g) => (
        <section key={g.key} className="card deliverable-group">
          <div className="deliverable-group-head">
            <span className="track-chip" style={{ background: g.color }}>
              {g.label}
            </span>
            <span className="muted small-text">
              {g.done}/{g.total}
            </span>
            <div className="progress-bar slim">
              <div
                className="progress-fill"
                style={{
                  width: `${g.total ? Math.round((g.done / g.total) * 100) : 0}%`,
                  background: g.color,
                }}
              />
            </div>
          </div>

          {g.list.map(({ issue, items }) => {
            const key = draftKey(g.key, issue.id)
            const draft = drafts[key] ?? {
              title: '',
              date: rangeDefaultDate(),
            }
            return (
              <div key={issue.id} className="deliverable-issue">
                <div className="deliverable-issue-head" onClick={() => setEditing(issue)}>
                  <span className="issue-key">{issue.key}</span>
                  {multi && (
                    <span
                      className="track-chip"
                      style={{ background: projectById(issue.projectId)?.color ?? '#6b778c' }}
                    >
                      {projectById(issue.projectId)?.name ?? '?'}
                    </span>
                  )}
                  <span className="track-chip" style={{ background: trackColor(issue.track, tracks) }}>
                    {issue.track}
                  </span>
                  <span className="issue-title">{issue.title}</span>
                  <span className="muted small-text">
                    {formatShort(issue.startDate)}~{formatShort(issue.dueDate)}
                  </span>
                </div>
                <div className="deliverable-checks">
                  {items.map((w) => (
                    <div key={w.id} className="check work-item-row">
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={w.done}
                          onChange={(e) => toggleWorkItem(issue, w.id, e.target.checked)}
                        />
                        <span className={w.done ? 'done-text' : ''}>{w.title}</span>
                      </label>
                      <span
                        className={`work-date ${isWorkItemOverdue(w, today) ? 'overdue' : ''} ${w.date === today ? 'today' : ''}`}
                      >
                        {formatWorkDate(w.date, today)}
                      </span>
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => removeWorkItem(issue, w.id)}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <div className="work-item-add">
                    <input
                      value={draft.title}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [key]: { ...draft, title: e.target.value } }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addWorkItem(issue, g.key, key)
                        }
                      }}
                      placeholder="이 할 일에 단위업무 추가"
                    />
                    <input
                      type="date"
                      value={draft.date}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [key]: { ...draft, date: e.target.value } }))
                      }
                    />
                    <button type="button" className="btn small" onClick={() => addWorkItem(issue, g.key, key)}>
                      추가
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      ))}

      {starterIssues.length > 0 && (
        <section className="card deliverable-group">
          <div className="deliverable-group-head">
            <span className="track-chip" style={{ background: '#6b778c' }}>
              기간이 겹치는 할 일
            </span>
            <span className="muted small-text">단위업무를 추가하면 담당자별로 모입니다</span>
          </div>
          {starterIssues.map((issue) => {
            const key = draftKey('__new__', issue.id)
            const draft = drafts[key] ?? { title: '', date: rangeDefaultDate() }
            return (
              <div key={issue.id} className="deliverable-issue">
                <div className="deliverable-issue-head" onClick={() => setEditing(issue)}>
                  <span className="issue-key">{issue.key}</span>
                  {multi && (
                    <span
                      className="track-chip"
                      style={{ background: projectById(issue.projectId)?.color ?? '#6b778c' }}
                    >
                      {projectById(issue.projectId)?.name ?? '?'}
                    </span>
                  )}
                  <span className="track-chip" style={{ background: trackColor(issue.track, tracks) }}>
                    {issue.track}
                  </span>
                  <span className="issue-title">{issue.title}</span>
                  <span className="muted small-text">
                    {formatShort(issue.startDate)}~{formatShort(issue.dueDate)}
                  </span>
                </div>
                <div className="deliverable-checks">
                  <div className="work-item-add">
                    <input
                      value={draft.title}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [key]: { ...draft, title: e.target.value } }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addWorkItem(issue, UNASSIGNED_ID, key)
                        }
                      }}
                      placeholder="이 할 일에 단위업무 추가"
                    />
                    <input
                      type="date"
                      value={draft.date}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [key]: { ...draft, date: e.target.value } }))
                      }
                    />
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => addWorkItem(issue, UNASSIGNED_ID, key)}
                    >
                      추가
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {editing && <IssueModal issue={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
