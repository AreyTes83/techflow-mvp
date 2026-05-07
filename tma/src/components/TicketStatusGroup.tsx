import type { ReactNode } from 'react'
import type { TicketStatus } from '../lib/types'

type Props = {
  groupStatus: TicketStatus
  label: string
  count: number
  children: ReactNode
}

/** Згорнута група за статусом: у summary — назва + лічильник; заявки всередині після розгортання. */
export function TicketStatusGroup({ groupStatus, label, count, children }: Props) {
  return (
    <details className="ticket-status-collapsible">
      <summary className="ticket-status-collapsible-summary">
        <div className="ticket-status-collapsible-summary-label">
          <span className="pill pill--status" data-status={groupStatus}>
            {label}
          </span>
        </div>
        <span className="group-count-pill">{count}</span>
      </summary>
      <div className="ticket-status-collapsible-body">{children}</div>
    </details>
  )
}
