import { useMemo, useState, Fragment } from 'react'
import { IssueModal } from '../components/IssueModal'
import { Loading } from '../components/Loading'
import { AssigneeChips } from '../components/AssigneeChips'
import { useIssues } from '../context/IssuesContext'
import { usePeople } from '../context/PeopleContext'
import { useProjects } from '../context/ProjectsContext'
import { trackColor } from '../lib/colors'
import { buildGroups } from '../lib/grouping'
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
  const { selectedIds, selectedProjects, projectById } = useProjects()
  const { people, groupBy } = usePeople()
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

  const sections = useMemo(() => {
    if (groupBy !== 'person') return [{ key: 'all', label: null as string | null, color: '', items: filtered }]
    return buildGroups(filtered, 'person', { selectedProjects, people, tracks }).map((g) => ({
      key: g.key,
      label: g.label,
      color: g.color,
      items: g.issues,
    }))
  }, [filtered, groupBy, selectedProjects, people, tracks])

  if (loading) return <Loading label="일정 데이터 불러오는 중" />

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
              <th>담당자</th>
              <th>상태</th>
              <th>우선순위</th>
              <th>시작</th>
              <th>마감</th>
              <th>산출물</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => {
              const rows = section.items.map((i) => {
                const dDone = i.deliverables.filter((d) => d.done).length
                const overdue = i.status !== 'done' && i.dueDate < today
                return (
                  <tr key={`${section.key}:${i.id}`} onClick={() => setEditing(i)}>
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
                    <td>
                      <AssigneeChips ids={i.assigneeIds} showEmpty />
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
              })
              if (!section.label) {
                return <Fragment key={section.key}>{rows}</Fragment>
              }
              const colSpan = multi ? 10 : 9
              return (
                <Fragment key={section.key}>
                  <tr className="section-row">
                    <td colSpan={colSpan}>
                      <span className="track-chip" style={{ background: section.color }}>
                        {section.label}
                      </span>
                      <span className="muted small-text"> {section.items.length}</span>
                    </td>
                  </tr>
                  {rows}
                </Fragment>
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
