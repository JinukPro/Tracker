import { usePeople } from '../context/PeopleContext'
import { GROUP_BY_LABELS, GROUP_BY_ORDER } from '../types'

export function GroupToggle() {
  const { groupBy, setGroupBy } = usePeople()
  return (
    <div className="view-toggle" title="줄을 묶는 기준">
      {GROUP_BY_ORDER.map((g) => (
        <button
          key={g}
          type="button"
          className={groupBy === g ? 'active' : ''}
          onClick={() => setGroupBy(g)}
        >
          {GROUP_BY_LABELS[g]}
        </button>
      ))}
    </div>
  )
}
