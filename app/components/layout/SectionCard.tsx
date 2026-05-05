import type { ReactNode } from "react"

interface SectionCardProps {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  noPadding?: boolean
}

export function SectionCard({ title, action, children, className = "", noPadding }: SectionCardProps) {
  return (
    <div className={`surface-card overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-hairline">
          {title && <h3 className="text-sm font-semibold text-text-primary">{title}</h3>}
          {action && <div className="text-xs text-text-muted">{action}</div>}
        </div>
      )}
      <div className={noPadding ? "" : "p-4"}>{children}</div>
    </div>
  )
}
