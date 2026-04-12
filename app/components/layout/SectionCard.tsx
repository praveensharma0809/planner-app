import type { ReactNode } from "react"

interface SectionCardProps {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  /** Omit the default body padding â€” useful when content has its own layout */
  noPadding?: boolean
}

/**
 * SectionCard â€” the standard named card section used across all pages.
 *
 * Usage:
 *   <SectionCard
 *     title="Today's Tasks"
 *     action={<Link href="â€¦">See all</Link>}
 *   >
 *     content here
 *   </SectionCard>
 */
export function SectionCard({ title, action, children, className = "", noPadding }: SectionCardProps) {
  return (
    <div className={`section-card ${className}`}>
      {(title || action) && (
        <div className="section-card-header">
          {title && <div className="section-card-title">{title}</div>}
          {action && (
            <div className="text-xs" style={{ color: "var(--sh-text-muted)" }}>
              {action}
            </div>
          )}
        </div>
      )}
      <div className={noPadding ? "" : "section-card-body"}>{children}</div>
    </div>
  )
}
