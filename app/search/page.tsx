import { Suspense } from "react";
import { Header } from "@/components/Header";
import { LoadingScreen } from "@/components/LoadingScreen";
import { DriveGate } from "@/components/drive/DriveGate";
import { SearchPageClient } from "./SearchPageClient";

export const metadata = { title: "Face search" };

export default function SearchPage() {
  return (
    <>
      <Header />
      <DriveGate>
        <Suspense fallback={<LoadingScreen message="Preparing the search…" />}>
          <SearchPageClient />
        </Suspense>
      </DriveGate>
    </>
  );
}
