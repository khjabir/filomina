/** Shared types used by both the server routes and the client. */

export type DriveFolder = {
  id: string;
  name: string;
  modifiedTime?: string;
};

export type DriveImage = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  width?: number;
  height?: number;
  size?: number;
  takenAt?: string;
};

export type DriveListResponse = {
  folders: DriveFolder[];
  files: DriveImage[];
  nextPageToken?: string;
};

export type Breadcrumb = { id: string; name: string };

export type AccessMode =
  | "public" // readable with the server API key, no sign-in needed
  | "authed" // readable with the signed-in user's Google account
  | "auth-required" // folder is private; Google sign-in needed
  | "not-configured" // no folder chosen yet
  | "not-found" // folder does not exist or is not reachable
  | "error";

export type SessionUser = {
  email: string;
  name?: string;
  picture?: string;
};

export type DriveStatus = {
  mode: AccessMode;
  folder?: DriveFolder;
  user?: SessionUser | null;
  message?: string;
  oauthConfigured: boolean;
  publicConfigured: boolean;
};

/** Normalised face box, every value in 0..1 relative to the image size. */
export type NormBox = { x: number; y: number; w: number; h: number };

export type IndexStats = { files: number; faces: number; updatedAt?: string };

export type ModelInfo = {
  name: string;
  /** cosine-similarity thresholds */
  thresholds: { strict: number; balanced: number; relaxed: number; floor: number };
};

/** A face found in the query photo. */
export type QueryFace = { box: NormBox; score: number; size: number; emb: number[] };
export type AnalyzeResponse = { width: number; height: number; faces: QueryFace[]; model: ModelInfo };

/** A photo in the search space (Drive file + where it lives). */
export type SearchFileInfo = DriveImage & { path: string; folderId: string };

export type SearchFace = { box: NormBox; score: number; size: number; sim: number };

export type SearchFileResult = {
  file: SearchFileInfo;
  faces: SearchFace[];
  /** best similarity of any face, −1 when the photo has no faces */
  best: number;
  bestIdx: number;
  fresh: boolean;
};

export type SearchEvent =
  | { type: "phase"; phase: "collect" | "index" | "match" }
  | { type: "folder"; id: string; name: string; path: string; files: number; folders: number }
  | { type: "collected"; total: number; known: number; pending: number; folders: number }
  | { type: "files"; items: SearchFileResult[] }
  | { type: "file"; item: SearchFileResult }
  | { type: "progress"; done: number; pending: number; faces: number; etaMs: number | null }
  | { type: "done"; durationMs: number; model: ModelInfo; faces: number; complete: boolean; pending: number }
  | { type: "error"; message: string; code?: string };

export type EventAccess = "public" | "linked";
export type EventIndexStatus = "idle" | "running" | "done" | "error";

/** What visitors of an event page may know. */
export type PublicEvent = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  folderId: string;
  folderName: string | null;
  access: EventAccess;
  active: boolean;
  totalFiles: number;
  indexedFiles: number;
  faces: number;
  indexStatus: EventIndexStatus;
  lastIndexedAt: string | null;
};

/** Full event record (admin). */
export type EventRecord = PublicEvent & {
  ownerEmail: string | null;
  hasAuth: boolean;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IndexRunResult = {
  total: number;
  known: number;
  processed: number;
  pending: number;
  faces: number;
  folders: number;
  complete: boolean;
  modelsInstalled: boolean;
  durationMs: number;
};

export type IndexJobStatus = {
  root: string;
  status: "collecting" | "indexing" | "done" | "error";
  total: number;
  pending: number;
  done: number;
  faces: number;
  foldersVisited: number;
  etaMs: number | null;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

export type SearchMode = "me" | "someone";

export type AuditSearchStatus = "started" | "completed" | "cancelled" | "error";

export type AuditRecord =
  | {
      id: string;
      type: "search";
      createdAt: string;
      updatedAt?: string;
      mode: SearchMode;
      folderId: string;
      folderName?: string;
      facesDetected: number;
      selectedFace: number;
      referencePhotos: number;
      user: SessionUser | null;
      ip: string | null;
      userAgent: string | null;
      consentVersion: string;
      /** number of reference photos stored with this record */
      photos: number;
      eventId?: string;
      eventName?: string;
      status: AuditSearchStatus;
      scanned?: number;
      foldersScanned?: number;
      matches?: number;
      durationMs?: number;
    }
  | {
      id: string;
      type: "consent";
      createdAt: string;
      choice: "accepted" | "declined";
      consentVersion: string;
      user: SessionUser | null;
      ip: string | null;
      userAgent: string | null;
    };

export const CONSENT_VERSION = "2026-10";
export const CONSENT_COOKIE = "filomina_consent";
