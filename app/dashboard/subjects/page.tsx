import { createServerSupabaseClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Subject } from "@/lib/types/db"
import { SubjectCard } from "./SubjectCard"
import { AddSubjectForm } from "./AddSubjectForm"

export default async function SubjectsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data } = await supabase
    .from("subjects")
    .select(
      "id, user_id, name, total_items, completed_items, avg_duration_minutes, deadline, priority, mandatory, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const subjects: Subject[] = data ?? []
  const activeSubjects = subjects.filter(s => !s.archived)
  const archivedSubjects = subjects.filter(s => s.archived)

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2 gradient-text">Subjects</h1>
      <p className="text-sm text-white/40 mb-8">Manage your subjects, deadlines, and subtopics</p>

      <AddSubjectForm />

      {activeSubjects.length === 0 && archivedSubjects.length === 0 ? (
        <div className="glass-card text-center !py-16 space-y-3">
          <div className="text-5xl">&#x1F4DA;</div>
          <h2 className="text-lg font-semibold text-white/80">No subjects yet</h2>
          <p className="text-sm text-white/40 max-w-sm mx-auto">
            Add your first subject above to start tracking progress and generating a plan.
          </p>
        </div>
      ) : activeSubjects.length === 0 ? (
        <div className="glass-card text-center !py-8 space-y-2">
          <p className="text-sm text-white/50">All subjects are archived. Restore one below to continue.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeSubjects.map((subject) => (
            <SubjectCard key={subject.id} subject={subject} />
          ))}
        </div>
      )}

      {archivedSubjects.length > 0 && (
        <div className="mt-10 space-y-4">
          <h2 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Archived ({archivedSubjects.length})</h2>
          <div className="space-y-4 opacity-50">
            {archivedSubjects.map((subject) => (
              <SubjectCard key={subject.id} subject={subject} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}