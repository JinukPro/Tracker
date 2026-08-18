export type IssueStatus = 'todo' | 'inprogress' | 'hold' | 'done'
export type IssuePriority = 'high' | 'medium' | 'low'
export type GroupBy = 'project' | 'person' | 'track'

export const UNASSIGNED_ID = '__unassigned__'

export const GROUP_BY_LABELS: Record<GroupBy, string> = {
  project: '프로젝트',
  person: '사람',
  track: '트랙',
}

export const GROUP_BY_ORDER: GroupBy[] = ['project', 'person', 'track']

export interface Deliverable {
  name: string
  done: boolean
}

/** Day-scale work inside an issue (today / near-term), not a deliverable. */
export interface WorkItem {
  id: string
  title: string
  date: string // YYYY-MM-DD
  done: boolean
  /** When empty, the parent issue's assignees own this item. */
  assigneeId?: string
}

export interface Project {
  id: string
  name: string
  keyPrefix: string
  color: string
  /** Tracks declared explicitly (issues may add more implicitly) */
  tracks?: string[]
  /** Member ids allowed on this project. Global roster stays in trackerMembers. */
  memberIds: string[]
  createdAt: string
}

export type ProjectInput = Omit<Project, 'id' | 'createdAt' | 'memberIds' | 'tracks'> & {
  tracks?: string[]
  memberIds?: string[]
}

export interface Issue {
  id: string
  key: string
  projectId: string
  track: string
  title: string
  description: string
  status: IssueStatus
  priority: IssuePriority
  startDate: string // YYYY-MM-DD
  dueDate: string // YYYY-MM-DD
  deliverables: Deliverable[]
  workItems: WorkItem[]
  /** 0+ member ids; empty means unassigned */
  assigneeIds: string[]
  createdAt: string
  updatedAt: string
}

export interface Member {
  id: string
  displayName: string
  email: string
  createdAt: string
  /** true when stored in trackerMembers (can rename/delete). Auth users are false. */
  local: boolean
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
