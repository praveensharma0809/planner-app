import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  eyebrow?: string
  subtitle?: string
  actions?: ReactNode
}

/**
 * PageHeader — consistent top-of-page heading used on every screen.
 *
 * Usage:
 *   <PageHeader
 *     eyebrow="Overview"
 *     title="Dashboard"
 *     subtitle="Your study progress at a glance."
 *     actions={<Button>…</Button>}
 *   />
 */
export function PageHeader({ title, eyebrow, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header-root">
      <div className="flex-1 min-w-0">
        {eyebrow && <p className="page-header-eyebrow">{eyebrow}</p>}
        <h1 className="page-header-title">{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  )
}
