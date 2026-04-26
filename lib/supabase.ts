"use client"

import { createBrowserClient } from "@supabase/ssr"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Singleton browser-side Supabase client.
 *
 * Used in Client Components for real-time subscriptions, auth state listeners,
 * and direct queries that don't need server-side cookie passing.
 *
 * For Server Components and Server Actions, use {@link createServerSupabaseClient} instead.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
