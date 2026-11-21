"use client";

import { useSearchParams } from "next/navigation";
import { SearchFlow } from "@/components/search/SearchFlow";

export function SearchPageClient() {
  const sp = useSearchParams();
  const mode = sp.get("mode") === "someone" ? "someone" : "me";
  const folder = sp.get("folder");
  return <SearchFlow key={`${mode}:${folder ?? ""}`} mode={mode} folderId={folder} />;
}
