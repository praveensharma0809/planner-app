import type { ReactNode } from "react"

type GridLayout = "2col" | "3col" | "main-aside"

interface ContentGridProps {
  layout?: GridLayout
  children: ReactNode
  className?: string
}

const layoutMap: Record<GridLayout, string> = {
  "2col":       "content-grid content-grid-2",
  "3col":       "content-grid content-grid-3",
  "main-aside": "content-grid content-grid-12",
}

/**
 * ContentGrid — a responsive page-level grid wrapper.
 *
 * Layouts:
 *   "2col"       — 2 equal columns
 *   "3col"       — 3 equal columns
 *   "main-aside" — 2/3 + 1/3 at xl, stacked below
 *
 * Usage:
 *   <ContentGrid layout="main-aside">
 *     <div>Left column</div>
 *     <div>Right sidebar</div>
 *   </ContentGrid>
 */
export function ContentGrid({ layout = "2col", children, className = "" }: ContentGridProps) {
  return (
    <div className={`${layoutMap[layout]} ${className}`}>
      {children}
    </div>
  )
}
