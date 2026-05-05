import type { ReactNode, HTMLAttributes } from "react"

export type CardVariant = "default" | "elevated" | "ghost" | "gradient" | "interactive"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  children: ReactNode
  padding?: boolean
}

const variantClass: Record<CardVariant, string> = {
  default:  "bg-surface-panel rounded-card border border-border-hairline shadow-none",
  elevated: "bg-surface-panel rounded-card border border-border-hairline shadow-app",
  ghost:    "bg-transparent rounded-card border border-border-hairline",
  gradient: "bg-surface-panel rounded-card border border-border-hairline bg-gradient-to-br from-[#EDE7F6]/10 to-[#E3F2FD]/5",
  interactive: "bg-surface-panel rounded-card border border-border-hairline shadow-card transition-shadow duration-200 motion-safe:hover:shadow-pop",
}

export function Card({
  variant = "default",
  padding = true,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`${variantClass[variant]} ${padding ? "p-6" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
