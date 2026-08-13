import { useMemo, useState, type CSSProperties } from 'react'
import { IssueModal } from '../components/IssueModal'
import { Loading } from '../components/Loading'
import { AssigneeChips } from '../components/AssigneeChips'
import { useIssues } from '../context/IssuesContext'
import { usePeople } from '../context/PeopleContext'
import { useProjects } from '../context/ProjectsContext'
import { trackColor } from '../lib/colors'
import { addDays, formatShort, startOfWeek, toISO, todayISO } from '../lib/dates'
import { calDayKind, isNonWorkingDay } from '../lib/holidays'
import type { Issue } from '../types'

const MAX_PER_CELL = 3
const MAX_LANES = 4
const VIEW_KEY = 'tracker:calendarView'
const WEEKEND_KEY = 'tracker:calendarWeekends'

type CalView = 'bars' | 'daily'

const DOW = [
  { label: '일', weekend: 'sun' as const },
  { label: '월', weekend: null },
  { label: '화', weekend: null },
  { label: '수', weekend: null },
  { label: '목', weekend: null },
  { label: '금', weekend: null },
  { label: '토', weekend: 'sat' as const },
]

type WeekBar = {
  issue: Issue
  lane: number
  startCol: number
  endCol: number
  clipStart: boolean
  clipEnd: boolean
}

function visibleDaysOf(week: Date[], showWeekends: boolean): Date[] {
  return showWeekends ? week : week.filter((d) => d.getDay() !== 0 && d.getDay() !== 6)
}

function buildWeekBars(week: Date[], issues: Issue[], showWeekends: boolean): { bars: WeekBar[]; laneCount: number } {
  const vis = visibleDaysOf(week, showWeekends)
  if (vis.length === 0) return { bars: [], laneCount: 0 }
  const weekStart = toISO(week[0])
  const weekEnd = toISO(week[6])
  const overlapping = issues
    .filter((i) => i.startDate <= weekEnd && i.dueDate >= weekStart)
    .sort(
      (a, b) => a.startDate.localeCompare(b.startDate) || b.dueDate.localeCompare(a.dueDate),
    )

  const segs: Omit<WeekBar, 'lane'>[] = []
  for (const issue of overlapping) {
    let runStart: number | null = null
    for (let col = 0; col <= vis.length; col++) {
      const day = vis[col]
      const iso = day ? toISO(day) : ''
      const working = Boolean(day) && !isNonWorkingDay(iso, day) && issue.startDate <= iso && issue.dueDate >= iso
      if (working) {
        if (runStart === null) runStart = col
        continue
      }
      if (runStart === null) continue
      const lastIso = toISO(vis[col - 1])
      segs.push({
        issue,
        startCol: runStart,
        endCol: col - 1,
        clipStart: issue.startDate < toISO(vis[runStart]),
        clipEnd: issue.dueDate > lastIso,
      })
      runStart = null
    }
  }

  segs.sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol)
  const laneEnds: number[] = []
  const bars: WeekBar[] = []
  for (const seg of segs) {
    let lane = laneEnds.findIndex((end) => end < seg.startCol)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(seg.endCol)
    } else {
      laneEnds[lane] = seg.endCol
    }
    bars.push({ ...seg, lane })
  }
  return { bars, laneCount: laneEnds.length }
}

