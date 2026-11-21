import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/events";

export default async function EventBrowseIndex({ params }: PageProps<"/e/[slug]/browse">) {
  const { slug } = await params;
  const ev = await getEventBySlug(slug);
  redirect(ev ? `/e/${slug}/browse/${ev.folderId}` : "/");
}
