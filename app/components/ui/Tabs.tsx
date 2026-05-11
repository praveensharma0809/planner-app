"use client"

"use client"

import { type ReactNode, useState, useRef, useEffect, useCallback } from "react"

interface Tab {
  id: string
  label: string
  content: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  className?: string
  onTabChange?: (tabId: string) => void
}

export function Tabs({ tabs, defaultTab, className = "", onTabChange }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id)
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 })
  const listRef = useRef<HTMLDivElement>(null)

  const current = tabs.find((t) => t.id === active)

  const updateIndicator = useCallback((tabId: string) => {
    if (!listRef.current) return
    const activeBtn = listRef.current.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement | null
    if (activeBtn) {
      const rect = activeBtn.getBoundingClientRect()
      const parentRect = listRef.current.getBoundingClientRect()
      setIndicatorStyle({
        left: rect.left - parentRect.left,
        width: rect.width,
      })
    }
  }, [])

  useEffect(() => {
    updateIndicator(active)
  }, [active, updateIndicator])

  return (
    <div className={`ui-tabs-root min-h-0 flex-1 ${className}`}>
      <div className="ui-tabs-list relative" role="tablist" ref={listRef}>
        <div
          className="absolute top-1 bottom-1 rounded-full bg-surface-card shadow-[var(--shadow-card)] transition-all duration-200 ease-out"
          style={{ left: `${indicatorStyle.left}px`, width: `${indicatorStyle.width}px` }}
        />
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === active}
            onClick={() => { setActive(tab.id); onTabChange?.(tab.id) }}
            data-tab-id={tab.id}
            className={`ui-tabs-trigger relative z-10 ${tab.id === active ? "ui-tabs-trigger-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="min-h-0 flex-1 flex flex-col">{current?.content}</div>
    </div>
  )
}
