import { useEffect, useMemo, useState } from 'react'
import { useIssues } from '../context/IssuesContext'
import { usePeople } from '../context/PeopleContext'
import { useProjects } from '../context/ProjectsContext'
import { todayISO } from '../lib/dates'
import { defaultWorkItemDate, newWorkItemId } from '../lib/workItems'
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  type Deliverable,
  type Issue,
  type IssueInput,
  type IssuePriority,
  type IssueStatus,
  type WorkItem,
} from '../types'
import { AssigneePicker } from './AssigneePicker'

type Props = {
  issue?: Issue
  defaults?: Partial<IssueInput>
  onClose: () => void
}

export function IssueModal({ issue, defaults, onClose }: Props) {
  const { allIssues, create, update, remove } = useIssues()
  const { projects, selectedIds } = useProjects()
  const { personById } = usePeople()

  // Tracks belonging to one project (from its issues + its declared list)
  function projectTracks(pid: string): string[] {
    const seen: string[] = []
    for (const i of allIssues) {
      if (i.projectId === pid && !seen.includes(i.track)) seen.push(i.track)
    }
    for (const t of projects.find((p) => p.id === pid)?.tracks ?? []) {
      if (!seen.includes(t)) seen.push(t)
    }
    return seen
  }

  const initialProjectId =
    issue?.projectId ?? defaults?.projectId ?? selectedIds[0] ?? projects[0]?.id ?? ''
  const [projectId, setProjectId] = useState(initialProjectId)
  const [title, setTitle] = useState(issue?.title ?? '')
  // Tracks are per-project: only accept an initial track that exists there
  const [track, setTrack] = useState(() => {
    if (issue) return issue.track
    const t = defaults?.track ?? ''
    return t && projectTracks(initialProjectId).includes(t) ? t : ''
  })
  // True while the user is typing a brand-new track name instead of picking one
  const [customTrack, setCustomTrack] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- projectTracks reads only allIssues/projects
  const trackOptions = useMemo(() => projectTracks(projectId), [allIssues, projectId, projects])
  const [status, setStatus] = useState<IssueStatus>(issue?.status ?? defaults?.status ?? 'todo')
  const [priority, setPriority] = useState<IssuePriority>(issue?.priority ?? 'medium')
  const [startDate, setStartDate] = useState(issue?.startDate ?? defaults?.startDate ?? todayISO())
  const [dueDate, setDueDate] = useState(issue?.dueDate ?? defaults?.dueDate ?? todayISO())
  const [completedDate, setCompletedDate] = useState(issue?.completedDate ?? '')
  const [description, setDescription] = useState(issue?.description ?? '')
  const [deliverables, setDeliverables] = useState<Deliverable[]>(issue?.deliverables ?? [])
  const [workItems, setWorkItems] = useState<WorkItem[]>(issue?.workItems ?? [])
  const [assigneeIds, setAssigneeIds] = useState<string[]>(issue?.assigneeIds ?? defaults?.assigneeIds ?? [])
  const [newDeliverable, setNewDeliverable] = useState('')
  const [newWorkTitle, setNewWorkTitle] = useState('')
  const [newWorkDate, setNewWorkDate] = useState(() =>
    defaultWorkItemDate(
      issue?.startDate ?? defaults?.startDate ?? todayISO(),
      issue?.dueDate ?? defaults?.dueDate ?? todayISO(),
    ),
  )
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; track?: string; projectId?: string }>({})
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function addDeliverable() {
    const name = newDeliverable.trim()
    if (!name) return
    setDeliverables((prev) => [...prev, { name, done: false }])
    setNewDeliverable('')
  }

  function addWorkItem() {
    const title = newWorkTitle.trim()
    if (!title) return
    const date = newWorkDate || defaultWorkItemDate(startDate, dueDate)
    setWorkItems((prev) => [...prev, { id: newWorkItemId(), title, date, done: false }])
    setNewWorkTitle('')
    setNewWorkDate(defaultWorkItemDate(startDate, dueDate))
  }

  function patchWorkItem(id: string, patch: Partial<WorkItem>) {
    setWorkItems((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  }

  function onStartDateChange(next: string) {
    setStartDate(next)
    if (next && dueDate && dueDate < next) setDueDate(next)
  }

  function onDueDateChange(next: string) {
    setDueDate(startDate && next < startDate ? startDate : next)
  }

  function onStatusChange(next: IssueStatus) {
    setStatus(next)
    if (next === 'done') {
      setCompletedDate((prev) => prev || issue?.completedDate || todayISO())
    } else {
      setCompletedDate('')
    }
  }

  function clearFieldError(key: 'title' | 'track' | 'projectId') {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function validate(): boolean {
    const next: { title?: string; track?: string; projectId?: string } = {}
    if (!title.trim()) next.title = '제목을 입력하세요.'
    if (!projectId) next.projectId = '프로젝트를 선택하세요.'
    if (!track.trim()) {
      next.track =
        customTrack || trackOptions.length === 0 ? '새 트랙 이름을 입력하세요.' : '트랙을 선택하세요.'
    }
    setFieldErrors(next)
    setSaveError('')
    return Object.keys(next).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    const input: IssueInput = {
      projectId,
      title: title.trim(),
      track: track.trim(),
      status,
      priority,
      startDate,
      dueDate: dueDate < startDate ? startDate : dueDate,
      completedDate: status === 'done' ? completedDate : '',
      description,
      deliverables,
      workItems,
      assigneeIds,
    }
    try {
      if (issue) {
        await update(issue.id, input)
      } else {
        await create(input)
      }
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!issue) return
    if (!window.confirm(`${issue.key} "${issue.title}" 작업을 삭제할까요?`)) return
    await remove(issue.id)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{issue ? `${issue.key} 편집` : '새 작업'}</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="form-grid">
          <label className={`field span2 ${fieldErrors.title ? 'invalid' : ''}`}>
            <span>제목</span>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                clearFieldError('title')
              }}
              placeholder="작업 제목"
            />
            {fieldErrors.title && <p className="field-error">{fieldErrors.title}</p>}
          </label>

          <label className={`field ${fieldErrors.projectId ? 'invalid' : ''}`}>
            <span>프로젝트</span>
            <select
              value={projectId}
              onChange={(e) => {
                const pid = e.target.value
                setProjectId(pid)
                clearFieldError('projectId')
                // Drop a track that belongs to the previous project
                if (!customTrack && !projectTracks(pid).includes(track)) setTrack('')
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {fieldErrors.projectId && <p className="field-error">{fieldErrors.projectId}</p>}
          </label>

          <label className={`field ${fieldErrors.track ? 'invalid' : ''}`}>
            <span>트랙</span>
            {trackOptions.length > 0 && (
              <select
                value={customTrack ? '__new__' : track}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setCustomTrack(true)
                    setTrack('')
                  } else {
                    setCustomTrack(false)
                    setTrack(e.target.value)
                    clearFieldError('track')
                  }
                }}
              >
                {!customTrack && track === '' && (
                  <option value="" disabled>
                    트랙 선택
                  </option>
                )}
                {trackOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="__new__">+ 새 트랙 직접 입력</option>
              </select>
            )}
            {(customTrack || trackOptions.length === 0) && (
              <input
                autoFocus={customTrack}
                value={track}
                onChange={(e) => {
                  setTrack(e.target.value)
                  clearFieldError('track')
                }}
                placeholder="새 트랙 이름"
              />
            )}
            {fieldErrors.track && <p className="field-error">{fieldErrors.track}</p>}
          </label>

          <label className="field">
            <span>시작일</span>
            <input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
          </label>

          <label className="field">
            <span>마감일</span>
            <input type="date" value={dueDate} min={startDate} onChange={(e) => onDueDateChange(e.target.value)} />
          </label>

          <label className="field">
            <span>상태</span>
            <select value={status} onChange={(e) => onStatusChange(e.target.value as IssueStatus)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>실제 완료일</span>
            <input
              type="date"
              value={completedDate}
              min={startDate}
              disabled={status !== 'done'}
              onChange={(e) => setCompletedDate(e.target.value)}
            />
          </label>

          <label className="field">
            <span>우선순위</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as IssuePriority)}>
              {(Object.keys(PRIORITY_LABELS) as IssuePriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>

          <div className="field span2">
            <span>담당자</span>
            <AssigneePicker projectId={projectId} value={assigneeIds} onChange={setAssigneeIds} />
          </div>

          <label className="field span2">
            <span>설명</span>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="작업 내용"
            />
          </label>

          <div className="field span2">
            <span>산출물</span>
            <div className="deliverable-editor">
              {deliverables.map((d, idx) => (
                <div key={idx} className="deliverable-row">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={d.done}
                      onChange={(e) =>
                        setDeliverables((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, done: e.target.checked } : x)),
                        )
                      }
                    />
                    <span className={d.done ? 'done-text' : ''}>{d.name}</span>
                  </label>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => {
                      if (!window.confirm(`산출물 "${d.name}"을(를) 삭제할까요?`)) return
                      setDeliverables((prev) => prev.filter((_, i) => i !== idx))
                    }}
                  >
                    삭제
                  </button>
                </div>
              ))}
              <div className="deliverable-add">
                <input
                  value={newDeliverable}
                  onChange={(e) => setNewDeliverable(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addDeliverable()
                    }
                  }}
                  placeholder="산출물 이름 입력 후 Enter"
                />
                <button type="button" className="btn" onClick={addDeliverable}>
                  추가
                </button>
              </div>
            </div>
          </div>

          <div className="field span2">
            <span>단위업무</span>
            <div className="deliverable-editor">
              {workItems.map((w) => (
                <div key={w.id} className="work-item-edit-row">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={w.done}
                      onChange={(e) => patchWorkItem(w.id, { done: e.target.checked })}
                    />
                  </label>
                  <input
                    className={w.done ? 'done-text' : ''}
                    value={w.title}
                    onChange={(e) => patchWorkItem(w.id, { title: e.target.value })}
                    placeholder="단위업무"
                  />
                  <input
                    type="date"
                    value={w.date}
                    onChange={(e) => patchWorkItem(w.id, { date: e.target.value })}
                  />
                  {assigneeIds.length > 0 && (
                    <select
                      value={w.assigneeId ?? ''}
                      onChange={(e) =>
                        patchWorkItem(w.id, { assigneeId: e.target.value || undefined })
                      }
                    >
                      <option value="">할 일 담당 따름</option>
                      {assigneeIds.map((id) => (
                        <option key={id} value={id}>
                          {personById(id)?.displayName || '알 수 없음'}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => {
                      if (!window.confirm(`단위업무 "${w.title || '제목 없음'}"을(를) 삭제할까요?`)) return
                      setWorkItems((prev) => prev.filter((x) => x.id !== w.id))
                    }}
                  >
                    삭제
                  </button>
                </div>
              ))}
              <div className="work-item-add">
                <input
                  value={newWorkTitle}
                  onChange={(e) => setNewWorkTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addWorkItem()
                    }
                  }}
                  placeholder="오늘·근래에 할 세부 일정 입력 후 Enter"
                />
                <input
                  type="date"
                  value={newWorkDate}
                  onChange={(e) => setNewWorkDate(e.target.value)}
                />
                <button type="button" className="btn" onClick={addWorkItem}>
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          {issue ? (
            <button type="button" className="btn danger" onClick={() => void handleDelete()}>
              삭제
            </button>
          ) : (
            <span />
          )}
          <div className="modal-actions">
            {(fieldErrors.title || fieldErrors.track || fieldErrors.projectId || saveError) && (
              <p className="field-error">
                {saveError ||
                  fieldErrors.track ||
                  fieldErrors.title ||
                  fieldErrors.projectId}
              </p>
            )}
            <button type="button" className="btn ghost" onClick={onClose}>
              취소
            </button>
            <button type="button" className="btn primary" disabled={saving} onClick={() => void handleSave()}>
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
