import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Loading } from '../components/Loading'
import { useAuth } from '../context/AuthContext'

function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않습니다.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return '이메일 또는 비밀번호가 올바르지 않습니다.'
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일입니다. 로그인해 주세요.'
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 합니다.'
    case 'auth/too-many-requests':
      return '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return '이 로그인 방식이 Firebase Console에서 활성화되어 있지 않습니다.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '로그인 창이 닫혔습니다. 다시 시도해 주세요.'
    default:
      return '로그인에 실패했습니다. 다시 시도해 주세요.'
  }
}

export function LoginPage() {
  const { user, localMode, loading, loginWithGoogle, loginWithEmail, signupWithEmail, loginAsGuest } =
    useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (localMode || user) {
    return <Navigate to="/" replace />
  }

  if (loading) {
    return <Loading label="로그인 확인 중" center />
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'login') {
      void run(() => loginWithEmail(email.trim(), password))
    } else {
      void run(() => signupWithEmail(email.trim(), password, name.trim()))
    }
  }

  return (
    <div className="center-page">
      <div className="card narrow">
        <h1>Tracker</h1>
        <p className="muted">
          {mode === 'login' ? '이메일 또는 Google 계정으로 로그인하세요.' : '새 계정을 만듭니다.'}
        </p>
        {error && <p className="red">{error}</p>}

        <form className="login-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름 (선택)"
              autoComplete="name"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            autoComplete="email"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 (6자 이상)"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? '처리 중…' : mode === 'login' ? '이메일 로그인' : '회원가입'}
          </button>
        </form>

        <button
          type="button"
          className="login-toggle"
          disabled={busy}
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError('')
          }}
        >
          {mode === 'login' ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
        </button>

        <div className="login-divider">또는</div>

        <div className="login-alt">
          <button type="button" className="btn" disabled={busy} onClick={() => void run(loginWithGoogle)}>
            Google 로그인
          </button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(loginAsGuest)}>
            게스트로 둘러보기
          </button>
        </div>
      </div>
    </div>
  )
}
