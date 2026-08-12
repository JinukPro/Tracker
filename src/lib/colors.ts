import type { IssueStatus } from '../types'

const TRACK_PALETTE = [
  '#0052cc',
  '#00875a',
  '#ff8b00',
  '#6554c0',
  '#de350b',
  '#00a3bf',
  '#5243aa',
  '#008672',
]

export function trackColor(track: string, tracks: string[]): string {
  const idx = tracks.indexOf(track)
  return TRACK_PALETTE[(idx >= 0 ? idx : tracks.length) % TRACK_PALETTE.length]
}

export const STATUS_COLORS: Record<IssueStatus, string> = {
  todo: '#6b778c',
  inprogress: '#0052cc',
  hold: '#ff8b00',
  done: '#00875a',
}
