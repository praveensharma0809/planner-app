import type { ReactNode, ButtonHTMLAttributes } from "react"

export type ButtonVariant = "primary" | "ghost" | "danger" | "success"
export type ButtonSize    = "sm" | "md" | "lg"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "ui-btn-primary",
  ghost:   "ui-btn-ghost",
  danger:  "ui-btn-danger",
  success: "ui-btn-success",
}

const sizeClass: Record<ButtonSize, string> = {
  sm: "ui-btn-sm",
  md: "ui-btn-md",
  lg: "ui-btn-lg",
}

export function Button({
  variant = "ghost",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`ui-btn ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
