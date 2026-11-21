"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { FolderOpen, Server, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AssistantBubble } from "@/components/assistant/AssistantBubble";
import { useConsent } from "@/components/providers/ConsentProvider";
import { useDrive } from "@/components/providers/DriveProvider";
import { useEvent, useLinkBase } from "@/components/providers/EventProvider";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { blobToImage, canvasToBlob, cropFace, downscale } from "@/lib/face/image";
import { DEFAULT_MODEL } from "@/lib/face/match";
import type { ModelInfo, QueryFace, SearchEvent, SearchFileResult, SearchMode } from "@/lib/types";
import { CameraCapture } from "./CameraCapture";
import { FacePicker } from "./FacePicker";
import { ResultsView } from "./ResultsView";
import { emptyScan, toMatch, type ScanState } from "./scan-state";
import { ScanStage } from "./ScanStage";
import { UploadPicker } from "./UploadPicker";

type Step = "capture" | "analyzing" | "pick" | "scanning" | "results";

type Pending = { blob: Blob; url: string; canvas: HTMLCanvasElement; width: number; height: number; faces: QueryFace[]; selected: number };
type Reference = { blob: Blob; faceUrl: string; emb: number[] };

function pickPrimary(faces: QueryFace[]) {
  let best = 0;
  let bestScore = -Infinity;
  faces.forEach((f, i) => {
    const centre = 1 - Math.min(1, Math.hypot(f.box.x + f.box.w / 2 - 0.5, f.box.y + f.box.h / 2 - 0.5) * 1.5);
    const s = f.box.w * f.box.h * 3 + centre;
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}

export function SearchFlow({ mode, folderId: folderParam }: { mode: SearchMode; folderId: string | null }) {
  const router = useRouter();
  const drive = useDrive();
  const event = useEvent();
  const base = useLinkBase();
  const rootId = event ? event.folderId : drive.rootId;
  const rootName = event ? event.folderName || event.name : drive.rootName;
  const slug = event?.slug ?? null;
  const consent = useConsent();
  const folderId = folderParam || rootId;

  const [step, setStep] = useState<Step>("capture");
  const [source, setSource] = useState<"camera" | "upload">(mode === "me" ? "camera" : "upload");
  const [model, setModel] = useState<ModelInfo>(DEFAULT_MODEL);
  const [threshold, setThreshold] = useState(DEFAULT_MODEL.thresholds.balanced);
  const [refs, setRefs] = useState<Reference[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [fetchedPath, setFetchedPath] = useState<{ id: string; name: string | null } | null>(null);
  const folderName = folderId === rootId ? rootName : fetchedPath?.id === folderId ? fetchedPath.name : null;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelsInstalled, setModelsInstalled] = useState<boolean | null>(null);

  /* the scan's working copy lives in a ref; a snapshot is pushed to state at most once per frame */
  const scanRef = useRef<ScanState>(emptyScan(""));
  const [scan, setScan] = useState<ScanState>(() => emptyScan(""));
  const rafRef = useRef(0);
  const bump = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const s = scanRef.current;
      setScan({ ...s, matches: [...s.matches], folders: [...s.folders], items: s.phase === "collect" || s.phase === "index" || s.phase === "match" ? s.items : new Map(s.items) });
    });
  }, []);
  const abortRef = useRef<AbortController | null>(null);
  const auditRef = useRef<string | null>(null);

  /* models + thresholds */
  useEffect(() => {
    let cancelled = false;
    api
      .indexStatus(folderId)
      .then((r) => {
        if (cancelled) return;
        setModelsInstalled(r.modelsInstalled);
        if (r.model) {
          setModel(r.model);
          setThreshold(r.model.thresholds.balanced);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [folderId]);

  useEffect(() => {
    if (!folderId || folderId === rootId) return;
    let cancelled = false;
    api
      .path(folderId, rootId, slug)
      .then((r) => {
        if (!cancelled) setFetchedPath({ id: folderId, name: r.path.map((p) => p.name).join(" / ") || null });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [folderId, rootId, slug]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const resetAll = useCallback(() => {
    abortRef.current?.abort();
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null);
    setRefs([]);
    setError(null);
    scanRef.current = emptyScan("");
    setScan(emptyScan(""));
    setStep("capture");
    setSource(mode === "me" ? "camera" : "upload");
  }, [pending, mode]);

  const handlePhoto = useCallback(async (blob: Blob) => {
    setStep("analyzing");
    setError(null);
    try {
      const img = await blobToImage(blob);
      const canvas = downscale(img, 1280);
      URL.revokeObjectURL(img.src);
      const small = await canvasToBlob(canvas, "image/jpeg", 0.9);
      const res = await api.analyze(small);
      setModel(res.model);
      setThreshold((t) => (t === DEFAULT_MODEL.thresholds.balanced ? res.model.thresholds.balanced : t));
      setPending({ blob: small, url: URL.createObjectURL(small), canvas, width: canvas.width, height: canvas.height, faces: res.faces, selected: pickPrimary(res.faces) });
      setStep("pick");
    } catch (e) {
      if (e instanceof ApiError && e.code === "models-missing") {
        setError("The face models are not installed on this server yet. Run `npm run fetch-models` and restart.");
      } else {
        setError((e as Error).message || "I couldn't analyse that photo.");
      }
      setStep("capture");
    }
  }, []);

  /** Records the audit entry and runs the search. Assumes consent has been given. */
  const launch = useCallback(
    async (allRefs: Reference[]) => {
      if (!folderId || !allRefs.length) return;
      setStarting(true);
      setError(null);
      try {
        const { id } = await api.auditCreate(
          allRefs.map((r) => r.blob),
          {
            mode,
            folderId,
            folderName: folderName || undefined,
            facesDetected: pending?.faces.length ?? 0,
            selectedFace: pending?.selected ?? 0,
            referencePhotos: allRefs.length,
            event: slug,
          },
        );
        auditRef.current = id;
      } catch (e) {
        if (e instanceof ApiError && e.code === "consent-required") {
          setError("Please accept the privacy notice, then press the button again.");
          consent.openSheet();
        } else {
          setError(`I couldn't record the audit entry, so I can't start the search. ${(e as Error).message}`);
        }
        setStarting(false);
        return;
      }

      const name = folderName?.split(" / ").pop() || rootName || "this folder";
      const scan = emptyScan(`Looking inside “${name}”…`);
      scanRef.current = scan;
      setScan(scan);
      setStep("scanning");
      setStarting(false);
      const controller = new AbortController();
      abortRef.current = controller;
      const thr = threshold;

      const addItem = (item: SearchFileResult) => {
        scan.items.set(item.file.id, item);
        scan.faces += item.faces.length;
        if (item.best >= thr && !scan.matches.some((m) => m.file.id === item.file.id)) {
          const m = toMatch(item);
          if (m) scan.matches.push(m);
        }
      };
      const onEvent = (e: SearchEvent) => {
        switch (e.type) {
          case "phase":
            scan.phase = e.phase;
            if (e.phase === "match") scan.message = "Comparing with the faces I already know…";
            break;
          case "folder":
            scan.foldersVisited++;
            scan.folders = [...scan.folders.slice(-11), e];
            scan.collected += e.files;
            scan.message = `Exploring ${e.path || name} · ${e.files} photos`;
            break;
          case "collected":
            scan.collected = e.total;
            scan.known = e.known;
            scan.pending = e.pending;
            scan.foldersVisited = e.folders;
            scan.message = e.pending
              ? e.known
                ? `${e.known.toLocaleString()} photos are already indexed. Analysing the ${e.pending.toLocaleString()} new ones…`
                : `Analysing ${e.pending.toLocaleString()} photos…`
              : `All ${e.total.toLocaleString()} photos are indexed. Matching…`;
            break;
          case "files":
            e.items.forEach(addItem);
            break;
          case "file":
            addItem(e.item);
            scan.indexed++;
            scan.pending = Math.max(0, scan.pending - 1);
            scan.frame = { file: e.item.file, faces: e.item.faces.map((f) => ({ box: f.box, sim: f.sim, match: f.sim >= thr })) };
            scan.message = e.item.file.path ? `${e.item.file.path} · ${e.item.file.name}` : e.item.file.name;
            break;
          case "progress":
            scan.pending = e.pending;
            scan.etaMs = e.etaMs;
            break;
          case "done":
            scan.model = e.model;
            scan.durationMs += e.durationMs;
            if (e.complete) {
              scan.phase = "done";
              scan.message = `Done. ${scan.matches.length} ${scan.matches.length === 1 ? "match" : "matches"}.`;
            } else {
              roundsLeft = e.pending;
              scan.message = `${e.pending.toLocaleString()} photos still to analyse – continuing…`;
            }
            break;
          case "error":
            scan.phase = "error";
            scan.error = e.message;
            scan.message = e.message;
            break;
        }
        bump();
      };

      let roundsLeft = 1;
      try {
        // A round ends when everything is covered or the server's time budget is spent; keep going.
        for (let round = 0; round < 60 && roundsLeft > 0 && !controller.signal.aborted; round++) {
          roundsLeft = 0;
          await api.search({ root: event ? undefined : folderId, rootName: name, event: slug, refs: allRefs.map((r) => r.emb) }, onEvent, controller.signal);
          if (scan.phase === "error") break;
        }
        if (scan.phase !== "done" && scan.phase !== "error") scan.phase = controller.signal.aborted ? "cancelled" : "done";
      } catch (e) {
        if (controller.signal.aborted) scan.phase = "cancelled";
        else {
          scan.phase = "error";
          scan.error = (e as Error).message;
        }
      }
      scan.durationMs = performance.now() - scan.startedAt;
      if (!scan.model) scan.model = model;
      bump();
      if (auditRef.current) {
        void api
          .auditUpdate({
            id: auditRef.current,
            status: scan.phase === "done" ? "completed" : scan.phase === "cancelled" ? "cancelled" : "error",
            scanned: scan.items.size,
            foldersScanned: scan.foldersVisited,
            matches: scan.matches.length,
            durationMs: Math.round(scan.durationMs),
          })
          .catch(() => undefined);
      }
    },
    [folderId, mode, folderName, pending, rootName, threshold, consent, model, bump, event, slug],
  );

  const startWith = useCallback(
    (allRefs: Reference[]) => {
      if (consent.status !== "accepted") {
        consent.openSheet((choice) => {
          if (choice === "accepted") void launch(allRefs);
        });
        return;
      }
      void launch(allRefs);
    },
    [consent, launch],
  );

  const confirmFace = (action: "search" | "add") => {
    if (!pending) return;
    const face = pending.faces[pending.selected];
    const ref: Reference = { blob: pending.blob, faceUrl: cropFace(pending.canvas, face.box, 128), emb: face.emb };
    const all = [...refs, ref];
    setRefs(all);
    URL.revokeObjectURL(pending.url);
    setPending(null);
    if (action === "add") {
      setSource("upload");
      setStep("capture");
    } else startWith(all);
  };

  const queryFaces = refs.map((r) => r.faceUrl);

  if (!folderId) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <AssistantBubble message="Connect a Drive folder first and I'll be ready to search." state="idle" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-5 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{mode === "me" ? "Find me" : "Find someone"}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            <FolderOpen className="size-4 text-accent" />
            <span className="truncate">{folderName || "…"}</span>
            <span className="text-faint">· incl. sub-folders</span>
          </p>
        </div>
        {modelsInstalled === false && (
          <span className="rounded-full border border-warning/30 bg-warning-soft px-3 py-1 text-xs text-warning">Face models not installed on the server</span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {step === "capture" && (
          <motion.div key="capture" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <AssistantBubble
              className="mx-auto max-w-md"
              message={
                refs.length
                  ? `Add another photo of ${mode === "me" ? "yourself" : "the same person"}, ideally from a different angle.`
                  : mode === "me"
                    ? "Let me take a good look at you. Take a selfie, or upload a photo where your face is clearly visible."
                    : "Show me who you're looking for. Upload a photo of the person, or snap one with the camera."
              }
              state="listening"
            >
              {refs.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex -space-x-2">
                    {queryFaces.map((src, i) => (
                      <img key={i} src={src} alt="" className="size-8 rounded-full border-2 border-surface object-cover" />
                    ))}
                  </div>
                  <Button size="sm" onClick={() => startWith(refs)}>
                    Search with {refs.length} {refs.length === 1 ? "photo" : "photos"}
                  </Button>
                </div>
              )}
            </AssistantBubble>
            {error && <div className="mx-auto max-w-md rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">{error}</div>}
            {source === "camera" ? (
              <CameraCapture initialFacing={mode === "me" ? "user" : "environment"} onCapture={handlePhoto} onUploadInstead={() => setSource("upload")} />
            ) : (
              <UploadPicker onPick={handlePhoto} onCameraInstead={() => setSource("camera")} cameraLabel={mode === "me" ? "Take a selfie instead" : "Use the camera instead"} />
            )}
            <p className="mx-auto flex max-w-md items-center justify-center gap-1.5 text-xs text-faint">
              <Server className="size-3.5" /> Faces are matched on this server; nothing is sent to third-party AI services.
            </p>
          </motion.div>
        )}

        {step === "analyzing" && (
          <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto w-full max-w-md">
            <div className="card relative aspect-[3/4] overflow-hidden">
              <div className="scan-grid absolute inset-0" />
              <span className="scanline" />
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-base font-semibold">Looking for faces…</p>
                  <p className="mt-1 text-sm text-muted">Analysing your photo</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === "pick" && pending && (
          <motion.div key="pick" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <FacePicker
              imageUrl={pending.url}
              width={pending.width}
              height={pending.height}
              faces={pending.faces}
              selected={pending.selected}
              mode={mode}
              referenceFaces={queryFaces}
              onSelect={(i) => setPending({ ...pending, selected: i })}
              onConfirm={confirmFace}
              onRetake={() => {
                URL.revokeObjectURL(pending.url);
                setPending(null);
                setStep("capture");
              }}
              busy={starting}
            />
            {error && (
              <div className="mx-auto mt-4 max-w-md rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
                {error}
                {refs.length > 0 && (
                  <div className="mt-2">
                    <Button size="sm" variant="danger" onClick={() => startWith(refs)}>
                      Try again
                    </Button>
                  </div>
                )}
              </div>
            )}
            {consent.status !== "accepted" && (
              <div className="mx-auto mt-4 flex max-w-md items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-warning" />
                <p className="text-muted">Searching stores your photo and search details in an audit log. You&apos;ll be asked to accept the privacy notice when you continue.</p>
              </div>
            )}
          </motion.div>
        )}

        {step === "scanning" && (
          <motion.div key="scanning" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <ScanStage scan={scan} queryFaces={queryFaces} mode={mode} onStop={() => abortRef.current?.abort()} onShowResults={() => setStep("results")} />
          </motion.div>
        )}

        {step === "results" && (
          <motion.div key="results" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <ResultsView
              scan={scan}
              model={scan.model || model}
              threshold={threshold}
              onThreshold={setThreshold}
              mode={mode}
              queryFaces={queryFaces}
              rootId={rootId}
              onAgain={() => {
                resetAll();
                router.replace(`${base}/search?mode=${mode}${folderParam ? `&folder=${folderParam}` : ""}`);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
