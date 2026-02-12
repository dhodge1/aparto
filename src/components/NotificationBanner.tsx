'use client'

import type { AppNotification } from '@/lib/types'
import { buildPropertyUrl } from '@/lib/ehousing'

type NotificationBannerProps = {
  notifications: AppNotification[]
}

const NotificationBanner = ({ notifications }: NotificationBannerProps) => {
  if (notifications.length === 0) return null

  return (
    <section aria-label="Recent notifications">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        Recent Alerts
      </h2>
      <div className="space-y-2">
        {notifications.slice(0, 10).map((notif) => (
          <NotificationItem key={notif.id} notification={notif} />
        ))}
      </div>
    </section>
  )
}

const NotificationItem = ({
  notification,
}: {
  notification: AppNotification
}) => {
  const url = buildPropertyUrl(
    notification.prefectureSlug,
    notification.wardSlug,
    notification.slug,
    notification.roomNumber
  )

  const timeAgo = getTimeAgo(notification.timestamp)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:border-[var(--color-accent)]/30"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-success)]/20">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-success)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-text)]">
          {notification.propertyName}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          ¥{notification.rentAmount.toLocaleString()}/mo ·{' '}
          {notification.bedRooms} bed · {notification.sizeSqm}m²
        </p>
      </div>
      <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">
        {timeAgo}
      </span>
    </a>
  )
}

const getTimeAgo = (timestamp: string): string => {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  return `${diffDays}d ago`
}

export default NotificationBanner
