"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { normalizeOptionalDate, validateDateWindow } from "@/lib/planner/contracts"

function revalidateStructureViews() {
  revalidatePath("/dashboard/subjects")
  revalidatePath("/dashboard")
  revalidatePath("/planner")
}

export type ChapterActionResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export type AddChapterResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; chapterId: string }

interface ChapterMetadataInput {
  earliest_start?: string | null
  deadline?: string | null
  rest_after_days?: number
}

export async function addChapter(subjectId: string, name: string): Promise<AddChapterResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const trimmedName = name.trim()
  if (!trimmedName) {
    return { status: "ERROR", message: "Chapter name is required." }
  }

  const { data: subject, error: subjectError } = await supabase
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (subjectError) {
    return { status: "ERROR", message: subjectError.message }
  }

  if (!subject) {
    return { status: "ERROR", message: "Subject not found." }
  }

  const { data: lastChapter, error: lastError } = await supabase
    .from("topics")
    .select("sort_order")
    .eq("user_id", user.id)
    .eq("subject_id", subjectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastError) {
    return { status: "ERROR", message: lastError.message }
  }

  const nextSortOrder = (lastChapter?.sort_order ?? -1) + 1

  const { data: inserted, error: insertError } = await supabase
    .from("topics")
    .insert({
      user_id: user.id,
      subject_id: subjectId,
      name: trimmedName,
      sort_order: nextSortOrder,
    })
    .select("id")
    .single()

  if (insertError || !inserted) {
    return { status: "ERROR", message: insertError?.message ?? "Could not create chapter." }
  }

  revalidateStructureViews()
  return { status: "SUCCESS", chapterId: inserted.id }
}

export async function updateChapter(
  chapterId: string,
  name: string,
  metadata?: ChapterMetadataInput
): Promise<ChapterActionResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const trimmedName = name.trim()
  if (!trimmedName) {
    return { status: "ERROR", message: "Chapter name is required." }
  }

  const { data: existing, error: existingError } = await supabase
    .from("topics")
    .select("id, subject_id")
    .eq("id", chapterId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existingError) {
    return { status: "ERROR", message: existingError.message }
  }

  if (!existing) {
    return { status: "ERROR", message: "Chapter not found." }
  }

  const chapterStart = normalizeOptionalDate(metadata?.earliest_start)
  const chapterDeadline = normalizeOptionalDate(metadata?.deadline)
  const chapterDateWindowError = validateDateWindow(
    chapterStart,
    chapterDeadline,
    "Chapter start date",
    "chapter deadline"
  )
  if (chapterDateWindowError) {
    return {
      status: "ERROR",
      message: chapterDateWindowError,
    }
  }

  const { data: parentSubject, error: parentSubjectError } = await supabase
    .from("subjects")
    .select("id, name, deadline")
    .eq("id", existing.subject_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (parentSubjectError) {
    return { status: "ERROR", message: parentSubjectError.message }
  }

  if (!parentSubject) {
    return { status: "ERROR", message: "Parent subject not found." }
  }

  const subjectDeadline = normalizeOptionalDate(parentSubject.deadline)

  if (subjectDeadline && chapterDeadline && chapterDeadline > subjectDeadline) {
    return {
      status: "ERROR",
      message: `Chapter deadline cannot be after subject "${parentSubject.name}" deadline.`,
    }
  }

  const topicUpdatePayload: Record<string, unknown> = { name: trimmedName }

  if (metadata) {
    topicUpdatePayload.earliest_start = chapterStart
    topicUpdatePayload.deadline = chapterDeadline
    topicUpdatePayload.rest_after_days = Math.max(
      0,
      Math.trunc(metadata.rest_after_days ?? 0)
    )
  }

  const { error } = await supabase
    .from("topics")
    .update(topicUpdatePayload)
    .eq("id", chapterId)
    .eq("user_id", user.id)

  if (error) {
    return { status: "ERROR", message: error.message }
  }

  revalidateStructureViews()
  return { status: "SUCCESS" }
}

export async function deleteChapter(chapterId: string): Promise<ChapterActionResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const { data: existing, error: existingError } = await supabase
    .from("topics")
    .select("id")
    .eq("id", chapterId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existingError) {
    return { status: "ERROR", message: existingError.message }
  }

  if (!existing) {
    return { status: "ERROR", message: "Chapter not found." }
  }

  const { error } = await supabase
    .from("topics")
    .delete()
    .eq("id", chapterId)
    .eq("user_id", user.id)

  if (error) {
    return { status: "ERROR", message: error.message }
  }

  revalidateStructureViews()
  return { status: "SUCCESS" }
}

export async function archiveChapter(chapterId: string): Promise<ChapterActionResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const { data: existing, error: existingError } = await supabase
    .from("topics")
    .select("archived")
    .eq("id", chapterId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existingError) {
    return { status: "ERROR", message: existingError.message }
  }

  if (!existing) {
    return { status: "ERROR", message: "Chapter not found." }
  }

  const { error } = await supabase
    .from("topics")
    .update({ archived: true })
    .eq("id", chapterId)
    .eq("user_id", user.id)

  if (error) {
    return { status: "ERROR", message: error.message }
  }

  revalidateStructureViews()
  return { status: "SUCCESS" }
}

export async function unarchiveChapter(chapterId: string): Promise<ChapterActionResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const { data: existing, error: existingError } = await supabase
    .from("topics")
    .select("archived")
    .eq("id", chapterId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existingError) {
    return { status: "ERROR", message: existingError.message }
  }

  if (!existing) {
    return { status: "ERROR", message: "Chapter not found." }
  }

  const { error } = await supabase
    .from("topics")
    .update({ archived: false })
    .eq("id", chapterId)
    .eq("user_id", user.id)

  if (error) {
    return { status: "ERROR", message: error.message }
  }

  revalidateStructureViews()
  return { status: "SUCCESS" }
}
