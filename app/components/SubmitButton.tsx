"use client"

import { useFormStatus } from "react-dom"

interface Props {
  children: React.ReactNode
  pendingText?: string
  className?: string
  "aria-label"?: string
}

export function SubmitButton({
  children,
  pendingText,
  className,
  "aria-label": ariaLabel,
}: Props) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      aria-label={ariaLabel}
      aria-disabled={pending}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  )
}
