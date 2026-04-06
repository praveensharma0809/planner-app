"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import {
  MAX_SESSION_LENGTH_MINUTES,
  MIN_SESSION_LENGTH_MINUTES,
} from "@/lib/planner/draft"

type TaskNamingPlacement = "suffix" | "prefix"

type TaskActionResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

type CreateSubjectTaskInput = {
  chapterId: string
  title: string
}

type BulkCreateSubjectTasksInput = {
  chapterId: string
  baseName: string
  count: number
  startAt: number
  numberPadding: number
  separator: string
  placement: TaskNamingPlacement
}

type DeleteSubjectTasksInput = {
  chapterId: string
  taskIds: string[]
}

type UpdateTaskDurationInput = {
  taskId: string
  durationMinutes: number
}

type BulkUpdateTaskDurationInput = {
  chapterId: string
  taskIds: string[]
  durationMinutes: number
}

type CreateSubjectTaskResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; taskId: string }

type BulkCreateSubjectTasksResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; createdCount: number }

type DeleteSubjectTasksResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; deletedCount: number }

type BulkUpdateTaskDurationResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; updatedCount: number }

export type CompleteSubjectTaskResponse =
  | { status: "SUCCESS" }
  | { status: "UNAUTHORIZED" }
  | { status: "NOT_FOUND" }
  | { status: "ERROR"; message: string }

export type UncompleteSubjectTaskResponse =
  | { status: "SUCCESS" }
  | { status: "UNAUTHORIZED" }
  | { status: "NOT_FOUND" }
  | { status: "ERROR"; message: string }

const DEFAULT_DURATION_MINUTES = 60

function revalidateTaskViews() {
  revalidatePath("/dashboard/subjects")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/calendar")
  revalidatePath("/schedule")
  revalidatePath("/planner")
}

function normalizeDurationMinutes(rawMinutes: number): number {
  const parsed = Number.isFinite(rawMinutes) ? Math.trunc(rawMinutes) : MIN_SESSION_LENGTH_MINUTES
  return clampNumber(parsed, MIN_SESSION_LENGTH_MINUTES, MAX_SESSION_LENGTH_MINUTES)
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function composeTaskName(
  baseName: string,
  index: number,
  placement: TaskNamingPlacement,
  separator: string,
  numberPadding: number
): string {
  const numeric = String(index).padStart(Math.max(0, numberPadding), "0")
  const cleanSeparator = separator.trim()

  if (placement === "prefix") {
    return cleanSeparator ? `${numeric}${cleanSeparator}${baseName}` : `${numeric}${baseName}`
  }

  return cleanSeparator ? `${baseName}${cleanSeparator}${numeric}` : `${baseName}${numeric}`
}

async function resolveChapter(
  chapterId: string,
  userId: string
): Promise<
  | { ok: true; subjectId: string }
  | { ok: false; message: string }
> {
  const supabase = await createServerSupabaseClient()

  const { data: chapter, error: chapterError } = await supabase
    .from("topics")
    .select("id, subject_id")
    .eq("id", chapterId)
    .eq("user_id", userId)
    .maybeSingle()

  if (chapterError) {
    return { ok: false, message: chapterError.message }
  }

  if (!chapter) {
    return { ok: false, message: "Chapter not found." }
  }

  return { ok: true, subjectId: chapter.subject_id }
}

async function getNextTaskSortOrder(
  chapterId: string,
  userId: string
): Promise<
  | { ok: true; nextSortOrder: number }
  | { ok: false; message: string }
> {
  const supabase = await createServerSupabaseClient()

  const { data: lastTask, error: lastTaskError } = await supabase
    .from("topic_tasks")
    .select("sort_order")
    .eq("user_id", userId)
    .eq("topic_id", chapterId)
    .order("sort_order", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastTaskError) {
    return { ok: false, message: lastTaskError.message }
  }

  return {
    ok: true,
    nextSortOrder: (lastTask?.sort_order ?? -1) + 1,
  }
}

export async function createSubjectTask(
  input: CreateSubjectTaskInput
): Promise<CreateSubjectTaskResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const title = input.title.trim()
    if (!title) {
      return { status: "ERROR", message: "Task title is required." }
    }

    const chapter = await resolveChapter(input.chapterId, user.id)
    if (!chapter.ok) {
      return { status: "ERROR", message: chapter.message }
    }

    const nextSortOrder = await getNextTaskSortOrder(input.chapterId, user.id)
    if (!nextSortOrder.ok) {
      return { status: "ERROR", message: nextSortOrder.message }
    }

    const { data: inserted, error: insertError } = await supabase
      .from("topic_tasks")
      .insert({
        user_id: user.id,
        subject_id: chapter.subjectId,
        topic_id: input.chapterId,
        title,
        duration_minutes: DEFAULT_DURATION_MINUTES,
        completed: false,
        sort_order: nextSortOrder.nextSortOrder,
      })
      .select("id")
      .single()

    if (insertError || !inserted) {
      return { status: "ERROR", message: insertError?.message ?? "Could not create task." }
    }

    revalidateTaskViews()
    return { status: "SUCCESS", taskId: inserted.id }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}

