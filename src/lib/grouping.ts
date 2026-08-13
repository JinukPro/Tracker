import { personColor } from './people'
import { trackColor } from './colors'
import { UNASSIGNED_ID, type GroupBy, type Issue, type Member, type Project } from '../types'

export type GroupNode = {
  key: string
  label: string
  color: string
  issues: Issue[]
  children: GroupNode[]
}

function issuesForPerson(issues: Issue[], personId: string): Issue[] {
  if (personId === UNASSIGNED_ID) return issues.filter((i) => i.assigneeIds.length === 0)
  return issues.filter((i) => i.assigneeIds.includes(personId))
}

export function buildGroups(
  issues: Issue[],
  groupBy: GroupBy,
  opts: {
    selectedProjects: Project[]
    people: Member[]
    tracks: string[]
  },
): GroupNode[] {
  const { selectedProjects, people, tracks } = opts

  if (groupBy === 'person') {
    const nodes: GroupNode[] = []
    for (const p of people) {
      const list = issuesForPerson(issues, p.id)
      if (list.length === 0) continue
      nodes.push({
        key: p.id,
        label: p.displayName,
        color: personColor(p.id, people),
        issues: list,
        children: [],
      })
    }
    const unassigned = issuesForPerson(issues, UNASSIGNED_ID)
    if (unassigned.length > 0) {
      nodes.push({
        key: UNASSIGNED_ID,
        label: '미배정',
        color: '#6b778c',
        issues: unassigned,
        children: [],
      })
    }
    return nodes
  }

  if (groupBy === 'track') {
    return tracks
      .map((t) => ({
        key: t,
        label: t,
        color: trackColor(t, tracks),
        issues: issues.filter((i) => i.track === t),
        children: [] as GroupNode[],
      }))
      .filter((g) => g.issues.length > 0)
  }

  return selectedProjects
    .map((project) => {
      const list = issues.filter((i) => i.projectId === project.id)
      const projectTracks: string[] = []
      for (const i of list) {
        if (!projectTracks.includes(i.track)) projectTracks.push(i.track)
      }
      return {
        key: project.id,
        label: project.name,
        color: project.color,
        issues: list,
        children: projectTracks.map((t) => ({
          key: `${project.id}:${t}`,
          label: t,
          color: trackColor(t, tracks),
          issues: list.filter((i) => i.track === t),
          children: [] as GroupNode[],
        })),
      }
    })
    .filter((g) => g.issues.length > 0)
}
