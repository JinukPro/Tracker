import { useMemo, useState } from 'react'
import { IssueModal } from '../components/IssueModal'
import { useIssues } from '../context/IssuesContext'
import { trackColor } from '../lib/colors'
import { addDays, formatShort, parseISO, startOfWeek, toISO, todayISO } from '../lib/dates'
import { STATUS_LABELS, type Issue } from '../types'

export function DashboardPage() {
  const { issues, tracks, loading } = useIssues()
  const [editing, setEditing] = useState<Issue | null>(null)
  const today = todayISO()

  const stats = useMemo(() => {
    const total = issues.length
    const done = issues.filter((i) => i.status === 'done').length
    const inprogress = issues.filter((i) => i.status === 'inprogress').length
    const overdue = issues.filter((i) => i.status !== 'done' && i.dueDate < today).length
    return { total, done, inprogress, overdue }
  }, [issues, today])

  const thisWeek = useMemo(() => {
    const ws = toISO(startOfWeek(new Date()))
    const we = toISO(addDays(startOfWeek(new Date()), 6))
    return issues.filter((i) => i.startDate <= we && i.dueDate >= ws)
  }, [issues])

  const overdueList = useMemo(
    () => issues.filter((i) => i.status !== 'done' && i.dueDate < today),
    [issues, today],
  )

  const trackStats = useMemo(
    () =>
      tracks.map((t) => {
        const list = issues.filter((i) => i.track === t)
        const done = list.filter((i) => i.status === 'done').length
        const dTotal = list.reduce((a, i) => a + i.deliverables.length, 0)
        const dDone = list.reduce((a, i) => a + i.deliverables.filter((d) => d.done).length, 0)
        return { track: t, total: list.length, done, dTotal, dDone }
      }),
    [issues, tracks],
  )

  if (loading) return <p className="muted">로딩 중…</p>

  return (
    <div>
      <div className="page-head">
        <h1>대시보드</h1>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-num">{stats.total}</div>
          <div className="stat-label">전체 작업</div>
        </div>
        <div className="stat-card">
          <div className="stat-num blue">{stats.inprogress}</div>
          <div className="stat-label">진행 중</div>
        </div>
        <div className="stat-card">
          <div className="stat-num green">{stats.done}</div>
          <div className="stat-label">완료</div>
        </div>
        <div className="stat-card">
          <div className="stat-num red">{stats.overdue}</div>
          <div className="stat-label">지연</div>
        </div>
      </div>

      <div className="dash-grid">
        <section className="card">
          <h2>트랙별 진행률</h2>
          {trackStats.map((s) => (
            <div key={s.track} className="track-progress">
              <div className="track-progress-head">
                <span className="track-chip" style={{ background: trackColor(s.track, tracks) }}>
                  {s.track}
                </span>
                <span className="muted small-text">
                  작업 {s.done}/{s.total} · 산출물 {s.dDone}/{s.dTotal}
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${s.total ? Math.round((s.done / s.total) * 100) : 0}%`,
                    background: trackColor(s.track, tracks),
                  }}
                />
              </div>
            </div>
          ))}
        </section>

        <section className="card">
          <h2>이번 주 작업 ({thisWeek.length})</h2>
          {thisWeek.length === 0 && <p className="muted">이번 주에 걸린 작업이 없습니다.</p>}
          <ul className="issue-list">
            {thisWeek.map((i) => (
              <li key={i.id} className="issue-list-item" onClick={() => setEditing(i)}>
                <span className="issue-key">{i.key}</span>
                <span className="issue-title">{i.title}</span>
                <span className={`status-badge ${i.status}`}>{STATUS_LABELS[i.status]}</span>
                <span className="muted small-text">
                  {formatShort(i.startDate)}~{formatShort(i.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>지연 작업 ({overdueList.length})</h2>
          {overdueList.length === 0 && <p className="muted">지연된 작업이 없습니다.</p>}
          <ul className="issue-list">
            {overdueList.map((i) => (
              <li key={i.id} className="issue-list-item" onClick={() => setEditing(i)}>
                <span className="issue-key">{i.key}</span>
                <span className="issue-title">{i.title}</span>
                <span className="red small-text">
                  마감 {formatShort(i.dueDate)} (D+
                  {Math.round((parseISO(today).getTime() - parseISO(i.dueDate).getTime()) / 86400000)})
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {editing && <IssueModal issue={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
