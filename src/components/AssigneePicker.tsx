import { useMemo, useState } from 'react'
import { usePeople } from '../context/PeopleContext'
import { useProjects } from '../context/ProjectsContext'
import { initials, memberIdsOf } from '../lib/people'

type Props = {
  projectId?: string
  value: string[]
  onChange: (ids: string[]) => void
}

export function AssigneePicker({ projectId, value, onChange }: Props) {
  const { people, personColor, addMember } = usePeople()
  const { projectById, addMembersToProject } = useProjects()
  const [adding, setAdding] = useState(false)
  const [picking, setPicking] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const project = projectId ? projectById(projectId) : undefined
  const rosterIds = useMemo(() => {
    const ids = new Set(projectId ? memberIdsOf(project) : people.map((p) => p.id))
    for (const id of value) ids.add(id)
    return ids
  }, [project, projectId, people, value])

  const roster = people.filter((p) => rosterIds.has(p.id))
  const extras = people.filter((p) => !rosterIds.has(p.id))

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  }

  async function joinProject(id: string) {
    if (projectId) await addMembersToProject(projectId, [id])
  }

  async function pickExtra(id: string) {
    await joinProject(id)
    if (!value.includes(id)) onChange([...value, id])
    setPicking(false)
  }

  async function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const id = await addMember(trimmed)
      await joinProject(id)
      onChange(value.includes(id) ? value : [...value, id])
      setName('')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="assignee-picker">
      <div className="assignee-chip-list">
        {roster.map((p) => {
          const on = value.includes(p.id)
          return (
            <button
              key={p.id}
              type="button"
              className={`assignee-chip ${on ? 'active' : ''}`}
              onClick={() => toggle(p.id)}
            >
              <span className="person-avatar" style={{ background: personColor(p.id) }}>
                {initials(p.displayName)}
              </span>
              {p.displayName}
            </button>
          )
        })}
        {roster.length === 0 && !adding && !picking && (
          <span className="muted small-text">이 프로젝트에 배정된 담당자가 없습니다</span>
        )}
      </div>
      {picking && extras.length > 0 && (
        <div className="assignee-chip-list">
          {extras.map((p) => (
            <button
              key={p.id}
              type="button"
              className="assignee-chip"
              onClick={() => void pickExtra(p.id)}
            >
              <span className="person-avatar" style={{ background: personColor(p.id) }}>
                {initials(p.displayName)}
              </span>
              {p.displayName}
            </button>
          ))}
        </div>
      )}
      {adding ? (
        <div className="deliverable-add">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleAdd()
              }
              if (e.key === 'Escape') {
                setAdding(false)
                setName('')
              }
            }}
            placeholder="이름 입력 후 Enter"
          />
          <button type="button" className="btn" disabled={saving || !name.trim()} onClick={() => void handleAdd()}>
            {saving ? '추가 중…' : '추가'}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setAdding(false)
              setName('')
            }}
          >
            취소
          </button>
        </div>
      ) : (
        <div className="assignee-picker-actions">
          {extras.length > 0 && (
            <button type="button" className="btn ghost small" onClick={() => setPicking((v) => !v)}>
              {picking ? '명단 닫기' : '+ 명단에서 추가'}
            </button>
          )}
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              setAdding(true)
              setPicking(false)
            }}
          >
            + 새 담당자
          </button>
        </div>
      )}
    </div>
  )
}
