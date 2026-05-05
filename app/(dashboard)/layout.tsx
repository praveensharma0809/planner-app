import { AppShell } from "@/app/components/layout/AppShell"
import { PageTransition } from "@/app/components/layout/PageTransition"

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppShell>
      <PageTransition>{children}</PageTransition>
    </AppShell>
  )
}
