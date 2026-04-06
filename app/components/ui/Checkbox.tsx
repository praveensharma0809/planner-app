"use client"

import { type InputHTMLAttributes, useState, useEffect, useRef } from "react"

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string
  description?: string
}

export function Checkbox({ label, description, className = "", id, ...props }: CheckboxProps) {
  const inputId        = id ?? `cb-${label?.toLowerCase().replace(/\s+/g, "-")}`
  const prevCheckedRef = useRef(props.checked)
  const [bouncing, setBouncing] = useState(false)

  useEffect(() => {
    let t0: number | null = null
    let t1: number | null = null

    if (!prevCheckedRef.current && props.checked) {
      t0 = window.setTimeout(() => {
        setBouncing(true)
        t1 = window.setTimeout(() => setBouncing(false), 230)
      }, 0)
    }

    prevCheckedRef.current = props.checked

    return () => {
      if (t0 !== null) {
        window.clearTimeout(t0)
      }
      if (t1 !== null) {
        window.clearTimeout(t1)
      }
    }
  }, [props.checked])

  return (
    <label
      htmlFor={inputId}
      className={`flex items-start gap-3 cursor-pointer group ${props.disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
    >
      <div className={`ui-checkbox mt-0.5 ${props.checked ? "ui-checkbox-checked" : ""} ${bouncing ? "ui-checkbox-bounce" : ""}`}>
        {props.checked && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="2 6 5 9 10 3" />
          </svg>
        )}
      </div>
      <input
        type="checkbox"
        id={inputId}
        className="sr-only"
        {...props}
      />
      {(label || description) && (
        <div className="flex flex-col gap-0.5 min-w-0">
          {label && (
            <span className="text-[13.5px] font-medium" style={{ color: "var(--sh-text-primary)" }}>
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs" style={{ color: "var(--sh-text-muted)" }}>
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  )
}
