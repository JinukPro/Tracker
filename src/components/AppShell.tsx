import { NavLink } from 'react-router-dom'
import { type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { useProjects } from '../context/ProjectsContext'
import { FilterMenu } from './FilterMenu'

const links = [
  { to: '/', label: '대시보드', end: true },
  { to: '/board', label: '보드' },
  { to: '/list', label: '목록' },
  { to: '/timeline', label: '타임라인' },
  { to: '/gantt', label: '간트' },
  { to: '/calendar', label: '달력' },
  { to: '/work', label: '단위업무' },
  { to: '/deliverables', label: '산출물' },
  { to: '/settings', label: '설정' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, localMode, logout } = useAuth()
  const { initError } = useProjects()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand">
            <span className="brand-mark">T</span> Tracker
          </div>
          <FilterMenu />
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
