import { useEffect, useRef, useState } from 'react'
import { useIssues } from '../context/IssuesContext'
import { getStorageMode, type StorageMode } from '../lib/store'
import type { Issue } from '../types'

const MODE_LABELS: Record<StorageMode, string> = {
  firebase: 'Firebase Firestore',
  file: '프로젝트 파일 (Tracker/data/issues.json)',
  local: '브라우저 localStorage',
}

export function SettingsPage() {
  const { issues, resetToSeed, importIssues } = useIssues()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<StorageMode | null>(null)

  useEffect(() => {
    void getStorageMode().then(setMode)
  }, [])

  function exportJson() {
    const blob = new Blob([JSON.stringify(issues, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tracker-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(file: File) {
    setBusy(true)
    setMessage('')
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Issue[]
      if (!Array.isArray(parsed) || parsed.some((i) => !i.title || !i.startDate)) {
        throw new Error('invalid')
      }
      if (!window.confirm(`현재 데이터를 지우고 ${parsed.length}건을 가져올까요?`)) return
      await importIssues(parsed)
      setMessage(`${parsed.length}건을 가져왔습니다.`)
    } catch {
      setMessage('가져오기에 실패했습니다. JSON 형식을 확인하세요.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleReset() {
    if (!window.confirm('현재 데이터를 모두 지우고 SW_일정_설명.md 기준 시드 데이터로 초기화할까요?')) return
    setBusy(true)
    setMessage('')
    try {
      await resetToSeed()
      setMessage('시드 데이터로 초기화했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>설정</h1>
      </div>

      <section className="card">
        <h2>저장소</h2>
        <p>
          현재 모드: <strong>{mode ? MODE_LABELS[mode] : '확인 중…'}</strong>
        </p>
        {mode === 'firebase' && (
          <p className="muted">
            Cloud Firestore(<code>trackerIssues</code>)에 저장됩니다. 로그인한 팀원이 같은
            보드를 공유합니다. Rules는 루트 <code>firestore.rules</code>를 Firebase Console에
            배포해야 합니다.
          </p>
        )}
        {mode === 'file' && (
          <p className="muted">
            모든 변경사항이 <code>Tracker/data/issues.json</code>에 바로 저장됩니다. 이 파일을
            Cursor에서 직접 수정하면 열려 있는 화면에도 실시간으로 반영됩니다.
          </p>
        )}
        {mode === 'local' && (
          <p className="muted">
            Firebase 설정이 없어 브라우저 localStorage에 저장 중입니다. <code>.env</code>에
            <code>VITE_FIREBASE_*</code>를 채우면 Firestore 모드로 전환됩니다.
          </p>
        )}
        <p className="muted">작업 수: {issues.length}건</p>
      </section>

      <section className="card">
        <h2>백업 / 복원</h2>
        <div className="settings-actions">
          <button type="button" className="btn" onClick={exportJson}>
            JSON 내보내기
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
            JSON 가져오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleImport(f)
            }}
          />
        </div>
      </section>

      <section className="card">
        <h2>초기화</h2>
        <button type="button" className="btn danger" disabled={busy} onClick={() => void handleReset()}>
          시드 데이터로 초기화
        </button>
        <p className="muted small-text">
          SW_일정_설명.md 기준 일정(6개 트랙 88개 작업)으로 되돌립니다. 현재 데이터는 삭제됩니다.
        </p>
      </section>

      {message && <p className="settings-message">{message}</p>}
    </div>
  )
}
