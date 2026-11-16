import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const key = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-only-secret-change-me");

function redirectToLogin(req: NextRequest, loginPath: string) {
  const loginUrl = new URL(loginPath, req.url);
  loginUrl.searchParams.set("returnTo", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("session")?.value;
  let role: string | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, key());
      role = payload.role as string;
    } catch {
      role = null;
    }
  }
  if (pathname === "/superadmin" || pathname.startsWith("/superadmin/")) {
    const canonicalPath = pathname.replace(/^\/superadmin/, "/super-admin");
    return NextResponse.rewrite(new URL(`${canonicalPath}${req.nextUrl.search}`, req.url));
  }

  const isRestaurantLogin = pathname === "/admin/login";

  if (
    (pathname.startsWith("/dashboard") || pathname === "/admin") &&
    !isRestaurantLogin &&
    role !== "restaurant_admin"
  ) {
    if (role === "super_admin") {
      return NextResponse.redirect(new URL("/super-admin", req.url));
    }
    return redirectToLogin(req, "/admin/login");
  }
  if (
    pathname.startsWith("/super-admin") &&
    role !== "super_admin"
  ) {
    if (role === "restaurant_admin") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return redirectToLogin(req, "/login");
  }
  if (pathname.startsWith("/admin/") && !isRestaurantLogin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/dashboard/:path*",
    "/super-admin/:path*",
    "/superadmin/:path*",
  ],
};
