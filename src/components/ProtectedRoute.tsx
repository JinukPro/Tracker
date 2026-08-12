import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AppShell } from './AppShell'
import { Loading } from './Loading'

export function ProtectedRoute() {
  const { user, loading, localMode } = useAuth()

  if (loading) {
    return <Loading label="로그인 확인 중" center />
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