export async function bulkCreateSubjectTasks(
  input: BulkCreateSubjectTasksInput
): Promise<BulkCreateSubjectTasksResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const baseName = input.baseName.trim()
    if (!baseName) {
      return { status: "ERROR", message: "Base task name is required." }
    }

    const count = clampNumber(Math.trunc(input.count || 0), 1, 100)
    const startAt = clampNumber(Math.trunc(input.startAt || 1), 1, 10000)
    const numberPadding = clampNumber(Math.trunc(input.numberPadding || 0), 0, 6)
    const separator = typeof input.separator === "string" ? input.separator : "-"
    const placement = input.placement === "prefix" ? "prefix" : "suffix"

    const chapter = await resolveChapter(input.chapterId, user.id)
    if (!chapter.ok) {
      return { status: "ERROR", message: chapter.message }
    }

    const nextSortOrder = await getNextTaskSortOrder(input.chapterId, user.id)
    if (!nextSortOrder.ok) {
      return { status: "ERROR", message: nextSortOrder.message }
    }

    const rows = Array.from({ length: count }, (_, offset) => {
      const index = startAt + offset
      return {
        user_id: user.id,
        subject_id: chapter.subjectId,
        topic_id: input.chapterId,
        title: composeTaskName(baseName, index, placement, separator, numberPadding),
        duration_minutes: DEFAULT_DURATION_MINUTES,
        completed: false,
        sort_order: nextSortOrder.nextSortOrder + offset,
      }
    })

    const { data: inserted, error: insertError } = await supabase
      .from("topic_tasks")
      .insert(rows)
      .select("id")

    if (insertError) {
      return { status: "ERROR", message: insertError.message }
    }

    revalidateTaskViews()
    return { status: "SUCCESS", createdCount: inserted?.length ?? count }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}

export async function updateSubjectTaskTitle(taskId: string, title: string): Promise<TaskActionResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      return { status: "ERROR", message: "Task title is required." }
    }

    const { data: existing, error: existingError } = await supabase
      .from("topic_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingError) {
      return { status: "ERROR", message: existingError.message }
    }

    if (!existing) {
      return { status: "ERROR", message: "Task not found." }
    }

    const { error } = await supabase
      .from("topic_tasks")
      .update({ title: trimmedTitle })
      .eq("id", taskId)
      .eq("user_id", user.id)

    if (error) {
      return { status: "ERROR", message: error.message }
    }

    revalidateTaskViews()

    return { status: "SUCCESS" }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}

export async function updateSubjectTaskDuration(
  input: UpdateTaskDurationInput
): Promise<TaskActionResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    if (!input.taskId || typeof input.taskId !== "string") {
      return { status: "ERROR", message: "Task ID is required." }
    }

    const durationMinutes = normalizeDurationMinutes(input.durationMinutes)

    const { data: existing, error: existingError } = await supabase
      .from("topic_tasks")
      .select("id")
      .eq("id", input.taskId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingError) {
      return { status: "ERROR", message: existingError.message }
    }

    if (!existing) {
      return { status: "ERROR", message: "Task not found." }
    }

    const { error: updateError } = await supabase
      .from("topic_tasks")
      .update({ duration_minutes: durationMinutes })
      .eq("id", input.taskId)
      .eq("user_id", user.id)

    if (updateError) {
      return { status: "ERROR", message: updateError.message }
    }

    revalidateTaskViews()
    return { status: "SUCCESS" }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}

export async function bulkUpdateSubjectTaskDuration(
  input: BulkUpdateTaskDurationInput
): Promise<BulkUpdateTaskDurationResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const chapter = await resolveChapter(input.chapterId, user.id)
    if (!chapter.ok) {
      return { status: "ERROR", message: chapter.message }
    }

    const uniqueTaskIds = Array.from(new Set(input.taskIds.filter(Boolean)))
    if (uniqueTaskIds.length === 0) {
      return { status: "ERROR", message: "Select at least one task." }
    }

    const durationMinutes = normalizeDurationMinutes(input.durationMinutes)

    const { data: existingTasks, error: existingTasksError } = await supabase
      .from("topic_tasks")
      .select("id")
      .eq("user_id", user.id)
      .eq("topic_id", input.chapterId)
      .in("id", uniqueTaskIds)

    if (existingTasksError) {
      return { status: "ERROR", message: existingTasksError.message }
    }

    if ((existingTasks?.length ?? 0) !== uniqueTaskIds.length) {
      return { status: "ERROR", message: "Some selected tasks were not found." }
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from("topic_tasks")
      .update({ duration_minutes: durationMinutes })
      .eq("user_id", user.id)
      .eq("topic_id", input.chapterId)
      .in("id", uniqueTaskIds)
      .select("id")

    if (updateError) {
      return { status: "ERROR", message: updateError.message }
    }

    revalidateTaskViews()
    return { status: "SUCCESS", updatedCount: updatedRows?.length ?? uniqueTaskIds.length }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}

