"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface UpdateProfileInput {
  full_name: string
  email?: string
  phone_number?: string
}

type UpdateProfileResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[+]?[-()\s0-9]{7,20}$/

function normalizeOptional(value: string | undefined): string {
  return (value ?? "").trim()
}

export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    // Validate
    const fullName = input.full_name.trim()
    const normalizedEmail = normalizeOptional(input.email).toLowerCase()
    const phoneNumber = normalizeOptional(input.phone_number)

    if (!fullName) {
      return { status: "ERROR", message: "Full name is required." }
    }

    if (normalizedEmail && !EMAIL_PATTERN.test(normalizedEmail)) {
      return { status: "ERROR", message: "Please enter a valid email address." }
    }

    if (phoneNumber && !PHONE_PATTERN.test(phoneNumber)) {
      return { status: "ERROR", message: "Please enter a valid phone number." }
    }

    const phoneDigits = phoneNumber.replace(/\D/g, "")
    if (phoneNumber && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
      return { status: "ERROR", message: "Please enter a valid phone number." }
    }

    const currentEmail = (user.email ?? "").trim().toLowerCase()
    if (normalizedEmail && normalizedEmail !== currentEmail) {
      const { error: emailError } = await supabase.auth.updateUser({
        email: normalizedEmail,
      })

      if (emailError) {
        return { status: "ERROR", message: emailError.message }
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phoneNumber || null,
      })
      .eq("id", user.id)

    if (error) {
      return { status: "ERROR", message: error.message }
    }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/settings")
    return { status: "SUCCESS" }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}
