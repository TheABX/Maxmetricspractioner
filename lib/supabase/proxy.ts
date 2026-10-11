import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const path = request.nextUrl.pathname;
  const publicPaths =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/join") ||
    path.startsWith("/auth") ||
    path.startsWith("/setup") ||
    path.startsWith("/api/sample-force-plate-pdf") ||
    path.startsWith("/api/sample-combined-pdf");

  if (!user && !publicPaths) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = path.startsWith("/me") ? "/join" : "/login";
    return NextResponse.redirect(redirectUrl);
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
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/me";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
