import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

function isServerActionRequest(request: NextRequest) {
  return request.method === "POST" && request.headers.has("next-action")
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  const isProtectedRoute =
    path.startsWith("/dashboard") ||
    path.startsWith("/planner") ||
    path.startsWith("/schedule") ||
    path.startsWith("/onboarding")

  if (!isProtectedRoute) {
    return NextResponse.next({
      request: {
        headers: request.headers
      }
    })
  }

  const isServerAction = isServerActionRequest(request)

  const response = NextResponse.next({
    request: {
      headers: request.headers
    }
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.")
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        }
      }
    }
  })

  const isAuthRoute = path.startsWith("/auth/login") || path.startsWith("/auth/signup")
  let user: { id: string } | null = null

  // Refresh session if expired - required for Server Actions/RSC auth.
  // Never let auth-refresh failures crash middleware or server action responses.
  try {
    const {
      data: { user: resolvedUser }
    } = await supabase.auth.getUser()
    user = resolvedUser
  } catch {
    user = null
  }

  // Server Actions must never be redirected by middleware.
  // Redirect responses break the action protocol and surface as
  // "An unexpected response was received from the server." in the client.
  if (isServerAction) {
    return response
  }

  if (!user) {
    if (isAuthRoute) return response
    const redirectUrl = new URL("/auth/login", request.url)
    redirectUrl.searchParams.set("redirectTo", path)
    return NextResponse.redirect(redirectUrl)
  }

  // For protected routes, ensure profile exists; otherwise send to onboarding.
  // Never allow profile-fetch failures to crash middleware and surface 500s.
  let profile: { id: string } | null = null
  try {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle()
    profile = data as { id: string } | null
  } catch {
    return response
  }

  if (!profile && !path.startsWith("/onboarding")) {
    const redirectUrl = new URL("/onboarding", request.url)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
}
