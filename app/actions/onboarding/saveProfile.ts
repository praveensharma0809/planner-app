"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"

interface SaveOnboardingProfileInput {
  full_name: string
}

export type SaveOnboardingProfileResponse =
  | { status: "SUCCESS" }
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }

function mapProfileWriteError(errorMessage: string | null | undefined): string {
  const normalized = (errorMessage ?? "").toLowerCase()

  if (normalized.includes("permission") || normalized.includes("row-level security")) {
    return "Your session has expired. Please log in again."
  }

  return "Could not save your profile right now. Please try again."
}

export async function saveOnboardingProfile(
  input: SaveOnboardingProfileInput
): Promise<SaveOnboardingProfileResponse> {
  try {
    const fullName = input.full_name.trim()
    if (!fullName) {
      return { status: "ERROR", message: "Full name is required." }
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          full_name: fullName,
        },
        { onConflict: "id" }
      )
      .select("id")
      .single()

    if (error) {
      return { status: "ERROR", message: mapProfileWriteError(error.message) }
    }

    revalidatePath("/")
    revalidatePath("/onboarding")
    revalidatePath("/dashboard")

    return { status: "SUCCESS" }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}