import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { type ReactNode } from 'react'

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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">T</span> T뽑기 Tracker
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
