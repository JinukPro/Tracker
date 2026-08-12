import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AppShell } from './AppShell'

export function ProtectedRoute() {
  const { user, loading, localMode } = useAuth()

  if (loading) {
    return (
      <div className="center-page">
        <p>로딩 중…</p>
      </div>
    )
  }

  if (!localMode && !user) {
    return <Navigate to="/login" replace />
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
