import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { DriveGate } from "@/components/drive/DriveGate";
import { FolderBrowser } from "@/components/drive/FolderBrowser";

export const metadata = { title: "Browse" };

export default async function BrowseFolderPage({ params }: PageProps<"/browse/[folderId]">) {
  const { folderId } = await params;
  return (
    <>
      <Header />
      <DriveGate>
        <FolderBrowser folderId={folderId} />
      </DriveGate>
      <Footer />
    </>
  );
}
