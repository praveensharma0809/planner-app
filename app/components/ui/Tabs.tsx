"use client"

import type { ReactNode } from "react"
import { useState } from "react"

interface Tab {
  id: string
  label: string
  content: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  className?: string
}

export function Tabs({ tabs, defaultTab, className = "" }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id)
  const current = tabs.find((t) => t.id === active)

  return (
    <div className={`ui-tabs-root ${className}`}>
      <div className="ui-tabs-list" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === active}
            onClick={() => setActive(tab.id)}
            className={`ui-tabs-trigger ${tab.id === active ? "ui-tabs-trigger-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  )
}
