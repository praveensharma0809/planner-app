"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type CompleteOnboardingResponse =
  | { status: "SUCCESS" }
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }

export async function completeOnboarding(): Promise<CompleteOnboardingResponse> {
  try {
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
          full_name: user.email?.split("@")[0] ?? "User",
          onboarding_completed: true,
        },
        { onConflict: "id" }
      )

    if (error) {
      return {
        status: "ERROR",
        message: "Could not mark onboarding as complete. Please try again.",
      }
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
