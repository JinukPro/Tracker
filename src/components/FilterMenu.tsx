import { useEffect, useRef, useState } from 'react'
import { usePeople } from '../context/PeopleContext'
import { useProjects } from '../context/ProjectsContext'
import { initials } from '../lib/people'
import { UNASSIGNED_ID } from '../types'

const OPEN_KEY = 'tracker:filterOpen'

export function FilterMenu() {
  const { projects, selectedIds, toggleProject } = useProjects()
  const { people, selectedIds: personIds, togglePerson, personColor } = usePeople()
  const [open, setOpen] = useState(() => localStorage.getItem(OPEN_KEY) === '1')
  const rootRef = useRef<HTMLDivElement>(null)

  const selectedProjects = projects.filter((p) => selectedIds.includes(p.id))
  const selectedPeople = people.filter((p) => personIds.includes(p.id))
  const extraPeople = Math.max(0, selectedPeople.length - 4)
  const shownPeople = selectedPeople.slice(0, 4)

  useEffect(() => {
    localStorage.setItem(OPEN_KEY, open ? '1' : '0')
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="filter-menu" ref={rootRef}>
      <button
        type="button"
        className={`filter-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="프로젝트·담당자 필터"
      >
        <span>필터</span>
        {projects.length > 1 && (
          <span className="filter-summary-dots">
            {selectedProjects.map((p) => (
              <span key={p.id} className="proj-dot" style={{ background: p.color }} title={p.name} />
            ))}
          </span>
        )}
        <span className="person-avatars">
          {shownPeople.map((p) => (
            <span
              key={p.id}
              className="person-avatar tiny"
              style={{ background: personColor(p.id) }}
              title={p.displayName}
            >
              {initials(p.displayName)}
            </span>
          ))}
          {extraPeople > 0 && (
            <span className="person-avatar tiny extra" title={`외 ${extraPeople}명`}>
              +{extraPeople}
            </span>
          )}
        </span>
        <span className="filter-caret">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="filter-popover">
          {projects.length > 1 && (
            <div className="filter-section">
              <span className="filter-section-label">프로젝트</span>
              <div className="filter-chips">
                {projects.map((p) => {
                  const active = selectedIds.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`proj-chip ${active ? 'active' : ''}`}
                      style={
                        active
                          ? { borderColor: p.color, boxShadow: `inset 0 0 0 1px ${p.color}` }
                          : undefined
                      }
                      onClick={() => toggleProject(p.id)}
                      title={active ? '클릭하여 숨기기' : '클릭하여 표시'}
                    >
                      <span className="proj-dot" style={{ background: p.color }} />
                      {p.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="filter-section">
            <span className="filter-section-label">담당자</span>
            <div className="filter-chips">
              <button
                type="button"
                className={`proj-chip ${personIds.includes(UNASSIGNED_ID) ? 'active' : ''}`}
                onClick={() => togglePerson(UNASSIGNED_ID)}
                title={personIds.includes(UNASSIGNED_ID) ? '클릭하여 숨기기' : '클릭하여 표시'}
              >
                <span className="proj-dot" style={{ background: '#6b778c' }} />
                미배정
              </button>
              {people.map((p) => {
                const active = personIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`proj-chip ${active ? 'active' : ''}`}
                    style={
                      active
                        ? { borderColor: personColor(p.id), boxShadow: `inset 0 0 0 1px ${personColor(p.id)}` }
                        : undefined
                    }
                    onClick={() => togglePerson(p.id)}
                    title={active ? '클릭하여 숨기기' : '클릭하여 표시'}
                  >
                    <span className="person-avatar tiny" style={{ background: personColor(p.id) }}>
                      {initials(p.displayName)}
                    </span>
                    {p.displayName}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
