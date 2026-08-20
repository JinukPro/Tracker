import { useMemo, useState } from 'react'
import { GroupToggle } from '../components/GroupToggle'
import { IssueModal } from '../components/IssueModal'
import { Loading } from '../components/Loading'
import { useIssues } from '../context/IssuesContext'
import { usePeople } from '../context/PeopleContext'
import { useProjects } from '../context/ProjectsContext'
import { addDays, diffDays, parseISO, startOfWeek, todayISO } from '../lib/dates'
import { buildGroups } from '../lib/grouping'
import { isLateDone, isOverdue, issueDateTip, issueSpanEnd } from '../lib/issues'
import type { Issue } from '../types'

const LABEL_W = 250
const WEEK_W = 64
const DAY_W = WEEK_W / 7

export function TimelinePage() {
  const { issues, tracks, loading } = useIssues()
  const { selectedProjects } = useProjects()
  const { people, groupBy } = usePeople()
  const multi = selectedProjects.length > 1
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [editing, setEditing] = useState<Issue | null>(null)

  const range = useMemo(() => {
    if (issues.length === 0) return null
    const minStart = issues.reduce((a, i) => (i.startDate < a ? i.startDate : a), issues[0].startDate)
    const maxEnd = issues.reduce((a, i) => {
      const end = issueSpanEnd(i)
      return end > a ? end : a
    }, issues[0].dueDate)
    const first = startOfWeek(parseISO(minStart))
    const last = startOfWeek(parseISO(maxEnd))
    const weeks: Date[] = []
    for (let d = first; d <= last; d = addDays(d, 7)) weeks.push(d)
    return { first, weeks }
  }, [issues])

  const monthSpans = useMemo(() => {
    if (!range) return []
    const spans: { label: string; count: number }[] = []
    for (const w of range.weeks) {
      const label = `${w.getFullYear()}.${w.getMonth() + 1}`
      const last = spans[spans.length - 1]
      if (last && last.label === label) last.count += 1
      else spans.push({ label, count: 1 })
    }
    return spans
  }, [range])

  const groups = useMemo(
    () => buildGroups(issues, groupBy, { selectedProjects, people, tracks }),
    [issues, groupBy, selectedProjects, people, tracks],
  )

  if (loading) return <Loading label="일정 데이터 불러오는 중" />
  if (!range) return <p className="muted">작업이 없습니다.</p>

  const totalW = LABEL_W + range.weeks.length * WEEK_W
  const today = new Date()
  const todayOffset = diffDays(range.first, today) * DAY_W
  const showToday = todayOffset >= 0 && todayOffset <= range.weeks.length * WEEK_W
  const showParent = groupBy !== 'project' || multi

  function toggle(key: string) {
    setCollapsed((prev) => (prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]))
  }

  function renderBar(i: Issue, rowKey: string, barColor: string) {
    const startOff = diffDays(range!.first, parseISO(i.startDate))
    const dueOff = diffDays(range!.first, parseISO(i.dueDate))
    const endOff = diffDays(range!.first, parseISO(issueSpanEnd(i)))
    const left = LABEL_W + startOff * DAY_W
    const width = Math.max(DAY_W, (dueOff - startOff + 1) * DAY_W)
    const delayWidth = endOff > dueOff ? (endOff - dueOff) * DAY_W : 0
    const overdue = isOverdue(i, todayISO())
    const lateDone = isLateDone(i)
    const tip = issueDateTip(i)
    return (
      <div key={rowKey} className="chart-row" style={{ width: totalW }}>
        <div
          className={`chart-label issue-label${overdue ? ' red' : lateDone ? ' orange' : ''}`}
          style={{ width: LABEL_W }}
          title={i.title}
        >
          <span className="issue-key">{i.key}</span> {i.title}
        </div>
        <div
          className={`timeline-bar ${i.status === 'done' ? 'bar-done' : ''} ${overdue ? 'overdue' : ''} ${lateDone ? 'late-done' : ''}`}
          style={{ left, width, background: barColor }}
          title={tip}
          onClick={() => setEditing(i)}
        >
          {i.title}
        </div>
        {delayWidth > 0 && (
          <div
            className="timeline-bar timeline-delay"
            style={{ left: left + width, width: delayWidth }}
            title={tip}
            onClick={() => setEditing(i)}
          />
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <h1>타임라인</h1>
        <span className="muted small-text">그룹 이름을 클릭하면 접거나 펼 수 있습니다</span>
        <div className="page-head-tools">
          <GroupToggle />
        </div>
      </div>

      <div className="chart-scroll">
        <div className="chart-inner" style={{ width: totalW }}>
          {showToday && (
            <div className="today-line" style={{ left: LABEL_W + todayOffset }} title="오늘" />
          )}

          <div className="chart-row header" style={{ width: totalW }}>
            <div className="chart-label" style={{ width: LABEL_W }} />
            {monthSpans.map((m, i) => (
              <div key={i} className="month-cell" style={{ width: m.count * WEEK_W }}>
                {m.label}
              </div>
            ))}
          </div>
          <div className="chart-row header sub" style={{ width: totalW }}>
            <div className="chart-label" style={{ width: LABEL_W }} />
            {range.weeks.map((w) => (
              <div key={w.getTime()} className="week-cell" style={{ width: WEEK_W }}>
                {w.getMonth() + 1}/{w.getDate()}
              </div>
            ))}
          </div>

          {groups.map((g) => {
            const parentCollapsed = collapsed.includes(g.key)
            return (
              <div key={g.key}>
                {showParent && (
                  <div
                    className="chart-row project-header"
                    style={{ width: totalW }}
                    onClick={() => toggle(g.key)}
                  >
                    <div className="chart-label" style={{ width: LABEL_W }}>
                      <span className="collapse-icon">{parentCollapsed ? '▸' : '▾'}</span>
                      <span className="track-chip" style={{ background: g.color }}>
                        {g.label}
                      </span>
                      <span className="muted small-text">{g.issues.length}</span>
                    </div>
                  </div>
                )}
                {!parentCollapsed &&
                  (g.children.length > 0
                    ? g.children.map((child) => {
                        const isCollapsed = collapsed.includes(child.key)
                        return (
                          <div key={child.key}>
                            <div
                              className="chart-row track-header"
                              style={{ width: totalW }}
                              onClick={() => toggle(child.key)}
                            >
                              <div className="chart-label" style={{ width: LABEL_W }}>
                                <span className="collapse-icon">{isCollapsed ? '▸' : '▾'}</span>
                                <span className="track-chip" style={{ background: child.color }}>
                                  {child.label}
                                </span>
                                <span className="muted small-text">{child.issues.length}</span>
                              </div>
                            </div>
                            {!isCollapsed &&
                              child.issues.map((i) =>
                                renderBar(i, `${child.key}:${i.id}`, child.color),
                              )}
                          </div>
                        )
                      })
                    : g.issues.map((i) => renderBar(i, `${g.key}:${i.id}`, g.color)))}
              </div>
            )
          })}
        </div>
      </div>

      {editing && <IssueModal issue={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
