import type { ReactNode, ButtonHTMLAttributes } from "react"

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success"
export type ButtonSize = "sm" | "md" | "lg"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const variantClass: Record<ButtonVariant, string> = {
  primary:   "bg-action-primary-bg text-action-primary-fg hover:bg-action-primary-bg-hover shadow-none",
  secondary: "bg-canvas text-text-primary border border-border-subtle hover:bg-surface-hover",
  ghost:     "bg-transparent text-text-primary hover:bg-surface-hover",
  danger:    "bg-pastel-rose text-pastel-rose-text hover:opacity-90",
  success:   "bg-pastel-mint text-pastel-mint-text hover:opacity-90",
}

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-pill font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none motion-safe:active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
