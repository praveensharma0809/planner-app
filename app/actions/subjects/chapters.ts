"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type ChapterActionResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export type AddChapterResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; chapterId: string }

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

  revalidatePath("/dashboard/subjects")
  return { status: "SUCCESS", chapterId: inserted.id }
}

export async function updateChapter(chapterId: string, name: string): Promise<ChapterActionResponse> {
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
    .update({ name: trimmedName })
    .eq("id", chapterId)
    .eq("user_id", user.id)

  if (error) {
    return { status: "ERROR", message: error.message }
  }

  revalidatePath("/dashboard/subjects")
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

  revalidatePath("/dashboard/subjects")
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

  revalidatePath("/dashboard/subjects")
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

  revalidatePath("/dashboard/subjects")
  return { status: "SUCCESS" }
}
