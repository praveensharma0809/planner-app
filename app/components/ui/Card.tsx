import type { ReactNode, HTMLAttributes } from "react"

export type CardVariant = "default" | "elevated" | "ghost" | "gradient"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  children: ReactNode
  padding?: boolean
}

const variantClass: Record<CardVariant, string> = {
  default:  "ui-card",
  elevated: "ui-card-elevated",
  ghost:    "ui-card-ghost",
  gradient: "ui-card-gradient",
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
      className={`${variantClass[variant]} ${padding ? "p-5" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
