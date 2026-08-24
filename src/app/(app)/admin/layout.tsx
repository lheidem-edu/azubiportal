import { isAdmin } from "@/lib/auth";
import { requirePlanner } from "@/lib/session";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePlanner();
  return (
    <>
      <AdminNav isAdmin={isAdmin(user.role)} />
      {children}
    </>
  );
}
