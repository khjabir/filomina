import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { EventHeader } from "@/components/events/EventHeader";
import { EventProvider } from "@/components/providers/EventProvider";
import { getEventBySlug, toPublic } from "@/lib/events";

export default async function EventLayout({ children, params }: LayoutProps<"/e/[slug]">) {
  const { slug } = await params;
  const ev = await getEventBySlug(slug).catch(() => null);
  if (!ev || !ev.active) notFound();
  return (
    <EventProvider event={toPublic(ev)}>
      <EventHeader />
      {children}
      <Footer />
    </EventProvider>
  );
}
