import Link from "next/link"
import type { ReactNode } from "react"

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  eyebrow?: string
  subtitle?: string
  breadcrumb?: BreadcrumbItem[]
  actions?: ReactNode
}

/**
 * PageHeader — consistent top-of-page heading used on every screen.
 *
 * Usage:
 *   <PageHeader
 *     breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Subjects" }]}
 *     eyebrow="Overview"
 *     title="Dashboard"
 *     subtitle="Your study progress at a glance."
 *     actions={<Button>…</Button>}
 *   />
 */
export function PageHeader({ title, eyebrow, breadcrumb, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header-root">
      <div className="flex-1 min-w-0">
        {eyebrow && <p className="page-header-eyebrow">{eyebrow}</p>}
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="page-header-breadcrumb" aria-label="Breadcrumb">
            {breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="page-header-breadcrumb-sep" aria-hidden="true">/</span>}
                {item.href ? (
                  <Link href={item.href}>{item.label}</Link>
                ) : (
                  <span>{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
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
