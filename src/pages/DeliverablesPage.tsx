import { useMemo, useState } from 'react'
import { IssueModal } from '../components/IssueModal'
import { Loading } from '../components/Loading'
import { AssigneeChips } from '../components/AssigneeChips'
import { useIssues } from '../context/IssuesContext'
import { usePeople } from '../context/PeopleContext'
import { useProjects } from '../context/ProjectsContext'
import { buildGroups } from '../lib/grouping'
import { formatShort } from '../lib/dates'
import type { Issue } from '../types'

export function DeliverablesPage() {
  const { issues, tracks, update, loading } = useIssues()
  const { selectedIds, selectedProjects, projectById } = useProjects()
  const { people, groupBy } = usePeople()
  const multi = selectedIds.length > 1
  const [trackFilter, setTrackFilter] = useState('')
  const [onlyPending, setOnlyPending] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Issue | null>(null)

  const summary = useMemo(() => {
    const total = issues.reduce((a, i) => a + i.deliverables.length, 0)
    const done = issues.reduce((a, i) => a + i.deliverables.filter((d) => d.done).length, 0)
    return { total, done }
  }, [issues])

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matches = (i: Issue) => {
      if (i.deliverables.length === 0) return false
      if (trackFilter && i.track !== trackFilter) return false
      if (onlyPending && i.deliverables.every((d) => d.done)) return false
      if (q) {
        const hay = `${i.title} ${i.deliverables.map((d) => d.name).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    }
    const filtered = issues.filter(matches)
    const axis = groupBy === 'person' ? 'person' : 'track'
    return buildGroups(filtered, axis, { selectedProjects, people, tracks }).map((g) => {
      const total = g.issues.reduce((a, i) => a + i.deliverables.length, 0)
      const done = g.issues.reduce((a, i) => a + i.deliverables.filter((d) => d.done).length, 0)
      return { key: g.key, label: g.label, color: g.color, list: g.issues, total, done }
    })
  }, [issues, tracks, trackFilter, onlyPending, search, groupBy, selectedProjects, people])

  function toggleDeliverable(issue: Issue, idx: number, done: boolean) {
    const next = issue.deliverables.map((d, i) => (i === idx ? { ...d, done } : d))
    void update(issue.id, { deliverables: next })
  }

  if (loading) return <Loading label="일정 데이터 불러오는 중" />

  const pct = summary.total ? Math.round((summary.done / summary.total) * 100) : 0

  return (
    <div>
      <div className="page-head">
        <h1>산출물</h1>
        <span className="muted">
          전체 {summary.done}/{summary.total} ({pct}%)
        </span>
      </div>

      <div className="progress-bar big">
        <div className="progress-fill" style={{ width: `${pct}%`, background: '#0052cc' }} />
      </div>

      <div className="filters">
        <input
          className="search-input"
          placeholder="검색 (작업·산출물 이름)"
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
      </div>

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

          {g.list.map((i) => (
            <div key={i.id} className="deliverable-issue">
              <div className="deliverable-issue-head" onClick={() => setEditing(i)}>
                <span className="issue-key">{i.key}</span>
                {multi && (
                  <span
                    className="track-chip"
                    style={{ background: projectById(i.projectId)?.color ?? '#6b778c' }}
                  >
                    {projectById(i.projectId)?.name ?? '?'}
                  </span>
                )}
                <span className="issue-title">{i.title}</span>
                <AssigneeChips ids={i.assigneeIds} />
                <span className="muted small-text">
                  {formatShort(i.startDate)}~{formatShort(i.dueDate)}
                </span>
              </div>
              <div className="deliverable-checks">
                {i.deliverables.map((d, idx) => (
                  <label key={idx} className="check">
                    <input
                      type="checkbox"
                      checked={d.done}
                      onChange={(e) => toggleDeliverable(i, idx, e.target.checked)}
                    />
                    <span className={d.done ? 'done-text' : ''}>{d.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      {editing && <IssueModal issue={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
