import { AdminShell } from "@/components/admin-shell";
import { requirePlatformAdmin } from "@/lib/admin/context";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requirePlatformAdmin();
  return <AdminShell role={role}>{children}</AdminShell>;
}
