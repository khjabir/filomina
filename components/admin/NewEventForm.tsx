"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Link2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { useAdmin } from "./AdminGate";
import { useAdminBase } from "./useAdminBase";
import { useDrive } from "@/components/providers/DriveProvider";

const input = "h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export function NewEventForm() {
  const router = useRouter();
  const { me } = useAdmin();
  const { base } = useAdminBase();
  const { signInHref } = useDrive();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folder, setFolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { event } = await api.admin.createEvent({ name, description, folder });
      router.push(`${base}/events/${event.id}?created=1`);
    } catch (err) {
      setError({ message: (err as Error).message, code: err instanceof ApiError ? err.code : undefined });
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">New event</h1>
      <p className="mt-1 text-sm text-muted">Attach a Drive folder. Guests who open the event link can search their faces right away.</p>
      <form onSubmit={submit} className="card mt-6 space-y-4 p-5">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Event name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="Anna & Tom's wedding" required autoFocus />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            Description <span className="font-normal text-faint">(optional, shown on the event page)</span>
          </span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${input} h-24 resize-y py-2`} placeholder="Photos by Studio X. Find yourself and download your favourites." />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Google Drive folder link</span>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
            <Link2 className="size-4 shrink-0 text-muted" />
            <input value={folder} onChange={(e) => setFolder(e.target.value)} className="h-11 w-full bg-transparent text-sm outline-none" placeholder="https://drive.google.com/drive/folders/…" required inputMode="url" />
          </div>
          <span className="mt-1 block text-xs text-faint">
            {me.publicConfigured ? "Public folders (Anyone with the link) work directly. " : ""}
            {me.user ? `Private folders are read through ${me.user.email}.` : me.oauthConfigured ? "For a private folder, sign in with Google first (top right)." : "Private folders need Google OAuth to be configured on the server."}
          </span>
        </label>
        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
            {error.message}
            {(error.code === "sign-in-needed" || error.code === "relink-needed") && me.oauthConfigured && (
              <div className="mt-2">
                <a href={signInHref(`${base}/events/new`)} className="underline decoration-dotted underline-offset-2">
                  Sign in with Google
                </a>
              </div>
            )}
          </div>
        )}
        <Button type="submit" size="lg" loading={busy} icon={<ArrowRight className="size-4" />}>
          Create event
        </Button>
      </form>
    </div>
  );
}
