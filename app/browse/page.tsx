"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Header } from "@/components/Header";
import { LoadingScreen } from "@/components/LoadingScreen";
import { DriveGate } from "@/components/drive/DriveGate";
import { useDrive } from "@/components/providers/DriveProvider";

function RedirectToRoot() {
  const { rootId } = useDrive();
  const router = useRouter();
  useEffect(() => {
    if (rootId) router.replace(`/browse/${rootId}`);
  }, [rootId, router]);
  return <LoadingScreen message="Opening your folder…" />;
}

export default function BrowseIndexPage() {
  return (
    <>
      <Header />
      <DriveGate>
        <RedirectToRoot />
      </DriveGate>
    </>
  );
}
