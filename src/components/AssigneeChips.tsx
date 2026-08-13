import { initials } from '../lib/people'
import { usePeople } from '../context/PeopleContext'

export function AssigneeChips({
  ids,
  max = 3,
  showEmpty = false,
}: {
  ids: string[]
  max?: number
  showEmpty?: boolean
}) {
  const { personById, personColor } = usePeople()
  if (!ids.length) {
    return showEmpty ? <span className="muted small-text">미배정</span> : null
  }
  const shown = ids.slice(0, max)
  const extra = ids.length - shown.length
  const title = ids.map((id) => personById(id)?.displayName || '알 수 없음').join(', ')
  return (
    <span className="person-avatars" title={title}>
      {shown.map((id) => {
        const name = personById(id)?.displayName || '?'
        return (
          <span key={id} className="person-avatar" style={{ background: personColor(id) }} title={name}>
            {initials(name)}
          </span>
        )
      })}
      {extra > 0 && <span className="person-avatar extra">+{extra}</span>}
    </span>
  )
}
