import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const key = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-only-secret-change-me");

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
  const isSuperAdminLogin = pathname === "/super-admin/login";

  if (
    (pathname.startsWith("/dashboard") || pathname === "/admin") &&
    !isRestaurantLogin &&
    role !== "restaurant_admin"
  ) {
    return NextResponse.redirect(
      new URL(role === "super_admin" ? "/super-admin" : "/admin/login", req.url),
    );
  }
  if (
    pathname.startsWith("/super-admin") &&
    !isSuperAdminLogin &&
    role !== "super_admin"
  ) {
    return NextResponse.redirect(
      new URL(role === "restaurant_admin" ? "/admin" : "/super-admin/login", req.url),
    );
  }
  if (pathname === "/login" && role) {
    return NextResponse.redirect(
      new URL(role === "super_admin" ? "/super-admin" : "/dashboard", req.url),
    );
  }
  if (isRestaurantLogin && role === "restaurant_admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (isSuperAdminLogin && role === "super_admin") {
    return NextResponse.redirect(new URL("/super-admin", req.url));
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
