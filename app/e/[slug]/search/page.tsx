import { Suspense } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { SearchPageClient } from "@/app/search/SearchPageClient";

export const metadata = { title: "Face search" };

export default function EventSearchPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Preparing the search…" />}>
      <SearchPageClient />
    </Suspense>
  );
}
