export type IssueStatus = 'todo' | 'inprogress' | 'hold' | 'done'
export type IssuePriority = 'high' | 'medium' | 'low'

export interface Deliverable {
  name: string
  done: boolean
}

export interface Issue {
  id: string
  key: string
  track: string
  title: string
  description: string
  status: IssueStatus
  priority: IssuePriority
  startDate: string // YYYY-MM-DD
  dueDate: string // YYYY-MM-DD
  deliverables: Deliverable[]
  createdAt: string
  updatedAt: string
}

export type IssueInput = Omit<Issue, 'id' | 'key' | 'createdAt' | 'updatedAt'>

export interface UserProfile {
  uid: string
  displayName: string
  email: string
  createdAt: string
}

export const STATUS_LABELS: Record<IssueStatus, string> = {
  todo: '할 일',
  inprogress: '진행 중',
  hold: '보류',
  done: '완료',
}

export const STATUS_ORDER: IssueStatus[] = ['todo', 'inprogress', 'hold', 'done']

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
}
