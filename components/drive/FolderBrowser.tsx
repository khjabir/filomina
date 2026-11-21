"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Folder, ImageIcon, ScanFace, UserRound, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Breadcrumb, DriveFolder, DriveImage } from "@/lib/types";
import { useDrive } from "@/components/providers/DriveProvider";
import { useEvent, useLinkBase } from "@/components/providers/EventProvider";
import { Button, LinkButton } from "@/components/ui/Button";
import { AssistantBubble } from "@/components/assistant/AssistantBubble";
import { Breadcrumbs } from "./Breadcrumbs";
import { Lightbox } from "./Lightbox";
import { PhotoTile } from "./PhotoTile";

export function FolderBrowser({ folderId }: { folderId: string }) {
  const drive = useDrive();
  const event = useEvent();
  const base = useLinkBase();
  const rootId = event ? event.folderId : drive.rootId;
  const rootName = event ? event.folderName || event.name : drive.rootName;
  const slug = event?.slug ?? null;
  const [path, setPath] = useState<Breadcrumb[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveImage[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      setFolders([]);
      setFiles([]);
      setNextToken(undefined);
      Promise.all([api.list(folderId, { event: slug }), api.path(folderId, rootId, slug).catch(() => ({ path: [] as Breadcrumb[] }))])
        .then(([list, p]) => {
          if (cancelled) return;
          setFolders(list.folders);
          setFiles(list.files);
          setNextToken(list.nextPageToken);
          setPath(p.path.length ? p.path : [{ id: folderId, name: rootName || "Folder" }]);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setError(e instanceof ApiError ? e.message : "Could not load this folder");
        })
        .finally(() => !cancelled && setLoading(false));
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [folderId, rootId, rootName, slug]);

  const loadMore = useCallback(async () => {
    if (!nextToken) return;
    setMore(true);
    try {
      const list = await api.list(folderId, { pageToken: nextToken, event: slug });
      setFolders((f) => [...f, ...list.folders]);
      setFiles((f) => [...f, ...list.files]);
      setNextToken(list.nextPageToken);
    } finally {
      setMore(false);
    }
  }, [folderId, nextToken, slug]);

  const current = path[path.length - 1];
  const folderName = current?.name || rootName || "Folder";
  const pathLabel = path.map((p) => p.name).join(" / ");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 sm:px-6">
      <Breadcrumbs path={path} loading={loading} />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{folderName}</h1>
          {!loading && (
            <p className="mt-1 text-sm text-muted">
              {folders.length} {folders.length === 1 ? "folder" : "folders"} · {files.length}
              {nextToken ? "+" : ""} {files.length === 1 ? "photo" : "photos"}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <LinkButton href={`${base}/search?mode=me&folder=${folderId}`} size="sm" icon={<UserRound className="size-4" />}>
            Find me here
          </LinkButton>
          <LinkButton href={`${base}/search?mode=someone&folder=${folderId}`} size="sm" variant="secondary" icon={<Users className="size-4" />}>
            Find someone
          </LinkButton>
        </div>
      </div>

      {error && (
        <div className="mt-6">
          <AssistantBubble message={`Hmm, I couldn't open this folder. ${error}`} state="error" />
        </div>
      )}

      {loading ? (
        <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {folders.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Folders</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {folders.map((f, i) => (
                  <motion.div key={f.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
                    <Link
                      href={`${base}/browse/${f.id}`}
                      className="card group flex items-center gap-3 p-3 transition hover:border-accent/50"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                        <Folder className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{f.name}</span>
                        <span className="block text-xs text-faint">Folder</span>
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-6">
            {files.length > 0 && <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Photos</h2>}
            {files.length === 0 && folders.length === 0 && !error && (
              <div className="card mt-4 flex flex-col items-center gap-3 p-10 text-center text-muted">
                <ImageIcon className="size-8 text-faint" />
                <p>This folder has no photos or sub-folders I can see.</p>
              </div>
            )}
            {files.length === 0 && folders.length > 0 && (
              <div className="card flex items-center gap-3 p-4 text-sm text-muted">
                <ScanFace className="size-5 shrink-0 text-accent" />
                No photos directly in this folder – but &ldquo;Find me here&rdquo; still searches every sub-folder.
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {files.map((f, i) => (
                <PhotoTile key={f.id} file={f} index={i} onClick={() => setLightbox(i)} />
              ))}
            </div>
            {nextToken && (
              <div className="mt-6 flex justify-center">
                <Button variant="secondary" onClick={loadMore} loading={more}>
                  Load more
                </Button>
              </div>
            )}
          </section>
        </>
      )}

      <Lightbox
        items={files.map((f) => ({ file: f, path: pathLabel }))}
        index={lightbox}
        onClose={() => setLightbox(null)}
        onIndex={setLightbox}
      />
    </div>
  );
}
