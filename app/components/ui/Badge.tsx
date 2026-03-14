import type { ReactNode } from "react"

export type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "accent"
export type BadgeSize    = "sm" | "md" | "lg"

interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  children: ReactNode
  className?: string
}

const variantClass: Record<BadgeVariant, string> = {
  default: "ui-badge-default",
  primary: "ui-badge-primary",
  success: "ui-badge-success",
  warning: "ui-badge-warning",
  danger:  "ui-badge-danger",
  accent:  "ui-badge-accent",
}

const sizeClass: Record<BadgeSize, string> = {
  sm: "ui-badge-sm",
  md: "",
  lg: "ui-badge-lg",
}

export function Badge({
  variant = "default",
  size = "md",
  className = "",
  children,
}: BadgeProps) {
  return (
    <span className={`ui-badge ${variantClass[variant]} ${sizeClass[size]} ${className}`}>
      {children}
    </span>
  )
}
