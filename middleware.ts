import { NextResponse, type NextRequest } from "next/server";

function isPublicPath(path: string) {
  return (
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/join") ||
    path.startsWith("/auth") ||
    path.startsWith("/setup") ||
    path.startsWith("/api/sample-force-plate-pdf") ||
    path.startsWith("/api/sample-combined-pdf")
  );
}

export async function middleware(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const { updateSession } = await import("@/lib/supabase/proxy");
  return updateSession(request);
}

export const config = {
  matcher: [
    // `.+` excludes `/` so Edge never boots Supabase for the landing page.
    "/((?!_next/static|_next/image|favicon.ico|login|join|auth|setup|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).+)",
  ],
};
