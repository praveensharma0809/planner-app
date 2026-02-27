import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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

  // Refresh session if expired - required for Server Actions/RSC auth
  const {
    data: { user }
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  const isProtectedRoute =
    path.startsWith("/dashboard") ||
    path.startsWith("/planner") ||
    path.startsWith("/onboarding")

  const isAuthRoute = path.startsWith("/auth/login") || path.startsWith("/auth/signup")

  if (!isProtectedRoute) {
    return response
  }

  if (!user) {
    if (isAuthRoute) return response
    const redirectUrl = new URL("/auth/login", request.url)
    redirectUrl.searchParams.set("redirectTo", path)
    return NextResponse.redirect(redirectUrl)
  }

  // For protected routes, ensure profile exists; otherwise send to onboarding
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()

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

