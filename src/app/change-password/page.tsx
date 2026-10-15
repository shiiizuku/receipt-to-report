import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { AGENCY } from "@/lib/constants";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  return (
    <div className="login">
      <div className="panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/branding/mgb-logo-160.png" alt="Mines and Geosciences Bureau" width={88} height={88} />
        <p className="eyebrow" style={{ color: "var(--bar-muted)" }}>
          {AGENCY}
        </p>
        <h1>{user.mustChangePassword ? "One quick step before you start." : "Keep your account yours."}</h1>
        <p>Signed in as {user.displayName}.</p>
      </div>
      <div className="formside">
        <ChangePasswordForm forced={user.mustChangePassword} />
      </div>
    </div>
  );
}
