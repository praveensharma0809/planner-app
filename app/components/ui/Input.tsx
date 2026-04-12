import type { InputHTMLAttributes } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className = "", id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-")
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold"
          style={{ color: "var(--sh-text-secondary)" }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`ui-input ${error ? "border-[rgba(239,68,68,0.50)]" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
      {!error && hint && <p className="text-xs" style={{ color: "var(--sh-text-muted)" }}>{hint}</p>}
    </div>
  )
}
