import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Bypass static assets, API calls, and public images
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/catalog") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/results") ||
    pathname === "/health" ||
    pathname.startsWith("/health") ||
    pathname.includes(".") // static files like favicon.ico, robots.txt, etc.
  ) {
    return NextResponse.next();
  }

  // 2. Public Storefront routes are always accessible to everyone
  if (pathname.startsWith("/storefront")) {
    return NextResponse.next();
  }

  // 3. Admin / Dashboard routes check
  const secret = process.env.NEXTAUTH_SECRET || "placeholder-nextauth-secret";
  const token = await getToken({ req, secret });
  const isAdmin = token && String(token.role || "").toLowerCase() === "admin";

  // Root route ("/")
  if (pathname === "/") {
    if (isAdmin) {
      return NextResponse.next();
    }
    // Customers and unauthenticated visitors go straight to the boutique storefront
    const url = req.nextUrl.clone();
    url.pathname = "/storefront/home";
    return NextResponse.redirect(url);
  }

  // Protected Admin Management & Analytics routes
  const adminRoutes = [
    "/products",
    "/categories",
    "/orders",
    "/users",
    "/admin",
    "/settings",
    "/ai-assistant",
  ];

  const isProtectedAdminRoute = adminRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtectedAdminRoute) {
    if (!isAdmin) {
      const url = req.nextUrl.clone();
      url.pathname = "/storefront/home";
      url.searchParams.set("error", "admin_required");
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
