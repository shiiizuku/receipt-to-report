import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { AppShell } from "@/components/AppShell";
import { AGENCY } from "@/lib/constants";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");
  return (
    <AppShell
      agency={AGENCY}
      isAdmin={user.role === "admin"}
      user={{ displayName: user.displayName, roleLabel: user.role === "admin" ? "Administrator" : "Collecting officer" }}
      signOut={logoutAction}
    >
      {children}
    </AppShell>
  );
}
