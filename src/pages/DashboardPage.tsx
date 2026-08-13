import { useEffect, useMemo, useState } from 'react'
import { IssueModal } from '../components/IssueModal'
import { Loading } from '../components/Loading'
import { useIssues } from '../context/IssuesContext'
import { usePeople } from '../context/PeopleContext'
import { useProjects } from '../context/ProjectsContext'
import { trackColor } from '../lib/colors'
import { addDays, formatShort, parseISO, startOfWeek, toISO, todayISO } from '../lib/dates'
import { peopleForProjects } from '../lib/people'
import * as issuesSvc from '../services/issues'
import { UNASSIGNED_ID, STATUS_LABELS, type Issue } from '../types'

export function DashboardPage() {
  const { issues, tracks, loading } = useIssues()
  const { selectedProjects } = useProjects()
  const { people, groupBy, personColor } = usePeople()
  const multi = selectedProjects.length > 1
  const [editing, setEditing] = useState<Issue | null>(null)
  const [creatingTrack, setCreatingTrack] = useState(false)
  const [renamingTrack, setRenamingTrack] = useState<string | null>(null)
  const today = todayISO()

  const projectStats = useMemo(
    () =>
      selectedProjects.map((p) => {
        const list = issues.filter((i) => i.projectId === p.id)
        const done = list.filter((i) => i.status === 'done').length
        const overdue = list.filter((i) => i.status !== 'done' && i.dueDate < today).length
        return { project: p, total: list.length, done, overdue }
      }),
    [selectedProjects, issues, today],
  )

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

  const personStats = useMemo(() => {
    const roster = peopleForProjects(people, selectedProjects, issues)
    const rows = roster.map((p) => {
      const list = issues.filter((i) => i.assigneeIds.includes(p.id))
      const done = list.filter((i) => i.status === 'done').length
      const overdue = list.filter((i) => i.status !== 'done' && i.dueDate < today).length
      return { id: p.id, label: p.displayName, color: personColor(p.id), total: list.length, done, overdue }
    })
    const unassigned = issues.filter((i) => i.assigneeIds.length === 0)
    if (unassigned.length > 0) {
      rows.push({
        id: UNASSIGNED_ID,
        label: '미배정',
        color: '#6b778c',
        total: unassigned.length,
        done: unassigned.filter((i) => i.status === 'done').length,
        overdue: unassigned.filter((i) => i.status !== 'done' && i.dueDate < today).length,
      })
    }
    return rows.filter((s) => s.total > 0)
  }, [issues, people, selectedProjects, personColor, today])

  if (loading) return <Loading label="일정 데이터 불러오는 중" />

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
        {multi && groupBy !== 'person' && (
          <section className="card">
            <h2>프로젝트별 진행률</h2>
            {projectStats.map((s) => (
              <div key={s.project.id} className="track-progress">
                <div className="track-progress-head">
                  <span className="track-chip" style={{ background: s.project.color }}>
                    {s.project.name}
                  </span>
                  <span className="muted small-text">
                    작업 {s.done}/{s.total}
                    {s.overdue > 0 && <span className="red"> · 지연 {s.overdue}</span>}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${s.total ? Math.round((s.done / s.total) * 100) : 0}%`,
                      background: s.project.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </section>
        )}

        {groupBy === 'person' ? (
          <section className="card">
            <h2>담당자별 진행률</h2>
            {personStats.length === 0 && <p className="muted">표시할 담당자가 없습니다.</p>}
            {personStats.map((s) => (
              <div key={s.id} className="track-progress">
                <div className="track-progress-head">
                  <span className="track-chip" style={{ background: s.color }}>
                    {s.label}
                  </span>
                  <span className="muted small-text">
                    작업 {s.done}/{s.total}
                    {s.overdue > 0 && <span className="red"> · 지연 {s.overdue}</span>}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${s.total ? Math.round((s.done / s.total) * 100) : 0}%`,
                      background: s.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </section>
        ) : (
          <section className="card">
            <div className="card-head">
              <h2>트랙별 진행률</h2>
              <button type="button" className="btn ghost small" onClick={() => setCreatingTrack(true)}>
                + 새 트랙
              </button>
            </div>
            {trackStats.length === 0 && <p className="muted">트랙이 없습니다. 새 트랙을 추가하세요.</p>}
            {trackStats.map((s) => (
              <div key={s.track} className="track-progress">
                <div className="track-progress-head">
                  <span className="track-chip" style={{ background: trackColor(s.track, tracks) }}>
                    {s.track}
                  </span>
                  <span className="muted small-text">
                    작업 {s.done}/{s.total} · 산출물 {s.dDone}/{s.dTotal}
                  </span>
                  <button
                    type="button"
                    className="btn ghost small track-edit-btn"
                    title="트랙 이름 변경"
                    onClick={() => setRenamingTrack(s.track)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                    </svg>
                  </button>
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
        )}

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
      {creatingTrack && <NewTrackDialog onClose={() => setCreatingTrack(false)} />}
      {renamingTrack !== null && (
        <RenameTrackDialog track={renamingTrack} onClose={() => setRenamingTrack(null)} />
      )}
    </div>
  )
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

/** Add a track to a project without creating an issue */
function NewTrackDialog({ onClose }: { onClose: () => void }) {
  const { projects, selectedIds, editProject } = useProjects()
  const { allIssues } = useIssues()
  const [projectId, setProjectId] = useState(selectedIds[0] ?? projects[0]?.id ?? '')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEscape(onClose)

  async function handleAdd() {
    const track = name.trim()
    if (!track || !projectId) return
    const project = projects.find((p) => p.id === projectId)
    const existing = new Set([
      ...(project?.tracks ?? []),
      ...allIssues.filter((i) => i.projectId === projectId).map((i) => i.track),
    ])
    if (existing.has(track)) {
      setError('이 프로젝트에 이미 있는 트랙입니다.')
      return
    }
    setSaving(true)
    try {
      await editProject(projectId, { tracks: [...(project?.tracks ?? []), track] })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>새 트랙</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>프로젝트</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>트랙 이름</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleAdd()
                }
              }}
              placeholder="예: ECS-③ 조립"
            />
          </label>

          {error && <p className="red small-text span2">{error}</p>}
        </div>

        <div className="modal-foot">
          <span />
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              취소
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={saving || !name.trim() || !projectId}
              onClick={() => void handleAdd()}
            >
              {saving ? '추가 중…' : '추가'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Rename a track across the selected projects (issues + declared track lists) */
function RenameTrackDialog({ track, onClose }: { track: string; onClose: () => void }) {
  const { selectedProjects, editProject } = useProjects()
  const { allIssues, refresh } = useIssues()
  const [name, setName] = useState(track)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEscape(onClose)

  async function handleSave() {
    const next = name.trim()
    if (!next) return
    if (next === track) {
      onClose()
      return
    }
    // Projects (among the selected ones) that actually have this track
    const affected = selectedProjects.filter(
      (p) =>
        (p.tracks ?? []).includes(track) ||
        allIssues.some((i) => i.projectId === p.id && i.track === track),
    )
    for (const p of affected) {
      const taken =
        (p.tracks ?? []).includes(next) ||
        allIssues.some((i) => i.projectId === p.id && i.track === next)
      if (taken) {
        setError(`"${p.name}" 프로젝트에 이미 "${next}" 트랙이 있습니다.`)
        return
      }
    }
    setSaving(true)
    try {
      for (const p of affected) {
        if ((p.tracks ?? []).includes(track)) {
          await editProject(p.id, {
            tracks: (p.tracks ?? []).map((t) => (t === track ? next : t)),
          })
        }
      }
      const targets = allIssues.filter(
        (i) => i.track === track && affected.some((p) => p.id === i.projectId),
      )
      for (const i of targets) {
        await issuesSvc.updateIssue(i.id, { track: next })
      }
      await refresh()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>트랙 이름 변경</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="form-grid">
          <label className="field span2">
            <span>트랙 이름</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleSave()
                }
              }}
            />
          </label>

          {error && <p className="red small-text span2">{error}</p>}
        </div>

        <div className="modal-foot">
          <span />
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              취소
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={saving || !name.trim()}
              onClick={() => void handleSave()}
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
