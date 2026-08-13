import { NavLink } from 'react-router-dom'
import { type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePeople } from '../context/PeopleContext'
import { useProjects } from '../context/ProjectsContext'
import { initials } from '../lib/people'
import { GROUP_BY_LABELS, GROUP_BY_ORDER, UNASSIGNED_ID } from '../types'

const links = [
  { to: '/', label: '대시보드', end: true },
  { to: '/board', label: '보드' },
  { to: '/list', label: '목록' },
  { to: '/timeline', label: '타임라인' },
  { to: '/gantt', label: '간트' },
  { to: '/calendar', label: '달력' },
  { to: '/deliverables', label: '산출물' },
  { to: '/settings', label: '설정' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, localMode, logout } = useAuth()
  const { projects, selectedIds, toggleProject, initError } = useProjects()
  const { people, groupBy, setGroupBy, selectedIds: personIds, togglePerson, personColor } = usePeople()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">T</span> Tracker
        </div>
        <div className="topbar-right">
          <span className="muted">{profile?.displayName ?? profile?.email}</span>
          {!localMode && (
            <button type="button" className="btn ghost" onClick={() => void logout()}>
              로그아웃
            </button>
          )}
        </div>
      </header>
      {initError && (
        <div className="error-banner">
          <span>
            데이터를 불러오지 못했습니다: {initError}
            {/permission|denied/i.test(initError) &&
              ' — firestore.rules가 Firebase Console에 배포되어 있는지 확인하세요.'}
          </span>
          <button type="button" className="btn small" onClick={() => window.location.reload()}>
            다시 시도
          </button>
        </div>
      )}
      <div className="project-bar">
        {projects.length > 1 && (
          <>
            <span className="project-bar-label">프로젝트</span>
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
          </>
        )}
        <span className={`project-bar-label ${projects.length > 1 ? 'bar-group-label' : ''}`}>그룹</span>
        <div className="view-toggle">
          {GROUP_BY_ORDER.map((g) => (
            <button
              key={g}
              type="button"
              className={groupBy === g ? 'active' : ''}
              onClick={() => setGroupBy(g)}
            >
              {GROUP_BY_LABELS[g]}
            </button>
          ))}
        </div>
      </div>
      <div className="project-bar">
        <span className="project-bar-label">담당자</span>
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
      <div className="body">
        <nav className="sidenav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
