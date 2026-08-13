import { addDays, parseISO, toISO } from './dates'

/** Lunar 설날 / 추석 / 부처님오신날 (solar YYYY-MM-DD) */
const LUNAR: Record<number, { seol: string; chuseok: string; buddha: string }> = {
  2020: { seol: '2020-01-25', chuseok: '2020-10-01', buddha: '2020-04-30' },
  2021: { seol: '2021-02-12', chuseok: '2021-09-21', buddha: '2021-05-19' },
  2022: { seol: '2022-02-01', chuseok: '2022-09-10', buddha: '2022-05-08' },
  2023: { seol: '2023-01-22', chuseok: '2023-09-29', buddha: '2023-05-27' },
  2024: { seol: '2024-02-10', chuseok: '2024-09-17', buddha: '2024-05-15' },
  2025: { seol: '2025-01-29', chuseok: '2025-10-06', buddha: '2025-05-05' },
  2026: { seol: '2026-02-17', chuseok: '2026-09-25', buddha: '2026-05-24' },
  2027: { seol: '2027-02-07', chuseok: '2027-09-15', buddha: '2027-05-13' },
  2028: { seol: '2028-01-26', chuseok: '2028-10-03', buddha: '2028-05-02' },
  2029: { seol: '2029-02-13', chuseok: '2029-09-22', buddha: '2029-05-20' },
  2030: { seol: '2030-02-03', chuseok: '2030-09-12', buddha: '2030-05-09' },
  2031: { seol: '2031-01-23', chuseok: '2031-10-01', buddha: '2031-05-28' },
  2032: { seol: '2032-02-11', chuseok: '2032-09-19', buddha: '2032-05-16' },
  2033: { seol: '2033-01-31', chuseok: '2033-09-08', buddha: '2033-05-06' },
  2034: { seol: '2034-02-19', chuseok: '2034-09-27', buddha: '2034-05-25' },
  2035: { seol: '2035-02-08', chuseok: '2035-09-16', buddha: '2035-05-15' },
}

type Kind = {
  iso: string
  name: string
  /** 토·일과 겹치면 대체 (국경일·어린이날·부처님오신날·성탄절·노동절) */
  satSun: boolean
  /** 일요일과 겹치면 대체 (설·추석 연휴) */
  sunOnly: boolean
  /** 평일에 다른 공휴일과 겹치면 대체 */
  overlap: boolean
}

function padDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function nextOpen(fromIso: string, closed: Set<string>): string {
  let d = addDays(parseISO(fromIso), 1)
  for (let i = 0; i < 14; i++) {
    const iso = toISO(d)
    if (d.getDay() !== 0 && !closed.has(iso)) {
      if (d.getDay() === 6) {
        d = addDays(d, 1)
        continue
      }
      return iso
    }
    d = addDays(d, 1)
  }
  return toISO(d)
}

function shift(iso: string, n: number): string {
  return toISO(addDays(parseISO(iso), n))
}

function baseForYear(year: number): Kind[] {
  const items: Kind[] = [
    { iso: padDate(year, 1, 1), name: '신정', satSun: false, sunOnly: false, overlap: false },
    { iso: padDate(year, 3, 1), name: '삼일절', satSun: true, sunOnly: false, overlap: true },
    {
      iso: padDate(year, 5, 1),
      name: year >= 2026 ? '노동절' : '근로자의 날',
      satSun: year >= 2026,
      sunOnly: false,
      overlap: year >= 2026,
    },
    { iso: padDate(year, 5, 5), name: '어린이날', satSun: true, sunOnly: false, overlap: true },
    { iso: padDate(year, 6, 6), name: '현충일', satSun: false, sunOnly: false, overlap: false },
    { iso: padDate(year, 8, 15), name: '광복절', satSun: true, sunOnly: false, overlap: true },
    { iso: padDate(year, 10, 3), name: '개천절', satSun: true, sunOnly: false, overlap: true },
    { iso: padDate(year, 10, 9), name: '한글날', satSun: true, sunOnly: false, overlap: true },
    { iso: padDate(year, 12, 25), name: '기독탄신일', satSun: true, sunOnly: false, overlap: true },
  ]
  if (year >= 2026) {
    items.push({ iso: padDate(year, 7, 17), name: '제헌절', satSun: true, sunOnly: false, overlap: true })
  }

  const lunar = LUNAR[year]
  if (lunar) {
    items.push(
      { iso: shift(lunar.seol, -1), name: '설날 전날', satSun: false, sunOnly: true, overlap: true },
      { iso: lunar.seol, name: '설날', satSun: false, sunOnly: true, overlap: true },
      { iso: shift(lunar.seol, 1), name: '설날 다음날', satSun: false, sunOnly: true, overlap: true },
      { iso: lunar.buddha, name: '부처님오신날', satSun: true, sunOnly: false, overlap: true },
      { iso: shift(lunar.chuseok, -1), name: '추석 전날', satSun: false, sunOnly: true, overlap: true },
      { iso: lunar.chuseok, name: '추석', satSun: false, sunOnly: true, overlap: true },
      { iso: shift(lunar.chuseok, 1), name: '추석 다음날', satSun: false, sunOnly: true, overlap: true },
    )
  }
  return items
}

function holidaysInYear(year: number): Map<string, string> {
  const base = baseForYear(year)
  const byDate = new Map<string, Kind[]>()
  for (const h of base) {
    const list = byDate.get(h.iso) ?? []
    list.push(h)
    byDate.set(h.iso, list)
  }

  const names = new Map<string, string>()
  for (const [iso, list] of byDate) {
    names.set(iso, list.map((h) => h.name).join('·'))
  }

  const closed = new Set(names.keys())
  const dates = [...byDate.keys()].sort()
  for (const iso of dates) {
    const list = byDate.get(iso) ?? []
    const dow = parseISO(iso).getDay()
    const satSunHit = list.some((h) => h.satSun) && (dow === 0 || dow === 6)
    const sunHit = list.some((h) => h.sunOnly) && dow === 0
    const overlapHit = dow >= 1 && dow <= 5 && list.length >= 2 && list.some((h) => h.overlap)
    if (!satSunHit && !sunHit && !overlapHit) continue
    const sub = nextOpen(iso, closed)
    if (names.has(sub)) continue
    const source = list.find((h) => (satSunHit && h.satSun) || (sunHit && h.sunOnly) || (overlapHit && h.overlap))
    names.set(sub, source ? `${source.name} 대체` : '대체공휴일')
    closed.add(sub)
  }

  return names
}

const yearCache = new Map<number, Map<string, string>>()

function yearMap(year: number): Map<string, string> {
  let cached = yearCache.get(year)
  if (!cached) {
    cached = holidaysInYear(year)
    yearCache.set(year, cached)
  }
  return cached
}

/** Korean public-holiday name for YYYY-MM-DD, if any */
export function krHoliday(iso: string): string | undefined {
  const year = Number(iso.slice(0, 4))
  if (!Number.isFinite(year)) return undefined
  return yearMap(year - 1).get(iso) ?? yearMap(year).get(iso) ?? yearMap(year + 1).get(iso)
}

export type CalDayKind = {
  sun: boolean
  sat: boolean
  holiday?: string
}

export function calDayKind(iso: string, date: Date): CalDayKind {
  const dow = date.getDay()
  return {
    sun: dow === 0,
    sat: dow === 6,
    holiday: krHoliday(iso),
  }
}

/** Weekend or Korean public holiday — not a working day */
export function isNonWorkingDay(iso: string, date: Date = parseISO(iso)): boolean {
  const dow = date.getDay()
  return dow === 0 || dow === 6 || Boolean(krHoliday(iso))
}
