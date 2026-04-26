import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Creates a Supabase client configured for the server environment (Server Components
 * and Server Actions). It reads and writes cookies via `next/headers` to maintain
 * the user's session.
 *
 * @throws {Error} If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
 *   environment variables are missing.
 * @returns A Supabase client instance with cookie-based auth.
 *
 * @example
 * const supabase = await createServerSupabaseClient()
 * const { data: { user } } = await supabase.auth.getUser()
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.")
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options)
        }
      }
    }
  })
}
