import { AppShell } from "@/app/components/layout/AppShell"

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}