export async function deleteSubjectTask(taskId: string): Promise<TaskActionResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const { data: existing, error: existingError } = await supabase
      .from("topic_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingError) {
      return { status: "ERROR", message: existingError.message }
    }

    if (!existing) {
      return { status: "ERROR", message: "Task not found." }
    }

    const { error } = await supabase
      .from("topic_tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", user.id)

    if (error) {
      return { status: "ERROR", message: error.message }
    }

    revalidateTaskViews()

    return { status: "SUCCESS" }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}

export async function deleteSubjectTasks(
  input: DeleteSubjectTasksInput
): Promise<DeleteSubjectTasksResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const chapter = await resolveChapter(input.chapterId, user.id)
    if (!chapter.ok) {
      return { status: "ERROR", message: chapter.message }
    }

    const uniqueTaskIds = Array.from(new Set(input.taskIds.filter(Boolean)))
    if (uniqueTaskIds.length === 0) {
      return { status: "ERROR", message: "Select at least one task." }
    }

    const { data: deletedRows, error: deleteError } = await supabase
      .from("topic_tasks")
      .delete()
      .eq("user_id", user.id)
      .eq("topic_id", input.chapterId)
      .in("id", uniqueTaskIds)
      .select("id")

    if (deleteError) {
      return { status: "ERROR", message: deleteError.message }
    }

    revalidateTaskViews()

    return { status: "SUCCESS", deletedCount: deletedRows?.length ?? 0 }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}

type ReorderTasksInput = {
  chapterId: string
  taskIds: string[]
}

export async function reorderTasks(input: ReorderTasksInput): Promise<TaskActionResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const chapter = await resolveChapter(input.chapterId, user.id)
    if (!chapter.ok) {
      return { status: "ERROR", message: chapter.message }
    }

    const uniqueTaskIds = Array.from(new Set(input.taskIds.filter(Boolean)))
    if (uniqueTaskIds.length === 0) {
      return { status: "ERROR", message: "No tasks provided for reordering." }
    }

    const { data: existingTasks, error: existingTasksError } = await supabase
      .from("topic_tasks")
      .select("id")
      .eq("user_id", user.id)
      .eq("topic_id", input.chapterId)
      .in("id", uniqueTaskIds)

    if (existingTasksError) {
      return { status: "ERROR", message: existingTasksError.message }
    }

    if ((existingTasks?.length ?? 0) !== uniqueTaskIds.length) {
      return { status: "ERROR", message: "Some tasks could not be found for reordering." }
    }

    for (let index = 0; index < uniqueTaskIds.length; index += 1) {
      const { error: updateError } = await supabase
        .from("topic_tasks")
        .update({ sort_order: index })
        .eq("id", uniqueTaskIds[index])
        .eq("user_id", user.id)
        .eq("topic_id", input.chapterId)

      if (updateError) {
        return { status: "ERROR", message: updateError.message }
      }
    }

    revalidateTaskViews()
    return { status: "SUCCESS" }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}

export async function completeSubjectTask(taskId: string): Promise<CompleteSubjectTaskResponse> {
  try {
    if (!taskId || typeof taskId !== "string") {
      return { status: "NOT_FOUND" }
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const { data: updatedTask, error: updateError } = await supabase
      .from("topic_tasks")
      .update({ completed: true })
      .eq("id", taskId)
      .eq("user_id", user.id)
      .eq("completed", false)
      .select("id")
      .maybeSingle()

    if (updateError) {
      return { status: "ERROR", message: updateError.message }
    }

    if (!updatedTask) {
      return { status: "NOT_FOUND" }
    }

    revalidateTaskViews()
    return { status: "SUCCESS" }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}

export async function uncompleteSubjectTask(taskId: string): Promise<UncompleteSubjectTaskResponse> {
  try {
    if (!taskId || typeof taskId !== "string") {
      return { status: "NOT_FOUND" }
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const { data: updatedTask, error: updateError } = await supabase
      .from("topic_tasks")
      .update({ completed: false })
      .eq("id", taskId)
      .eq("user_id", user.id)
      .eq("completed", true)
      .select("id")
      .maybeSingle()

    if (updateError) {
      return { status: "ERROR", message: updateError.message }
    }

    if (!updatedTask) {
      return { status: "NOT_FOUND" }
    }

    revalidateTaskViews()
    return { status: "SUCCESS" }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}
