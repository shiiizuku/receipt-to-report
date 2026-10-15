import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { AGENCY } from "@/lib/constants";
import { getSession } from "@/lib/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return (
    <div className="login">
      <div className="panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/branding/mgb-logo-160.png" alt="Mines and Geosciences Bureau" width={88} height={88} />
        <p className="eyebrow" style={{ color: "var(--bar-muted)" }}>
          {AGENCY}
        </p>
        <h1>Every receipt, from the book to the report.</h1>
        <p>Enter each official receipt once. Deposits and the collection reports are built from it.</p>
      </div>
      <div className="formside">
        <LoginForm />
      </div>
    </div>
  );
}
