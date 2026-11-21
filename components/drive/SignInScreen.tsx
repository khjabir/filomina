"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Mark } from "@/components/brand/Mark";
import { AssistantBubble } from "@/components/assistant/AssistantBubble";
import { Button } from "@/components/ui/Button";
import { useDrive } from "@/components/providers/DriveProvider";
import { ConnectFolderDialog } from "./ConnectFolder";

export function GoogleIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.6A14.6 14.6 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.5-5.8c-2.1 1.4-4.8 2.3-8.1 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function GoogleButton({ href, label = "Sign in with Google" }: { href: string; label?: string }) {
  return (
    <a href={href} className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-5 font-medium text-ink shadow-card transition hover:bg-surface-2 active:scale-[0.99]">
      <GoogleIcon />
      {label}
    </a>
  );
}

export function SignInScreen() {
  const { status, signInHref } = useDrive();
  const [dialog, setDialog] = useState(false);
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-5 py-12">
      <Mark state="listening" size={64} />
      <AssistantBubble message={status?.message || "This folder is private. Sign in with Google and I'll be able to look through its photos for you."} state="listening" className="w-full">
        <p className="text-xs text-muted">Read-only access · you can sign out any time.</p>
      </AssistantBubble>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex w-full flex-col gap-2">
        <GoogleButton href={signInHref()} />
        <Button variant="ghost" onClick={() => setDialog(true)}>
          Use a different folder
        </Button>
      </motion.div>
      <ConnectFolderDialog open={dialog} onClose={() => setDialog(false)} />
    </div>
  );
}
