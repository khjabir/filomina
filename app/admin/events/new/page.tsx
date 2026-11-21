import { Header } from "@/components/Header";
import { AdminGate } from "@/components/admin/AdminGate";
import { NewEventForm } from "@/components/admin/NewEventForm";

export const metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <>
      <Header />
      <AdminGate>
        <NewEventForm />
      </AdminGate>
    </>
  );
}
