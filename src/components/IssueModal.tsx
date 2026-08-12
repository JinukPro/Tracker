import { useEffect, useState } from 'react'
import { useIssues } from '../context/IssuesContext'
import { todayISO } from '../lib/dates'
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  type Deliverable,
  type Issue,
  type IssueInput,
  type IssuePriority,
  type IssueStatus,
} from '../types'

type Props = {
  issue?: Issue
  defaults?: Partial<IssueInput>
  onClose: () => void
}

export function IssueModal({ issue, defaults, onClose }: Props) {
  const { tracks, create, update, remove } = useIssues()
  const [title, setTitle] = useState(issue?.title ?? '')
  const [track, setTrack] = useState(issue?.track ?? defaults?.track ?? tracks[0] ?? '')
  const [status, setStatus] = useState<IssueStatus>(issue?.status ?? defaults?.status ?? 'todo')
  const [priority, setPriority] = useState<IssuePriority>(issue?.priority ?? 'medium')
  const [startDate, setStartDate] = useState(issue?.startDate ?? defaults?.startDate ?? todayISO())
  const [dueDate, setDueDate] = useState(issue?.dueDate ?? defaults?.dueDate ?? todayISO())
  const [description, setDescription] = useState(issue?.description ?? '')
  const [deliverables, setDeliverables] = useState<Deliverable[]>(issue?.deliverables ?? [])
  const [newDeliverable, setNewDeliverable] = useState('')
  const [saving, setSaving] = useState(false)

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

  async function handleSave() {
    if (!title.trim() || !track.trim()) return
    setSaving(true)
    const input: IssueInput = {
      title: title.trim(),
      track: track.trim(),
      status,
      priority,
      startDate,
      dueDate: dueDate < startDate ? startDate : dueDate,
      description,
      deliverables,
    }
    try {
      if (issue) {
        await update(issue.id, input)
      } else {
        await create(input)
      }
      onClose()
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
          <label className="field span2">
            <span>제목</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="작업 제목" />
          </label>

          <label className="field">
            <span>트랙</span>
            <input list="track-options" value={track} onChange={(e) => setTrack(e.target.value)} />
            <datalist id="track-options">
              {tracks.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>

          <label className="field">
            <span>상태</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as IssueStatus)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>시작일</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>

          <label className="field">
            <span>마감일</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
                    onClick={() => setDeliverables((prev) => prev.filter((_, i) => i !== idx))}
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
