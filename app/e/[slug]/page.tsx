import { EventLanding } from "@/components/events/EventLanding";
import { getEventBySlug } from "@/lib/events";

export async function generateMetadata({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  const ev = await getEventBySlug(slug).catch(() => null);
  return { title: ev?.name ?? "Event" };
}

export default function EventPage() {
  return <EventLanding />;
}
