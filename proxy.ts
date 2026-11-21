import { NextResponse, type NextRequest } from "next/server";

/**
 * Hides the admin area behind a secret path (ADMIN_PATH). With it set:
 *   /<ADMIN_PATH>            → the admin dashboard   (/admin internally)
 *   /<ADMIN_PATH>/events/…   → event pages           (/admin/events/… internally)
 *   /<ADMIN_PATH>/audit      → the audit log          (/audit internally)
 * Direct requests to /admin, /audit and the admin APIs answer 404 unless the
 * caller presents the secret (x-admin-path header, sent by the admin UI) or an
 * admin cookie. Without ADMIN_PATH nothing changes (development).
 */
const ADMIN_PATH = (process.env.ADMIN_PATH || "").replace(/^\/+|\/+$/g, "");
const ADMIN_COOKIE = "filomina_admin";

function isAdminApi(pathname: string, method: string) {
  if (pathname.startsWith("/api/admin")) return true;
  if (pathname.startsWith("/api/audit/")) return true; // photo + login
  if (pathname === "/api/audit" && method === "GET") return true; // listing (POST/PATCH are used by searches)
  return false;
}

export function proxy(req: NextRequest) {
  if (!ADMIN_PATH) return NextResponse.next();
  const { pathname } = req.nextUrl;
  const secret = `/${ADMIN_PATH}`;

  if (pathname === secret || pathname.startsWith(`${secret}/`)) {
    const rest = pathname.slice(secret.length); // "", "/events/x", "/audit"
    const url = req.nextUrl.clone();
    url.pathname = rest === "/audit" || rest.startsWith("/audit/") ? rest : `/admin${rest}`;
    return NextResponse.rewrite(url);
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/audit" || pathname.startsWith("/audit/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/__not_found__";
    return NextResponse.rewrite(url);
  }

  if (isAdminApi(pathname, req.method)) {
    const allowed = req.headers.get("x-admin-path") === ADMIN_PATH || req.cookies.has(ADMIN_COOKIE);
    if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|icons/|icon\\.svg|apple-icon|manifest\\.webmanifest|favicon).*)"],
};
