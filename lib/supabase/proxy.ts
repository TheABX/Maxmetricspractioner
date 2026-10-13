import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

function redirectTo(request: NextRequest, pathname: string) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  return NextResponse.redirect(redirectUrl);
}

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const publicPaths =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/join") ||
    path.startsWith("/auth") ||
    path.startsWith("/setup") ||
    path.startsWith("/api/sample-force-plate-pdf") ||
    path.startsWith("/api/sample-combined-pdf");

  // Landing is static and must never touch Supabase — that is what 500'd `/` on Vercel.
  if (path === "/") {
    return supabaseResponse;
  }

  const env = getSupabasePublicEnv();
  if (!env) {
    return supabaseResponse;
  }

  try {
    let response = supabaseResponse;
    const supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    const { data } = await supabase.auth.getClaims();
    const user = data?.claims;

    if (!user && !publicPaths) {
      return redirectTo(request, path.startsWith("/me") ? "/join" : "/login");
    }

    // Signed-in clients live under /me only.
    if (
      user?.sub &&
      !path.startsWith("/me") &&
      !path.startsWith("/join") &&
      !path.startsWith("/auth") &&
      !path.startsWith("/api")
    ) {
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("auth_user_id", String(user.sub))
        .maybeSingle();
      const isClientMeta = (user.user_metadata as { role?: string } | undefined)?.role === "client";
      if (client?.id || isClientMeta) {
        return redirectTo(request, "/me");
      }
    }

    return response;
  } catch {
    if (publicPaths) return supabaseResponse;
    return redirectTo(request, path.startsWith("/me") ? "/join" : "/login");
  }
}
