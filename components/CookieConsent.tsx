"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Camera, Cookie, Server, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useConsent } from "@/components/providers/ConsentProvider";

export function CookieConsent() {
  const { ready, status, sheetOpen, accept, decline, closeSheet } = useConsent();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const visible = ready && (status === "unknown" || sheetOpen);

  const run = async (which: "accept" | "decline") => {
    setBusy(which);
    try {
      await (which === "accept" ? accept() : decline());
    } finally {
      setBusy(null);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="consent"
          className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:p-5"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          role="dialog"
          aria-labelledby="consent-title"
        >
          <div className="card relative w-full max-w-xl p-5 shadow-pop safe-bottom">
            {status !== "unknown" && (
              <button onClick={closeSheet} className="absolute right-3 top-3 rounded-full p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
                <X className="size-4" />
              </button>
            )}
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <Cookie className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 id="consent-title" className="text-base font-semibold">
                  Cookies &amp; your privacy
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  We use a few cookies to keep you signed in and remember your choices. Every face search is recorded in an{" "}
                  <strong className="text-ink">audit log</strong> so the tool cannot be misused.
                </p>
              </div>
            </div>

            <ul className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-3">
              <li className="flex items-start gap-2 rounded-xl bg-surface-2 p-3">
                <Camera className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  The <span className="text-ink">photos or selfies</span> you search with are stored.
                </span>
              </li>
              <li className="flex items-start gap-2 rounded-xl bg-surface-2 p-3">
                <UserRound className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  Searcher details: <span className="text-ink">time, Google account (if signed in), IP &amp; device</span>.
                </span>
              </li>
              <li className="flex items-start gap-2 rounded-xl bg-surface-2 p-3">
                <Server className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  Faces are matched <span className="text-ink">on this server only</span>. Read the{" "}
                  <Link href="/privacy" className="underline decoration-dotted underline-offset-2 hover:text-ink">
                    privacy policy
                  </Link>
                  .
                </span>
              </li>
            </ul>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => run("decline")} loading={busy === "decline"}>
                Decline
              </Button>
              <Button onClick={() => run("accept")} loading={busy === "accept"} size="lg">
                Accept &amp; continue
              </Button>
            </div>
            <p className="mt-3 text-center text-xs text-faint sm:text-left">Declining still lets you browse, but face search requires the audit log and stays off.</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
