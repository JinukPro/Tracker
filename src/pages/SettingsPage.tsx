import { useEffect, useRef, useState } from 'react'
import { useIssues } from '../context/IssuesContext'
import { usePeople } from '../context/PeopleContext'
import { useProjects } from '../context/ProjectsContext'
import { nextProjectColor } from '../lib/colors'
import { initials } from '../lib/people'
import { getStorageMode, type StorageMode } from '../lib/store'
import { clearAllData, importData, resetAllData } from '../services/bootstrap'
import type { Member, Project } from '../types'

const MODE_LABELS: Record<StorageMode, string> = {
  firebase: 'Firebase Firestore',
  file: '프로젝트 파일 (Tracker/data/*.json)',
  local: '브라우저 localStorage',
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function ProjectRow({
  project,
  people,
  personColor,
  issueCount,
  canDelete,
  busy,
  onSave,
  onDelete,
  onToggleMember,
}: {
  project: Project
  people: Member[]
  personColor: (id: string) => string
  issueCount: number
  canDelete: boolean
  busy: boolean
  onSave: (patch: { name: string; keyPrefix: string; color: string }) => void
  onDelete: () => void
  onToggleMember: (memberId: string) => void
}) {
  const [name, setName] = useState(project.name)
  const [keyPrefix, setKeyPrefix] = useState(project.keyPrefix)
  const [color, setColor] = useState(project.color)
  const dirty = name !== project.name || keyPrefix !== project.keyPrefix || color !== project.color
  const memberIds = project.memberIds ?? []

  return (
    <div className="project-block">
      <div className="project-row">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          title="프로젝트 색상"
        />
        <input
          className="name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="프로젝트 이름"
        />
        <input
          className="prefix-input"
          value={keyPrefix}
          onChange={(e) => setKeyPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="키"
          title="이슈 키 접두사 (예: T → T-1)"
        />
        <span className="muted small-text">작업 {issueCount}건</span>
        <button
          type="button"
          className="btn small"
          disabled={busy || !dirty || !name.trim() || !keyPrefix.trim()}
          onClick={() => onSave({ name: name.trim(), keyPrefix: keyPrefix.trim(), color })}
        >
          저장
        </button>
        <button type="button" className="btn danger small" disabled={busy || !canDelete} onClick={onDelete}>
          삭제
        </button>
      </div>
      <div className="project-members">
        <span className="filter-section-label">담당자</span>
        <div className="filter-chips">
          {people.map((p) => {
            const active = memberIds.includes(p.id)
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
                disabled={busy}
                onClick={() => onToggleMember(p.id)}
                title={active ? '이 프로젝트에서 제외' : '이 프로젝트에 배정'}
              >
                <span className="person-avatar tiny" style={{ background: personColor(p.id) }}>
                  {initials(p.displayName)}
                </span>
                {p.displayName}
              </button>
            )
          })}
          {people.length === 0 && (
            <span className="muted small-text">전역 명단에서 담당자를 먼저 추가하세요</span>
          )}
        </div>
      </div>
    </div>
  )
}

function MemberRow({
  member,
  color,
  issueCount,
  busy,
  onSave,
  onDelete,
}: {
  member: Member
  color: string
  issueCount: number
  busy: boolean
  onSave: (name: string) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(member.displayName)
  const dirty = name !== member.displayName

  return (
    <div className="project-row">
      <span className="person-avatar" style={{ background: color }}>
        {initials(member.displayName)}
      </span>
      {member.local ? (
        <input
          className="name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="담당자 이름"
        />
      ) : (
        <span className="name-input" style={{ display: 'inline-flex', alignItems: 'center' }}>
          {member.displayName}
        </span>
      )}
      <span className="muted small-text">
        {member.local ? '명단' : '계정'}
        {member.email ? ` · ${member.email}` : ''} · 작업 {issueCount}건
      </span>
      {member.local && (
        <button
          type="button"
          className="btn small"
          disabled={busy || !dirty || !name.trim()}
          onClick={() => onSave(name.trim())}
        >
          저장
        </button>
      )}
      {member.local && (
        <button type="button" className="btn danger small" disabled={busy} onClick={onDelete}>
          삭제
        </button>
      )}
    </div>
  )
}

export function SettingsPage() {
  const { allIssues, refresh: refreshIssues, update } = useIssues()
  const { projects, refresh: refreshProjects, addProject, editProject, removeProject } = useProjects()
  const { people, addMember, editMember, removeMember, personColor, refresh: refreshPeople } = usePeople()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<StorageMode | null>(null)
  const [newName, setNewName] = useState('')
  const [newPrefix, setNewPrefix] = useState('')
  const [newMember, setNewMember] = useState('')

  useEffect(() => {
    void getStorageMode().then(setMode)
  }, [])

  async function handleAddProject() {
    const name = newName.trim()
    const keyPrefix = newPrefix.trim().toUpperCase()
    if (!name || !keyPrefix) return
    setBusy(true)
    setMessage('')
    try {
      await addProject({ name, keyPrefix, color: nextProjectColor(projects.map((p) => p.color)) })
      setNewName('')
      setNewPrefix('')
      setMessage(`프로젝트 "${name}"을(를) 추가했습니다.`)
    } catch (err) {
      setMessage(`프로젝트 추가 실패: ${errText(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteProject(project: Project) {
    const count = allIssues.filter((i) => i.projectId === project.id).length
    if (!window.confirm(`"${project.name}" 프로젝트와 소속 작업 ${count}건을 모두 삭제할까요?`)) return
    setBusy(true)
    setMessage('')
    try {
      await removeProject(project.id)
      await refreshIssues()
      setMessage(`프로젝트 "${project.name}"을(를) 삭제했습니다.`)
    } catch (err) {
      setMessage(`프로젝트 삭제 실패: ${errText(err)}`)
    } finally {
      setBusy(false)
    }
  }

  function exportJson() {
    const data = { projects, issues: allIssues, members: people.filter((p) => p.local) }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
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
      const parsed = JSON.parse(text) as unknown
      const count = Array.isArray(parsed)
        ? parsed.length
        : ((parsed as { issues?: unknown[] })?.issues?.length ?? 0)
      if (!window.confirm(`현재 데이터를 지우고 작업 ${count}건을 가져올까요?`)) return
      const result = await importData(parsed)
      await refreshProjects()
      await refreshIssues()
      await refreshPeople()
      setMessage(`프로젝트 ${result.projects}개, 작업 ${result.issues}건을 가져왔습니다.`)
    } catch (err) {
      setMessage(`가져오기 실패: ${errText(err)}`)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleClearAll() {
    if (
      !window.confirm(
        `모든 프로젝트 ${projects.length}개와 작업 ${allIssues.length}건을 완전히 삭제할까요?\n이 작업은 되돌릴 수 없습니다. 필요하면 먼저 JSON 내보내기로 백업하세요.`,
      )
    )
      return
    setBusy(true)
    setMessage('')
    try {
      await clearAllData()
      await refreshProjects()
      await refreshIssues()
      await refreshPeople()
      setMessage('모든 데이터를 삭제했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    if (
      !window.confirm(
        '모든 프로젝트와 작업을 지우고 시드 데이터(빌드에 포함된 data/projects.json·issues.json)로 초기화할까요?',
      )
    )
      return
    setBusy(true)
    setMessage('')
    try {
      await resetAllData()
      await refreshProjects()
      await refreshIssues()
      await refreshPeople()
      setMessage('시드 데이터로 초기화했습니다.')
    } catch (err) {
      setMessage(`초기화 실패: ${errText(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleAddMember() {
    const name = newMember.trim()
    if (!name) return
    setBusy(true)
    setMessage('')
    try {
      await addMember(name)
      setNewMember('')
      setMessage(`담당자 "${name}"을(를) 추가했습니다.`)
    } catch (err) {
      setMessage(`담당자 추가 실패: ${errText(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteMember(id: string, name: string) {
    const count = allIssues.filter((i) => i.assigneeIds.includes(id)).length
    if (
      !window.confirm(
        count > 0
          ? `"${name}" 담당자를 삭제할까요? 소속 작업 ${count}건에서 배정이 해제됩니다.`
          : `"${name}" 담당자를 삭제할까요?`,
      )
    )
      return
    setBusy(true)
    setMessage('')
    try {
      for (const i of allIssues) {
        if (i.assigneeIds.includes(id)) {
          await update(i.id, { assigneeIds: i.assigneeIds.filter((x) => x !== id) })
        }
      }
      for (const p of projects) {
        if ((p.memberIds ?? []).includes(id)) {
          await editProject(p.id, { memberIds: (p.memberIds ?? []).filter((x) => x !== id) })
        }
      }
      await removeMember(id)
      await refreshIssues()
      setMessage(`담당자 "${name}"을(를) 삭제했습니다.`)
    } catch (err) {
      setMessage(`담당자 삭제 실패: ${errText(err)}`)
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
        <h2>프로젝트</h2>
        {projects.map((p) => (
          <ProjectRow
            key={`${p.id}:${p.name}:${p.keyPrefix}:${p.color}`}
            project={p}
            people={people}
            personColor={personColor}
            issueCount={allIssues.filter((i) => i.projectId === p.id).length}
            canDelete={projects.length > 1}
            busy={busy}
            onSave={(patch) => {
              setBusy(true)
              void editProject(p.id, patch).finally(() => setBusy(false))
            }}
            onDelete={() => void handleDeleteProject(p)}
            onToggleMember={(memberId) => {
              const ids = p.memberIds ?? []
              const next = ids.includes(memberId) ? ids.filter((x) => x !== memberId) : [...ids, memberId]
              void editProject(p.id, { memberIds: next })
            }}
          />
        ))}
        <div className="project-row add">
          <input
            className="name-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="새 프로젝트 이름"
          />
          <input
            className="prefix-input"
            value={newPrefix}
            onChange={(e) => setNewPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="키"
            title="이슈 키 접두사 (예: P → P-1)"
          />
          <button
            type="button"
            className="btn primary small"
            disabled={busy || !newName.trim() || !newPrefix.trim()}
            onClick={() => void handleAddProject()}
          >
            + 추가
          </button>
        </div>
        <p className="muted small-text">
          키는 이슈 번호 접두사로 사용됩니다 (예: 키가 <code>P</code>면 P-1, P-2…). 프로젝트마다
          사용할 담당자를 아래에서 고르면, 작업 배정과 필터에 그 명단만 나타납니다.
        </p>
      </section>

      <section className="card">
        <h2>담당자</h2>
        {people.map((p) => (
          <MemberRow
            key={p.id}
            member={p}
            color={personColor(p.id)}
            issueCount={allIssues.filter((i) => i.assigneeIds.includes(p.id)).length}
            busy={busy}
            onSave={(name) => {
              setBusy(true)
              void editMember(p.id, name).finally(() => setBusy(false))
            }}
            onDelete={() => void handleDeleteMember(p.id, p.displayName)}
          />
        ))}
        {people.length === 0 && <p className="muted">등록된 담당자가 없습니다. 아래에서 추가하세요.</p>}
        <div className="project-row add">
          <input
            className="name-input"
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleAddMember()
              }
            }}
            placeholder="새 담당자 이름"
          />
          <button
            type="button"
            className="btn primary small"
            disabled={busy || !newMember.trim()}
            onClick={() => void handleAddMember()}
          >
            + 추가
          </button>
        </div>
        <p className="muted small-text">
          한 작업에 담당자를 여러 명 둘 수 있습니다. 로그인한 계정은 자동으로 전역 명단에 나타나고,
          여기서 추가한 이름은 로컬 명단입니다. 각 프로젝트에서 쓸 사람은 위 프로젝트 담당자에서
          고릅니다.
        </p>
      </section>

      <section className="card">
        <h2>저장소</h2>
        <p>
          현재 모드: <strong>{mode ? MODE_LABELS[mode] : '확인 중…'}</strong>
        </p>
        {mode === 'firebase' && (
          <p className="muted">
            Cloud Firestore(<code>trackerIssues</code>, <code>trackerProjects</code>,{' '}
            <code>trackerMembers</code>)에 저장됩니다. 로그인한 팀원이 같은 보드를 공유합니다. Rules는
            루트 <code>firestore.rules</code>를 Firebase Console에 배포해야 합니다.
          </p>
        )}
        {mode === 'file' && (
          <p className="muted">
            모든 변경사항이 <code>Tracker/data/issues.json</code>·<code>data/projects.json</code>·
            <code>data/members.json</code>에 바로 저장됩니다. 이 파일을 Cursor에서 직접 수정하면 열려
            있는 화면에도 실시간으로 반영됩니다.
          </p>
        )}
        {mode === 'local' && (
          <p className="muted">
            Firebase 설정이 없어 브라우저 localStorage에 저장 중입니다. <code>.env</code>에
            <code>VITE_FIREBASE_*</code>를 채우면 Firestore 모드로 전환됩니다.
          </p>
        )}
        <p className="muted">
          프로젝트 {projects.length}개 · 작업 {allIssues.length}건 · 담당자 {people.length}명
        </p>
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
        <p className="muted small-text">
          내보내기는 프로젝트·작업·담당자를 함께 저장합니다. 예전 형식(작업 배열만)도 가져올 수
          있습니다.
        </p>
      </section>

      <section className="card">
        <h2>초기화</h2>
        <div className="settings-actions">
          <button type="button" className="btn danger" disabled={busy} onClick={() => void handleClearAll()}>
            모든 데이터 삭제
          </button>
          <button type="button" className="btn danger" disabled={busy} onClick={() => void handleReset()}>
            시드 데이터로 초기화
          </button>
        </div>
        <p className="muted small-text">
          <strong>모든 데이터 삭제</strong>는 프로젝트·작업을 전부 지우고 빈 상태로 만듭니다.{' '}
          <strong>시드 데이터로 초기화</strong>는 전부 지운 뒤 빌드에 포함된 시드 데이터로
          되돌립니다.
        </p>
      </section>

      {message && (
        <p className={message.includes('실패') ? 'settings-message error' : 'settings-message'}>
          {message}
        </p>
      )}
    </div>
  )
}
