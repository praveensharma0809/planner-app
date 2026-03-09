import { TopNav } from "@/app/dashboard/Sidebar"

export default function PlannerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen text-white" style={{ background: "var(--background)" }}>
      <div className="mesh-bg" />
      <TopNav />
      <main className="pt-14 min-h-screen">
        {children}
      </main>
    </div>
  )
}
