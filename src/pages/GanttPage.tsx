import { useMemo, useState } from 'react'
import { GroupToggle } from '../components/GroupToggle'
import { IssueModal } from '../components/IssueModal'
import { Loading } from '../components/Loading'
import { useIssues } from '../context/IssuesContext'
import { usePeople } from '../context/PeopleContext'
import { useProjects } from '../context/ProjectsContext'
import { STATUS_COLORS } from '../lib/colors'
import { addDays, diffDays, formatShort, parseISO } from '../lib/dates'
import { buildGroups } from '../lib/grouping'
import type { Issue } from '../types'

const LABEL_W = 280
const DAY_W = 5

export function GanttPage() {
  const { issues, tracks, loading } = useIssues()
  const { selectedProjects } = useProjects()
  const { people, groupBy } = usePeople()
  const multi = selectedProjects.length > 1
  const [trackFilter, setTrackFilter] = useState('')
  const [editing, setEditing] = useState<Issue | null>(null)

  const filtered = useMemo(
    () => issues.filter((i) => !trackFilter || i.track === trackFilter),
    [issues, trackFilter],
  )

  const groups = useMemo(
    () => buildGroups(filtered, groupBy, { selectedProjects, people, tracks }),
    [filtered, groupBy, selectedProjects, people, tracks],
  )

  const range = useMemo(() => {
    if (filtered.length === 0) return null
    const minStart = filtered.reduce((a, i) => (i.startDate < a ? i.startDate : a), filtered[0].startDate)
    const maxDue = filtered.reduce((a, i) => (i.dueDate > a ? i.dueDate : a), filtered[0].dueDate)
    const first = addDays(parseISO(minStart), -3)
    const last = addDays(parseISO(maxDue), 4)
    return { first, days: diffDays(first, last) + 1 }
  }, [filtered])

  const monthSpans = useMemo(() => {
    if (!range) return []
    const spans: { label: string; count: number }[] = []
    for (let i = 0; i < range.days; i++) {
      const d = addDays(range.first, i)
      const label = `${d.getFullYear()}.${d.getMonth() + 1}`
      const last = spans[spans.length - 1]
      if (last && last.label === label) last.count += 1
      else spans.push({ label, count: 1 })
    }
    return spans
  }, [range])

  if (loading) return <Loading label="일정 데이터 불러오는 중" />
  if (!range) return <p className="muted">작업이 없습니다.</p>

  const chartW = range.days * DAY_W
  const totalW = LABEL_W + chartW
  const todayOffset = diffDays(range.first, new Date()) * DAY_W
  const showToday = todayOffset >= 0 && todayOffset <= chartW
  const showParent = groupBy !== 'project' || multi

  function renderBar(i: Issue, rowKey: string) {
    const left = LABEL_W + diffDays(range!.first, parseISO(i.startDate)) * DAY_W
    const width = Math.max(DAY_W, (diffDays(parseISO(i.startDate), parseISO(i.dueDate)) + 1) * DAY_W)
    const dTotal = i.deliverables.length
    const dDone = i.deliverables.filter((d) => d.done).length
    const pct = dTotal > 0 ? Math.round((dDone / dTotal) * 100) : i.status === 'done' ? 100 : 0
    return (
      <div key={rowKey} className="chart-row gantt-row" style={{ width: totalW }}>
        <div className="chart-label issue-label" style={{ width: LABEL_W }} title={i.title}>
          <span className="issue-key">{i.key}</span> {i.title}
        </div>
        <div
          className="gantt-bar"
          style={{ left, width, background: STATUS_COLORS[i.status] }}
          title={`${i.key} ${i.title}\n${formatShort(i.startDate)}~${formatShort(i.dueDate)} · 산출물 ${dDone}/${dTotal}`}
          onClick={() => setEditing(i)}
        >
          <div className="gantt-progress" style={{ width: `${pct}%` }} />
          {width > 60 && <span className="gantt-pct">{pct}%</span>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <h1>간트</h1>
        <div className="filters inline">
          <select value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)}>
            <option value="">전체 트랙</option>
            {tracks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="legend">
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: STATUS_COLORS.todo }} /> 할 일
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: STATUS_COLORS.inprogress }} /> 진행 중
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: STATUS_COLORS.hold }} /> 보류
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: STATUS_COLORS.done }} /> 완료
            </span>
          </span>
        </div>
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
              <div key={i} className="month-cell" style={{ width: m.count * DAY_W }}>
                {m.label}
              </div>
            ))}
          </div>

          {groups.map((g) => (
            <div key={g.key}>
              {showParent && (
                <div className="chart-row project-header" style={{ width: totalW }}>
                  <div className="chart-label" style={{ width: LABEL_W }}>
                    <span className="track-chip" style={{ background: g.color }}>
                      {g.label}
                    </span>
                    <span className="muted small-text">{g.issues.length}</span>
                  </div>
                </div>
              )}
              {g.children.length > 0
                ? g.children.map((child) => (
                    <div key={child.key}>
                      <div className="chart-row track-header" style={{ width: totalW }}>
                        <div className="chart-label" style={{ width: LABEL_W }}>
                          <span className="track-chip" style={{ background: child.color }}>
                            {child.label}
                          </span>
                        </div>
                      </div>
                      {child.issues.map((i) => renderBar(i, `${child.key}:${i.id}`))}
                    </div>
                  ))
                : g.issues.map((i) => renderBar(i, `${g.key}:${i.id}`))}
            </div>
          ))}
        </div>
      </div>

      {editing && <IssueModal issue={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
