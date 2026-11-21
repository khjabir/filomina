import { Header } from "@/components/Header";
import { AuditViewer } from "./AuditViewer";

export const metadata = { title: "Audit log" };

export default function AuditPage() {
  return (
    <>
      <Header />
      <AuditViewer />
    </>
  );
}
