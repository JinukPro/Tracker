import { useMemo, useState } from 'react'
import { IssueModal } from '../components/IssueModal'
import { useIssues } from '../context/IssuesContext'
import { useProjects } from '../context/ProjectsContext'
import { trackColor } from '../lib/colors'
import { formatWithDay, todayISO } from '../lib/dates'
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  type Issue,
  type IssueStatus,
} from '../types'

export function ListPage() {
  const { issues, tracks, update, loading } = useIssues()
  const { selectedIds, projectById } = useProjects()
  const multi = selectedIds.length > 1
  const [search, setSearch] = useState('')
  const [trackFilter, setTrackFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<Issue | null>(null)
  const [creating, setCreating] = useState(false)
  const today = todayISO()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return issues.filter((i) => {
      if (trackFilter && i.track !== trackFilter) return false
      if (statusFilter && i.status !== statusFilter) return false
      if (q) {
        const hay = `${i.key} ${i.title} ${i.description} ${i.deliverables.map((d) => d.name).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [issues, search, trackFilter, statusFilter])

  if (loading) return <p className="muted">로딩 중…</p>

  return (
    <div>
      <div className="page-head">
        <h1>목록</h1>
        <button type="button" className="btn primary" onClick={() => setCreating(true)}>
          + 새 작업
        </button>
      </div>

      <div className="filters">
        <input
          className="search-input"
          placeholder="검색 (제목·설명·산출물)"
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
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">전체 상태</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <span className="muted small-text">{filtered.length}건</span>
      </div>

      <div className="table-wrap">
        <table className="issue-table">
          <thead>
            <tr>
              <th>키</th>
              <th>제목</th>
              {multi && <th>프로젝트</th>}
              <th>트랙</th>
              <th>상태</th>
              <th>우선순위</th>
              <th>시작</th>
              <th>마감</th>
              <th>산출물</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const dDone = i.deliverables.filter((d) => d.done).length
              const overdue = i.status !== 'done' && i.dueDate < today
              return (
                <tr key={i.id} onClick={() => setEditing(i)}>
                  <td className="issue-key">{i.key}</td>
                  <td className="title-cell">{i.title}</td>
                  {multi && (
                    <td>
                      <span
                        className="track-chip"
                        style={{ background: projectById(i.projectId)?.color ?? '#6b778c' }}
                      >
                        {projectById(i.projectId)?.name ?? '?'}
                      </span>
                    </td>
                  )}
                  <td>
                    <span className="track-chip" style={{ background: trackColor(i.track, tracks) }}>
                      {i.track}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      className={`status-select ${i.status}`}
                      value={i.status}
                      onChange={(e) => void update(i.id, { status: e.target.value as IssueStatus })}
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`priority ${i.priority}`}>{PRIORITY_LABELS[i.priority]}</span>
                  </td>
                  <td className="nowrap">{formatWithDay(i.startDate)}</td>
                  <td className={`nowrap ${overdue ? 'red' : ''}`}>{formatWithDay(i.dueDate)}</td>
                  <td className="nowrap">
                    {i.deliverables.length > 0 ? (
                      <span className={dDone === i.deliverables.length ? 'green' : ''}>
                        {dDone}/{i.deliverables.length}
                      </span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && <IssueModal issue={editing} onClose={() => setEditing(null)} />}
      {creating && <IssueModal onClose={() => setCreating(false)} />}
    </div>
  )
}
