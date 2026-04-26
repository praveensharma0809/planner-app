"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { logger } from "@/lib/ops/logger"

interface UpdateProfileInput {
  full_name: string
  email?: string
  phone_number?: string
}

interface SavedProfileValues {
  fullName: string
  email: string
  phoneNumber: string
}

type UpdateProfileResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "PARTIAL_SUCCESS"; message: string; saved: SavedProfileValues }
  | { status: "SUCCESS"; saved: SavedProfileValues }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Indian mobile: 10 digits starting 6-9, optional +91 / 91 / 0 prefix and a single space or dash separator.
const PHONE_PATTERN = /^(?:\+?91[\s-]?|0)?[6-9]\d{9}$/

function normalizeOptional(value: string | undefined): string {
  return (value ?? "").trim()
}

function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  // Strip leading country code or trunk prefix to get the 10-digit subscriber number.
  const subscriber = digits.startsWith("91") && digits.length === 12
    ? digits.slice(2)
    : digits.startsWith("0") && digits.length === 11
      ? digits.slice(1)
      : digits
  return `+91${subscriber}`
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
    const rawPhone = normalizeOptional(input.phone_number)

    if (!fullName) {
      return { status: "ERROR", message: "Full name is required." }
    }

    if (normalizedEmail && !EMAIL_PATTERN.test(normalizedEmail)) {
      return { status: "ERROR", message: "Please enter a valid email address." }
    }

    if (rawPhone && !PHONE_PATTERN.test(rawPhone)) {
      return {
        status: "ERROR",
        message: "Enter a valid Indian mobile number (10 digits starting 6-9, optional +91 prefix).",
      }
    }

    const storedPhone = rawPhone ? normalizeIndianPhone(rawPhone) : null

    // Persist name + phone first so an email-change failure doesn't block unrelated edits.
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: storedPhone,
      })
      .eq("id", user.id)

    if (profileError) {
      return { status: "ERROR", message: profileError.message }
    }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/settings")

    const currentEmail = (user.email ?? "").trim().toLowerCase()
    const savedNamePhone: SavedProfileValues = {
      fullName,
      email: currentEmail,
      phoneNumber: storedPhone ?? "",
    }

    if (normalizedEmail && normalizedEmail !== currentEmail) {
      const { error: emailError } = await supabase.auth.updateUser({
        email: normalizedEmail,
      })

      if (emailError) {
        return {
          status: "PARTIAL_SUCCESS",
          message: `Name and phone saved, but email change failed: ${emailError.message}`,
          saved: savedNamePhone,
        }
      }

      return {
        status: "SUCCESS",
        saved: { ...savedNamePhone, email: normalizedEmail },
      }
    }

    return { status: "SUCCESS", saved: savedNamePhone }
  } catch (error) {
    logger.error("updateProfile", error)
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}
