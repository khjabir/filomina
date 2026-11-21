"use client";

import type { ReactNode } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useDrive } from "@/components/providers/DriveProvider";
import { ConnectFolderScreen } from "./ConnectFolder";
import { ProblemScreen } from "./ProblemScreen";
import { SignInScreen } from "./SignInScreen";

/** Renders children only once the Drive folder can be read; otherwise the right onboarding screen. */
export function DriveGate({ children }: { children: ReactNode }) {
  const { loading, status, error } = useDrive();
  if (loading && !status) return <LoadingScreen message="Connecting to Google Drive…" />;
  if (error) return <ProblemScreen message={`I couldn't reach the server: ${error}`} />;
  if (!status) return <LoadingScreen message="Connecting to Google Drive…" />;
  switch (status.mode) {
    case "not-configured":
      return <ConnectFolderScreen />;
    case "auth-required":
      return <SignInScreen />;
    case "not-found":
      return <ProblemScreen message={status.message || "I can't open that folder. It may be private, deleted, or the link is wrong."} />;
    case "error":
      return <ProblemScreen message={status.message || "Something went wrong talking to Google Drive."} />;
    default:
      return <>{children}</>;
  }
}
