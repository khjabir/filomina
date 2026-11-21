import { Header } from "@/components/Header";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminGate } from "@/components/admin/AdminGate";

export const metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <>
      <Header />
      <AdminGate>
        <AdminDashboard />
      </AdminGate>
    </>
  );
}
