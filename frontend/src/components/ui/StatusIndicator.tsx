import type { ReactNode } from 'react'

export default function StatusIndicator({ state, children }: { state: 'idle' | 'valid' | 'invalid'; children: ReactNode }) {
  return <span className={`status-indicator status-${state}`} role="status"><i aria-hidden="true" />{children}</span>
}
