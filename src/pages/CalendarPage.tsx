import { useMemo, useState } from 'react'
import { IssueModal } from '../components/IssueModal'
import { Loading } from '../components/Loading'
import { useIssues } from '../context/IssuesContext'
import { useProjects } from '../context/ProjectsContext'
import { trackColor } from '../lib/colors'
import { addDays, diffDays, formatShort, parseISO, startOfWeek, toISO, todayISO } from '../lib/dates'
import type { Issue } from '../types'

const MAX_PER_CELL = 3
const MAX_LANES = 4
const VIEW_KEY = 'tracker:calendarView'

type CalView = 'bars' | 'daily'

type WeekBar = {
  issue: Issue
  lane: number
  startCol: number // 0-6
  endCol: number // 0-6
  clipStart: boolean
  clipEnd: boolean
}

function buildWeekBars(week: Date[], issues: Issue[]): { bars: WeekBar[]; laneCount: number } {
  const weekStart = toISO(week[0])
  const weekEnd = toISO(week[6])
  const overlapping = issues
    .filter((i) => i.startDate <= weekEnd && i.dueDate >= weekStart)
    .sort(
      (a, b) => a.startDate.localeCompare(b.startDate) || b.dueDate.localeCompare(a.dueDate),
    )

  const laneEnds: number[] = []
  const bars: WeekBar[] = []
  for (const issue of overlapping) {
    const startCol = Math.max(0, diffDays(week[0], parseISO(issue.startDate)))
    const endCol = Math.min(6, diffDays(week[0], parseISO(issue.dueDate)))
    let lane = laneEnds.findIndex((end) => end < startCol)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(endCol)
    } else {
      laneEnds[lane] = endCol
    }
    bars.push({
      issue,
      lane,
      startCol,
      endCol,
      clipStart: issue.startDate < weekStart,
      clipEnd: issue.dueDate > weekEnd,
    })
  }
  return { bars, laneCount: laneEnds.length }
}

export function CalendarPage() {
  const { issues, tracks, loading } = useIssues()
  const { selectedIds, projectById } = useProjects()
  const multi = selectedIds.length > 1
  // With several projects on screen, project color is the clearer signal
  const colorOf = (i: Issue) =>
    multi ? (projectById(i.projectId)?.color ?? '#6b778c') : trackColor(i.track, tracks)
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [view, setViewState] = useState<CalView>(() =>
    localStorage.getItem(VIEW_KEY) === 'daily' ? 'daily' : 'bars',
  )
  const [editing, setEditing] = useState<Issue | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)
  const today = todayISO()

  function setView(v: CalView) {
    setViewState(v)
    localStorage.setItem(VIEW_KEY, v)
  }

  const days = useMemo(() => {
    const first = startOfWeek(cursor)
    return Array.from({ length: 42 }, (_, i) => addDays(first, i))
  }, [cursor])

  const weeks = useMemo(
    () => Array.from({ length: 6 }, (_, wi) => days.slice(wi * 7, wi * 7 + 7)),
    [days],
  )

  const issuesByDay = useMemo(() => {
    if (view !== 'daily') return new Map<string, Issue[]>()
    const map = new Map<string, Issue[]>()
    for (const day of days) {
      const iso = toISO(day)
      map.set(
        iso,
        issues.filter((i) => i.startDate <= iso && i.dueDate >= iso),
      )
    }
    return map
  }, [days, issues, view])

  const weekBars = useMemo(() => {
    if (view !== 'bars') return []
    return weeks.map((week) => buildWeekBars(week, issues))
  }, [weeks, issues, view])

  if (loading) return <Loading label="일정 데이터 불러오는 중" />

  const monthLabel = `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`

  return (
    <div>
      <div className="page-head">
        <h1>달력</h1>
        <div className="cal-nav">
          <button
            type="button"
            className="btn ghost"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            ←
          </button>
          <span className="cal-month">{monthLabel}</span>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            →
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              const now = new Date()
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1))
            }}
          >
            오늘
          </button>
        </div>
        <div className="view-toggle">
          <button
            type="button"
            className={view === 'bars' ? 'active' : ''}
            onClick={() => setView('bars')}
          >
            연속
          </button>
          <button
            type="button"
            className={view === 'daily' ? 'active' : ''}
            onClick={() => setView('daily')}
          >
            일별
          </button>
        </div>
      </div>

      {view === 'daily' ? (
        <div className="calendar">
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div key={d} className={`cal-dow ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>
              {d}
            </div>
          ))}
          {days.map((day) => {
            const iso = toISO(day)
            const list = issuesByDay.get(iso) ?? []
            const isOther = day.getMonth() !== cursor.getMonth()
            const isToday = iso === today
            const isExpanded = expanded === iso
            const visible = isExpanded ? list : list.slice(0, MAX_PER_CELL)
            return (
              <div
                key={iso}
                className={`cal-cell ${isOther ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
              >
                <div className="cal-date">{day.getDate()}</div>
                {visible.map((i) => (
                  <div
                    key={i.id}
                    className={`cal-chip ${i.status === 'done' ? 'chip-done' : ''}`}
                    style={{ borderLeftColor: colorOf(i) }}
                    title={`${i.key} ${i.title}`}
                    onClick={() => setEditing(i)}
                  >
                    {i.title}
                  </div>
                ))}
                {list.length > MAX_PER_CELL && (
                  <button
                    type="button"
                    className="cal-more"
                    onClick={() => setExpanded(isExpanded ? null : iso)}
                  >
                    {isExpanded ? '접기' : `+${list.length - MAX_PER_CELL}개 더`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="calendar-weeks">
          <div className="calw-dow-row">
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <div key={d} className={`cal-dow ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>
                {d}
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => {
            const { bars, laneCount } = weekBars[wi]
            const isExpanded = expandedWeek === wi
            const visibleLanes = isExpanded ? laneCount : Math.min(laneCount, MAX_LANES)
            const visibleBars = bars.filter((b) => b.lane < visibleLanes)
            const hiddenCount = bars.length - visibleBars.length
            return (
              <div key={wi} className="calw-row">
                <div className="calw-days">
                  {week.map((day) => {
                    const iso = toISO(day)
                    const isOther = day.getMonth() !== cursor.getMonth()
                    const isToday = iso === today
                    return (
                      <div
                        key={iso}
                        className={`calw-day ${isOther ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                      >
                        <span className="cal-date">{day.getDate()}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="calw-bars" style={{ minHeight: visibleLanes * 24 + 4 }}>
                  {visibleBars.map((b) => {
                    const color = colorOf(b.issue)
                    return (
                      <div
                        key={b.issue.id}
                        className={`calw-bar ${b.issue.status === 'done' ? 'bar-done' : ''} ${b.clipStart ? 'clip-start' : ''} ${b.clipEnd ? 'clip-end' : ''}`}
                        style={{
                          gridColumn: `${b.startCol + 1} / ${b.endCol + 2}`,
                          gridRow: b.lane + 1,
                          background: `${color}14`,
                          borderLeftColor: color,
                        }}
                        title={`${b.issue.key} ${b.issue.title} (${formatShort(b.issue.startDate)}~${formatShort(b.issue.dueDate)})`}
                        onClick={() => setEditing(b.issue)}
                      >
                        {b.issue.title}
                      </div>
                    )
                  })}
                </div>
                {(hiddenCount > 0 || isExpanded) && (
                  <button
                    type="button"
                    className="cal-more"
                    onClick={() => setExpandedWeek(isExpanded ? null : wi)}
                  >
                    {isExpanded ? '접기' : `+${hiddenCount}개 더`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editing && <IssueModal issue={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
