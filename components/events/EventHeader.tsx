"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LogoIcon, Wordmark } from "@/components/brand/Logo";
import { useConsent } from "@/components/providers/ConsentProvider";
import { useEvent } from "@/components/providers/EventProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Filomina";

export function EventHeader() {
  const event = useEvent();
  const { openSheet } = useConsent();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href={event ? `/e/${event.slug}` : "/"} className="flex min-w-0 items-center gap-2.5">
          <LogoIcon size={32} priority />
          <span className="min-w-0">
            <span className="font-display block truncate text-[15px] font-bold leading-tight">{event?.name ?? appName}</span>
            <span className="flex items-center gap-1 text-[11px] leading-tight text-faint">
              Powered by <Wordmark size={11} />
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={() => openSheet()} className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs text-muted hover:text-ink">
            <ShieldCheck className="size-3.5" /> Privacy
          </button>
        </div>
      </div>
    </header>
  );
}
