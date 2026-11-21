"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicEvent } from "@/lib/types";

const Ctx = createContext<PublicEvent | null>(null);

/** Makes the current event (for /e/<slug> pages) available to shared components. */
export function EventProvider({ event, children }: { event: PublicEvent; children: ReactNode }) {
  return <Ctx.Provider value={event}>{children}</Ctx.Provider>;
}

export function useEvent(): PublicEvent | null {
  return useContext(Ctx);
}

/** Base path for in-app links: "/e/<slug>" inside an event, "" otherwise. */
export function useLinkBase(): string {
  const ev = useContext(Ctx);
  return ev ? `/e/${ev.slug}` : "";
}
