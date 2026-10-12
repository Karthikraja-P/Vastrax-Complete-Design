import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(req: NextRequest) {
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
  const secret = process.env.NEXTAUTH_SECRET;
  const token = secret ? await getToken({ req, secret }) : null;
  const role = String(token?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const businessPermissions = Array.isArray(token?.businessPermissions) ? token.businessPermissions : [];
  const canUseBusinessPage = (pathname.startsWith("/crm") && businessPermissions.includes("crm"))
    || (pathname.startsWith("/erp") && businessPermissions.includes("erp"));

  // Root route ("/")
  if (pathname === "/") {
    if (isAdmin) {
      return NextResponse.next();
    }
    // Visitors and customers get the storefront landing page AT "/" (rewrite keeps the URL)
    const url = req.nextUrl.clone();
    url.pathname = "/storefront/home";
    return NextResponse.rewrite(url);
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
    "/crm",
    "/erp",
  ];

  const isProtectedAdminRoute = adminRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtectedAdminRoute) {
    if (!isAdmin && !canUseBusinessPage) {
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
