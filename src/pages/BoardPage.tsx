import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { IssueModal } from '../components/IssueModal'
import { Loading } from '../components/Loading'
import { AssigneeChips } from '../components/AssigneeChips'
import { useIssues } from '../context/IssuesContext'
import { useProjects } from '../context/ProjectsContext'
import { trackColor } from '../lib/colors'
import { formatShort, todayISO } from '../lib/dates'
import { isLateDone, isOverdue, issueDelayDays } from '../lib/issues'
import { STATUS_LABELS, STATUS_ORDER, type Issue, type IssueStatus } from '../types'

const TRACK_FILTER_KEY = 'tracker:boardTrackFilter'

function loadTrackFilter(): string {
  try {
    return localStorage.getItem(TRACK_FILTER_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveTrackFilter(value: string) {
  try {
    localStorage.setItem(TRACK_FILTER_KEY, value)
  } catch {
    // ignore quota / private-mode failures
  }
}

export function BoardPage() {
  const { issues, tracks, update, loading } = useIssues()
  const { selectedIds, projectById } = useProjects()
  const multi = selectedIds.length > 1
  const [trackFilter, setTrackFilter] = useState(loadTrackFilter)
  const [editing, setEditing] = useState<Issue | null>(null)
  const [creating, setCreating] = useState<IssueStatus | null>(null)
  const [dragOver, setDragOver] = useState<IssueStatus | null>(null)
  const today = todayISO()

  useEffect(() => {
    if (trackFilter && tracks.length > 0 && !tracks.includes(trackFilter)) {
      setTrackFilter('')
      saveTrackFilter('')
    }
  }, [trackFilter, tracks])

  function onTrackFilterChange(value: string) {
    setTrackFilter(value)
    saveTrackFilter(value)
  }

  const columns = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        items: issues.filter((i) => i.status === status && (!trackFilter || i.track === trackFilter)),
      })),
    [issues, trackFilter],
  )

  function handleDrop(e: DragEvent, status: IssueStatus) {
    e.preventDefault()
    setDragOver(null)
    const id = e.dataTransfer.getData('text/plain')
    const issue = issues.find((i) => i.id === id)
    if (issue && issue.status !== status) {
      void update(id, { status })
    }
  }

  if (loading) return <Loading label="일정 데이터 불러오는 중" />

  return (
    <div>
      <div className="page-head">
        <h1>보드</h1>
        <div className="filters inline">
          <select value={trackFilter} onChange={(e) => onTrackFilterChange(e.target.value)}>
            <option value="">전체 트랙</option>
            {tracks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="board">
        {columns.map(({ status, items }) => (
          <div
            key={status}
            className={`board-col ${dragOver === status ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(status)
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="board-col-head">
              <span className={`status-dot ${status}`} />
              {STATUS_LABELS[status]}
              <span className="muted count">{items.length}</span>
              <button type="button" className="btn ghost small" onClick={() => setCreating(status)}>
                +
              </button>
            </div>
            <div className="board-col-body">
              {items.map((i) => {
                const dDone = i.deliverables.filter((d) => d.done).length
                const overdue = isOverdue(i, today)
                const lateDone = isLateDone(i)
                const delay = issueDelayDays(i, today)
                return (
                  <div
                    key={i.id}
                    className="board-card"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', i.id)}
                    onClick={() => setEditing(i)}
                  >
                    <div className="board-card-title">{i.title}</div>
                    <div className="board-card-meta">
                      {multi && (
                        <span
                          className="track-chip"
                          style={{ background: projectById(i.projectId)?.color ?? '#6b778c' }}
                        >
                          {projectById(i.projectId)?.name ?? '?'}
                        </span>
                      )}
                      <span className="track-chip" style={{ background: trackColor(i.track, tracks) }}>
                        {i.track}
                      </span>
                      {i.priority === 'high' && <span className="priority high">높음</span>}
                    </div>
                    <div className="board-card-foot">
                      <span className="issue-key">{i.key}</span>
                      {i.deliverables.length > 0 && (
                        <span className={`small-text ${dDone === i.deliverables.length ? 'green' : 'muted'}`}>
                          📄 {dDone}/{i.deliverables.length}
                        </span>
                      )}
                      <AssigneeChips ids={i.assigneeIds} />
                      <span className={`small-text ${overdue ? 'red' : lateDone ? 'orange' : 'muted'}`}>
                        {formatShort(i.startDate)}~{formatShort(i.dueDate)}
                        {lateDone && i.completedDate && ` → ${formatShort(i.completedDate)} D+${delay}`}
                        {overdue && ` D+${delay}`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {editing && <IssueModal issue={editing} onClose={() => setEditing(null)} />}
      {creating && (
        <IssueModal
          defaults={{ status: creating, track: trackFilter || undefined }}
          onClose={() => setCreating(null)}
        />
      )}
    </div>
  )
}
