import { Header } from "@/components/Header";
import { AdminGate } from "@/components/admin/AdminGate";
import { EventAdmin } from "@/components/admin/EventAdmin";

export const metadata = { title: "Event" };

export default async function EventAdminPage({ params }: PageProps<"/admin/events/[id]">) {
  const { id } = await params;
  return (
    <>
      <Header />
      <AdminGate>
        <EventAdmin id={id} />
      </AdminGate>
    </>
  );
}
