/** Typed client for the app's own API routes (browser only). */
import type {
  AnalyzeResponse,
  AuditRecord,
  Breadcrumb,
  DriveListResponse,
  DriveStatus,
  EventRecord,
  IndexRunResult,
  IndexStats,
  ModelInfo,
  PublicEvent,
  SearchEvent,
  SearchMode,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Admin pages live under a secret prefix; pass it along so hidden admin APIs answer. */
function adminHeaders(url: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  if (!url.startsWith("/api/admin") && !url.startsWith("/api/audit")) return {};
  const seg = window.location.pathname.split("/")[1];
  return seg ? { "x-admin-path": seg } : {};
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const extra = adminHeaders(url);
  const res = await fetch(url, Object.keys(extra).length ? { ...init, headers: { ...(init?.headers as Record<string, string> | undefined), ...extra } } : init);
  if (!res.ok) {
    let body: { error?: string; code?: string } = {};
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, body.error || res.statusText || "Request failed", body.code);
  }
  return (await res.json()) as T;
}

const jsonInit = (method: string, body: unknown, signal?: AbortSignal): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
  signal,
});

const ev = (p: URLSearchParams, event?: string | null) => {
  if (event) p.set("event", event);
  return p;
};

export type ThumbSize = 160 | 320 | 512 | 640 | 800 | 1024 | 1600;
export type IndexStatusResponse = { stats: IndexStats; modelsInstalled: boolean; model: ModelInfo | null };
export type AdminMe = { ok: true; user: { email: string; name?: string; picture?: string } | null; canLink: boolean; oauthConfigured: boolean; publicConfigured: boolean };

export const api = {
  status: (folder?: string | null) => request<DriveStatus>(`/api/drive/status${folder ? `?folder=${encodeURIComponent(folder)}` : ""}`),

  list: (folder: string, opts: { all?: boolean; pageToken?: string; signal?: AbortSignal; event?: string | null } = {}) => {
    const p = ev(new URLSearchParams({ folder }), opts.event);
    if (opts.all) p.set("all", "1");
    if (opts.pageToken) p.set("pageToken", opts.pageToken);
    return request<DriveListResponse>(`/api/drive/list?${p}`, { signal: opts.signal });
  },

  path: (folder: string, root?: string | null, event?: string | null) => {
    const p = ev(new URLSearchParams({ folder }), event);
    if (root) p.set("root", root);
    return request<{ path: Breadcrumb[] }>(`/api/drive/path?${p}`);
  },

  thumbUrl: (id: string, size: ThumbSize = 640, event?: string | null) => `/api/drive/thumb?${ev(new URLSearchParams({ id, s: String(size) }), event)}`,
  mediaUrl: (id: string, event?: string | null) => `/api/drive/media?${ev(new URLSearchParams({ id }), event)}`,

  /* ── face search ─────────────────────────────────────────────── */

  analyze: (photo: Blob) => {
    const form = new FormData();
    form.append("photo", photo, "query.jpg");
    return request<AnalyzeResponse>("/api/face/analyze", { method: "POST", body: form });
  },

  /** Runs one search round; `onEvent` receives server-sent events until the stream ends. */
  search: async (body: { root?: string; rootName?: string; event?: string | null; refs: number[][] }, onEvent: (e: SearchEvent) => void, signal?: AbortSignal) => {
    const res = await fetch("/api/face/search", jsonInit("POST", body, signal));
    if (!res.ok || !res.body) {
      let j: { error?: string; code?: string } = {};
      try {
        j = await res.json();
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, j.error || res.statusText, j.code);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 2);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data:")) continue;
          try {
            onEvent(JSON.parse(line.slice(5)) as SearchEvent);
          } catch {
            /* malformed line */
          }
        }
      }
    }
  },

  indexRun: (body: { root?: string; rootName?: string; event?: string | null; budgetMs?: number; fresh?: boolean }, signal?: AbortSignal) =>
    request<IndexRunResult>("/api/index/run", jsonInit("POST", body, signal)),
  indexStatus: (root?: string | null) => request<IndexStatusResponse>(`/api/index/status${root ? `?root=${encodeURIComponent(root)}` : ""}`),
  indexStats: () => request<IndexStats & { model: ModelInfo | null }>("/api/index/stats"),

  /* ── events ──────────────────────────────────────────────────── */

  event: (slug: string) => request<{ event: PublicEvent }>(`/api/events/${encodeURIComponent(slug)}`),

  admin: {
    me: () => request<AdminMe>("/api/admin/me"),
    login: (key: string) => request<{ ok: true }>("/api/audit/login", jsonInit("POST", { key })),
    logout: () => request<{ ok: true }>("/api/audit/login", { method: "DELETE" }),
    events: () => request<{ events: EventRecord[] }>("/api/admin/events"),
    createEvent: (body: { name: string; description?: string; folder: string }) => request<{ event: EventRecord }>("/api/admin/events", jsonInit("POST", body)),
    getEvent: (id: string) => request<{ event: EventRecord }>(`/api/admin/events/${encodeURIComponent(id)}`),
    updateEvent: (id: string, body: { name?: string; description?: string | null; active?: boolean; relink?: boolean }) =>
      request<{ event: EventRecord }>(`/api/admin/events/${encodeURIComponent(id)}`, jsonInit("PATCH", body)),
    deleteEvent: (id: string) => request<{ ok: true }>(`/api/admin/events/${encodeURIComponent(id)}`, { method: "DELETE" }),
    indexEvent: (id: string, body: { fresh?: boolean; budgetMs?: number } = {}, signal?: AbortSignal) =>
      request<{ result: IndexRunResult; event: EventRecord }>(`/api/admin/events/${encodeURIComponent(id)}/index`, jsonInit("POST", body, signal)),
  },

  /* ── consent & audit ─────────────────────────────────────────── */

  consent: (choice: "accepted" | "declined", version: string) => request<{ ok: true; version: string }>("/api/consent", jsonInit("POST", { choice, version })),

  auditCreate: (
    photos: Blob[],
    meta: { mode: SearchMode; folderId: string; folderName?: string; facesDetected: number; selectedFace: number; referencePhotos: number; event?: string | null },
  ) => {
    const form = new FormData();
    photos.forEach((p, i) => form.append("photo", p, `reference-${i + 1}.jpg`));
    form.append("meta", JSON.stringify(meta));
    return request<{ id: string }>("/api/audit", { method: "POST", body: form });
  },
  auditUpdate: (body: { id: string; status: "completed" | "cancelled" | "error"; scanned: number; foldersScanned: number; matches: number; durationMs: number }) =>
    request<{ ok: true }>("/api/audit", jsonInit("PATCH", body)),
  auditPhotoUrl: (id: string, i = 0) => `/api/audit/photo/${encodeURIComponent(id)}?i=${i}`,

  auditLogin: (key: string) => request<{ ok: true }>("/api/audit/login", jsonInit("POST", { key })),
  auditLogout: () => request<{ ok: true }>("/api/audit/login", { method: "DELETE" }),
  auditList: (limit = 200) => request<{ records: AuditRecord[] }>(`/api/audit?limit=${limit}`),

  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
};
