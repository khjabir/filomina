"use client";

import { usePathname } from "next/navigation";

/**
 * The admin UI may be served under a secret prefix (ADMIN_PATH). Links and
 * navigation must keep that prefix, so derive it from the current URL.
 */
export function useAdminBase(): { base: string; audit: string } {
  const pathname = usePathname() || "/admin";
  const seg = pathname.split("/")[1] || "admin";
  if (seg === "admin" || seg === "audit") return { base: "/admin", audit: "/audit" };
  return { base: `/${seg}`, audit: `/${seg}/audit` };
}
