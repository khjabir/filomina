"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import type { Breadcrumb } from "@/lib/types";
import { useLinkBase } from "@/components/providers/EventProvider";

export function Breadcrumbs({ path, loading }: { path: Breadcrumb[]; loading?: boolean }) {
  const base = useLinkBase();
  if (loading && !path.length) return <div className="skeleton h-6 w-48 rounded-full" />;
  return (
    <nav aria-label="Breadcrumb" className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1 text-sm">
      {path.map((p, i) => {
        const last = i === path.length - 1;
        return (
          <span key={p.id} className="flex shrink-0 items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 text-faint" />}
            {last ? (
              <span className="rounded-full bg-surface-2 px-2.5 py-1 font-medium text-ink">{p.name}</span>
            ) : (
              <Link href={`${base}/browse/${p.id}`} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-muted hover:bg-surface-2 hover:text-ink">
                {i === 0 && <Home className="size-3.5" />}
                <span className="max-w-[10rem] truncate">{p.name}</span>
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
