import { useMemo, useState, type DragEvent } from 'react'
import { IssueModal } from '../components/IssueModal'
import { useIssues } from '../context/IssuesContext'
import { useProjects } from '../context/ProjectsContext'
import { trackColor } from '../lib/colors'
import { formatShort, todayISO } from '../lib/dates'
import { STATUS_LABELS, STATUS_ORDER, type Issue, type IssueStatus } from '../types'

export function BoardPage() {
  const { issues, tracks, update, loading } = useIssues()
  const { selectedIds, projectById } = useProjects()
  const multi = selectedIds.length > 1
  const [trackFilter, setTrackFilter] = useState('')
  const [editing, setEditing] = useState<Issue | null>(null)
  const [creating, setCreating] = useState<IssueStatus | null>(null)
  const [dragOver, setDragOver] = useState<IssueStatus | null>(null)
  const today = todayISO()

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

  if (loading) return <p className="muted">로딩 중…</p>

  return (
    <div>
      <div className="page-head">
        <h1>보드</h1>
        <div className="filters inline">
          <select value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)}>
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
                const overdue = i.status !== 'done' && i.dueDate < today
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
                      <span className={`small-text ${overdue ? 'red' : 'muted'}`}>
                        {formatShort(i.startDate)}~{formatShort(i.dueDate)}
                      </span>
                      {i.deliverables.length > 0 && (
                        <span className={`small-text ${dDone === i.deliverables.length ? 'green' : 'muted'}`}>
                          📄 {dDone}/{i.deliverables.length}
                        </span>
                      )}
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
