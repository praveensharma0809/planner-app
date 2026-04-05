import { AppShell } from "@/app/components/layout/AppShell"

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col items-stretch overflow-hidden">{children}</div>
    </AppShell>
  )
}
