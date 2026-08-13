import { useState } from 'react'
import { usePeople } from '../context/PeopleContext'
import { initials } from '../lib/people'

type Props = {
  value: string[]
  onChange: (ids: string[]) => void
}

export function AssigneePicker({ value, onChange }: Props) {
  const { people, personColor, addMember } = usePeople()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  }

  async function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const id = await addMember(trimmed)
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
        {people.map((p) => {
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
        {people.length === 0 && !adding && <span className="muted small-text">등록된 담당자가 없습니다</span>}
      </div>
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
        <button type="button" className="btn ghost small" onClick={() => setAdding(true)}>
          + 새 담당자
        </button>
      )}
    </div>
  )
}