function dayClasses(
  prefix: 'cal-cell' | 'calw-day' | 'calw-bg-col',
  iso: string,
  day: Date,
  isOther: boolean,
  isToday: boolean,
  colEnd: boolean,
): string {
  const k = calDayKind(iso, day)
  return [
    prefix,
    isOther ? 'other-month' : '',
    isToday ? 'today' : '',
    k.sun ? 'sun' : '',
    k.sat ? 'sat' : '',
    k.holiday ? 'holiday' : '',
    colEnd ? 'col-end' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export function CalendarPage() {
  const { issues, tracks, loading } = useIssues()
  const { selectedIds, projectById } = useProjects()
  const { groupBy, personColor } = usePeople()
  const multi = selectedIds.length > 1
  // With several projects on screen, project color is the clearer signal
  const colorOf = (i: Issue) => {
    if (groupBy === 'person') {
      const id = i.assigneeIds[0]
      return id ? personColor(id) : '#6b778c'
    }
    return multi ? (projectById(i.projectId)?.color ?? '#6b778c') : trackColor(i.track, tracks)
  }
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [view, setViewState] = useState<CalView>(() =>
    localStorage.getItem(VIEW_KEY) === 'daily' ? 'daily' : 'bars',
  )
  const [showWeekends, setShowWeekendsState] = useState(
    () => localStorage.getItem(WEEKEND_KEY) === '1',
  )
  const [editing, setEditing] = useState<Issue | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)
  const today = todayISO()
  const colCount = showWeekends ? 7 : 5
  const lastDow = showWeekends ? 6 : 5
  const dows = showWeekends ? DOW : DOW.slice(1, 6)
  const gridStyle = { '--cal-cols': colCount } as CSSProperties
  const years = useMemo(() => {
    const nowY = new Date().getFullYear()
    let min = nowY - 8
    let max = nowY + 3
    for (const i of issues) {
      const ys = Number(i.startDate.slice(0, 4))
      const ye = Number(i.dueDate.slice(0, 4))
      if (Number.isFinite(ys) && ys >= 1990) min = Math.min(min, ys)
      if (Number.isFinite(ye) && ye >= 1990) max = Math.max(max, ye)
    }
    min = Math.min(min, cursor.getFullYear())
    max = Math.max(max, cursor.getFullYear())
    return Array.from({ length: max - min + 1 }, (_, i) => min + i)
  }, [issues, cursor])

  function goMonth(delta: number) {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1))
  }

  function goYear(delta: number) {
    setCursor(new Date(cursor.getFullYear() + delta, cursor.getMonth(), 1))
  }

  function setView(v: CalView) {
    setViewState(v)
    localStorage.setItem(VIEW_KEY, v)
  }

  function setShowWeekends(on: boolean) {
    setShowWeekendsState(on)
    localStorage.setItem(WEEKEND_KEY, on ? '1' : '0')
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
    const visible = showWeekends ? days : days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6)
    for (const day of visible) {
      const iso = toISO(day)
      map.set(
        iso,
        isNonWorkingDay(iso, day) ? [] : issues.filter((i) => i.startDate <= iso && i.dueDate >= iso),
      )
    }
    return map
  }, [days, issues, view, showWeekends])

  const weekBars = useMemo(() => {
    if (view !== 'bars') return []
    return weeks.map((week) => buildWeekBars(week, issues, showWeekends))
  }, [weeks, issues, view, showWeekends])

  if (loading) return <Loading label="일정 데이터 불러오는 중" />

  return (
    <div>
      <div className="page-head">
        <h1>달력</h1>
        <div className="cal-nav">
          <button type="button" className="btn ghost" title="이전 해" onClick={() => goYear(-1)}>
            «
          </button>
          <button type="button" className="btn ghost" title="이전 달" onClick={() => goMonth(-1)}>
            ←
          </button>
          <select
            className="cal-jump"
            value={cursor.getFullYear()}
            onChange={(e) => setCursor(new Date(Number(e.target.value), cursor.getMonth(), 1))}
            title="연도"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <select
            className="cal-jump"
            value={cursor.getMonth()}
            onChange={(e) => setCursor(new Date(cursor.getFullYear(), Number(e.target.value), 1))}
            title="월"
          >
            {Array.from({ length: 12 }, (_, m) => (
              <option key={m} value={m}>
                {m + 1}월
              </option>
            ))}
          </select>
          <button type="button" className="btn ghost" title="다음 달" onClick={() => goMonth(1)}>
            →
          </button>
          <button type="button" className="btn ghost" title="다음 해" onClick={() => goYear(1)}>
            »
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
        <div className="cal-tools">
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
          <div className="view-toggle">
            <button
              type="button"
              className={showWeekends ? 'active' : ''}
              onClick={() => setShowWeekends(!showWeekends)}
            >
              주말
            </button>
          </div>
        </div>
      </div>

      {view === 'daily' ? (
        <div className="calendar" style={gridStyle}>
          {dows.map((d) => (
            <div
              key={d.label}
              className={`cal-dow ${d.weekend ?? ''} ${d.label === dows[dows.length - 1].label ? 'col-end' : ''}`}
            >
              {d.label}
            </div>
          ))}
          {(showWeekends ? days : days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6)).map((day) => {
            const iso = toISO(day)
            const list = issuesByDay.get(iso) ?? []
            const k = calDayKind(iso, day)
            const isOther = day.getMonth() !== cursor.getMonth()
            const isToday = iso === today
            const isExpanded = expanded === iso
            const visible = isExpanded ? list : list.slice(0, MAX_PER_CELL)
            return (
              <div
                key={iso}
                className={dayClasses('cal-cell', iso, day, isOther, isToday, day.getDay() === lastDow)}
              >
                <div className="cal-date-row">
                  <div className="cal-date">{day.getDate()}</div>
                  {k.holiday && (
                    <span className="cal-holiday" title={k.holiday}>
                      {k.holiday}
                    </span>
                  )}
                </div>
                {visible.map((i) => (
                  <div
                    key={i.id}
                    className={`cal-chip ${i.status === 'done' ? 'chip-done' : ''}`}
                    style={{ borderLeftColor: colorOf(i) }}
                    title={`${i.key} ${i.title}`}
                    onClick={() => setEditing(i)}
                  >
                    <AssigneeChips ids={i.assigneeIds} max={2} />
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
        <div className="calendar-weeks" style={gridStyle}>
          <div className="calw-dow-row">
            {dows.map((d) => (
              <div
                key={d.label}
                className={`cal-dow ${d.weekend ?? ''} ${d.label === dows[dows.length - 1].label ? 'col-end' : ''}`}
              >
                {d.label}
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => {
            const { bars, laneCount } = weekBars[wi]
            const isExpanded = expandedWeek === wi
            const visibleLanes = isExpanded ? laneCount : Math.min(laneCount, MAX_LANES)
            const visibleBars = bars.filter((b) => b.lane < visibleLanes)
            const hiddenCount = bars.length - visibleBars.length
            const visDays = visibleDaysOf(week, showWeekends)
            return (
              <div key={wi} className="calw-row">
                <div className="calw-bg" aria-hidden="true">
                  {visDays.map((day) => {
                    const iso = toISO(day)
                    return (
                      <div
                        key={iso}
                        className={dayClasses(
                          'calw-bg-col',
                          iso,
                          day,
                          day.getMonth() !== cursor.getMonth(),
                          iso === today,
                          day.getDay() === lastDow,
                        )}
                      />
                    )
                  })}
                </div>
                <div className="calw-days">
                  {visDays.map((day) => {
                    const iso = toISO(day)
                    const k = calDayKind(iso, day)
                    const isOther = day.getMonth() !== cursor.getMonth()
                    const isToday = iso === today
                    return (
                      <div
                        key={iso}
                        className={dayClasses(
                          'calw-day',
                          iso,
                          day,
                          isOther,
                          isToday,
                          day.getDay() === lastDow,
                        )}
                      >
                        <span className="cal-date">{day.getDate()}</span>
                        {k.holiday && (
                          <span className="cal-holiday" title={k.holiday}>
                            {k.holiday}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="calw-bars" style={{ minHeight: visibleLanes * 24 + 4 }}>
                  {visibleBars.map((b) => {
                    const color = colorOf(b.issue)
                    return (
                      <div
                        key={`${b.issue.id}:${b.startCol}:${b.endCol}`}
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
                        <AssigneeChips ids={b.issue.assigneeIds} max={2} />
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
