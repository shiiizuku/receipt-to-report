import { UsersAdmin } from "@/components/UsersAdmin";
import { fmtDate } from "@/lib/dates";
import { requireAdmin } from "@/lib/session";
import { getLookups } from "@/services/lookups";
import { listUsers } from "@/services/users";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

export default async function UsersPage() {
  const admin = await requireAdmin();
  const [users, lookups] = await Promise.all([listUsers(), getLookups()]);
  return (
    <UsersAdmin
      officers={lookups.officers.map((o) => ({ id: o.id, name: o.name }))}
      users={users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        officerName: u.officerName,
        active: u.active,
        mustChangePassword: u.mustChangePassword,
        lastLoginLabel: u.lastLoginAt ? fmtDate(u.lastLoginAt.toISOString().slice(0, 10)) : "Never",
        isYou: u.id === admin.id,
      }))}
    />
  );
}
