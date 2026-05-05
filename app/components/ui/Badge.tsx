import type { ReactNode } from "react"

export type BadgeVariantNew = "mint" | "sky" | "lilac" | "peach" | "butter" | "rose" | "neutral"
/** @deprecated Legacy variant names — prefer the pastel names above */
export type BadgeVariantLegacy = "default" | "primary" | "success" | "warning" | "danger" | "accent"
export type BadgeVariant = BadgeVariantNew | BadgeVariantLegacy
export type BadgeSize = "sm" | "md" | "lg"

interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  children: ReactNode
  className?: string
  dot?: boolean
}

const variantClass: Record<BadgeVariant, string> = {
  mint:    "chip-mint",
  sky:     "chip-sky",
  lilac:   "chip-lilac",
  peach:   "chip-peach",
  butter:  "chip-butter",
  rose:    "chip-rose",
  neutral: "chip-neutral",
  default: "chip-neutral",
  primary: "chip-lilac",
  success: "chip-mint",
  warning: "chip-peach",
  danger:  "chip-rose",
  accent:  "chip-sky",
}

const sizeClass: Record<BadgeSize, string> = {
  sm: "text-[11px] px-2 py-px",
  md: "",
  lg: "text-[13px] px-3 py-0.5",
}

export function Badge({
  variant = "neutral",
  size = "md",
  className = "",
  dot,
  children,
}: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 ${variantClass[variant]} ${sizeClass[size]} ${className}`}>
      {dot && <span className="inline-block h-1 w-1 rounded-full bg-current opacity-60" aria-hidden="true" />}
      {children}
    </span>
  )
}
