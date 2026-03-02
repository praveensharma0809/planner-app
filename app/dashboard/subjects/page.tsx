import { createServerSupabaseClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SubjectWorkloadView } from "@/lib/types/db"
import { SubjectsDataTable } from "./SubjectsDataTable"

export default async function SubjectsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: subjectsData } = await supabase
    .from("subject_workload_view")
    .select("*")
    .eq("user_id", user.id)
    .order("priority", { ascending: true })
    .order("deadline", { ascending: true })

  const subjects = (subjectsData ?? []) as SubjectWorkloadView[]

  return <SubjectsDataTable initialSubjects={subjects} />
}