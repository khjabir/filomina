import { FolderBrowser } from "@/components/drive/FolderBrowser";

export const metadata = { title: "Browse" };

export default async function EventBrowsePage({ params }: PageProps<"/e/[slug]/browse/[folderId]">) {
  const { folderId } = await params;
  return <FolderBrowser folderId={folderId} />;
}
