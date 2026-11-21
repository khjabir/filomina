"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, FolderPlus, Link2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Mark } from "@/components/brand/Mark";
import { AssistantBubble } from "@/components/assistant/AssistantBubble";
import { Button } from "@/components/ui/Button";
import { useDrive } from "@/components/providers/DriveProvider";
import { extractDriveId } from "@/lib/drive-id";

export function ConnectFolderForm({ onDone, autoFocus }: { onDone?: () => void; autoFocus?: boolean }) {
  const { setRootOverride, status } = useDrive();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = extractDriveId(value);
    if (!id) {
      setError("That doesn't look like a Google Drive folder link or ID.");
      return;
    }
    setError(null);
    setRootOverride(id);
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="sr-only">Google Drive folder link</span>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 shadow-card focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <Link2 className="size-4 shrink-0 text-muted" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/…"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-faint"
            autoFocus={autoFocus}
            autoComplete="off"
            inputMode="url"
          />
        </div>
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" fullWidth size="lg" icon={<ArrowRight className="size-4" />}>
        Connect folder
      </Button>
      <p className="text-center text-xs text-faint">
        {status?.publicConfigured
          ? "Folders shared as “Anyone with the link” open instantly. Private folders ask you to sign in with Google."
          : status?.oauthConfigured
            ? "You will be asked to sign in with Google so the app can read the folder."
            : "Note: this server has no Google API key or OAuth client configured yet (see SETUP.md)."}
      </p>
    </form>
  );
}

export function ConnectFolderScreen() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-5 py-12">
      <Mark state="listening" size={64} />
      <AssistantBubble message="Hi! I'm your photo assistant. Paste the link of the shared Google Drive folder with the photos and I'll take it from there." state="listening" className="w-full" />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card w-full p-4">
        <ConnectFolderForm autoFocus />
      </motion.div>
    </div>
  );
}

export function ConnectFolderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-3 sm:place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal
            className="card w-full max-w-md p-5 shadow-pop safe-bottom"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <FolderPlus className="size-5 text-accent" /> Connect a folder
              </h2>
              <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <ConnectFolderForm onDone={onClose} autoFocus />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
