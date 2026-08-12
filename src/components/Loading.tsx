import { useSyncExternalStore } from 'react'
import { getInitStage, subscribeInitStage } from '../services/bootstrap'

/**
 * Loading indicator that shows what is currently being loaded.
 * Falls back to `label`, then to a generic message.
 */
export function Loading({ label, center }: { label?: string; center?: boolean }) {
  const stage = useSyncExternalStore(subscribeInitStage, getInitStage)
  const text = stage || label || '로딩 중'
  const body = <p className="muted">{text}…</p>
  if (center) return <div className="center-page">{body}</div>
  return body
}
