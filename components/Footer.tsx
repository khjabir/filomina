"use client";

import Link from "next/link";
import { Server, ShieldCheck } from "lucide-react";
import { useConsent } from "@/components/providers/ConsentProvider";

export function Footer() {
  const { openSheet } = useConsent();
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 py-6 text-xs text-faint">
        <span className="flex items-center gap-1.5">
          <Server className="size-3.5" /> Face matching runs on this server, never on third-party AI services
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" /> Searches are audit-logged
        </span>
        <Link href="/about" className="hover:text-ink">
          About
        </Link>
        <Link href="/privacy" className="hover:text-ink">
          Privacy policy
        </Link>
        <button onClick={() => openSheet()} className="hover:text-ink">
          Cookie settings
        </button>
      </div>
    </footer>
  );
}
