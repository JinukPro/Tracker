import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { user, localMode, loading, loginWithGoogle } = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (localMode || user) {
    return <Navigate to="/" replace />
  }

  if (loading) {
    return (
      <div className="center-page">
        <p>로딩 중…</p>
      </div>
    )
  }

  async function handleLogin() {
    setBusy(true)
    setError('')
    try {
      await loginWithGoogle()
    } catch {
      setError('로그인에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-page">
      <div className="card narrow">
        <h1>Tracker</h1>
        <p className="muted">Google 계정으로 로그인하세요.</p>
        {error && <p className="red">{error}</p>}
        <button type="button" className="btn primary" disabled={busy} onClick={() => void handleLogin()}>
          {busy ? '로그인 중…' : 'Google 로그인'}
        </button>
      </div>
    </div>
  )
}
