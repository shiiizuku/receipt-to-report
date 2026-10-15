"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "@/app/actions/account";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePasswordAction, {});
  return (
    <form action={action}>
      <h2>{forced ? "Choose your own password" : "Change password"}</h2>
      {forced ? <p className="help">You signed in with a temporary password. Choose one only you know before you continue.</p> : null}
      <div className="field-row">
        <label htmlFor="current">{forced ? "Temporary password" : "Current password"}</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required autoFocus />
      </div>
      <div className="field-row">
        <label htmlFor="next">New password</label>
        <input id="next" name="next" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required aria-describedby="pw-help" />
        <span id="pw-help" className="help">
          At least {MIN_PASSWORD_LENGTH} characters. A few words in a row works well.
        </span>
      </div>
      <div className="field-row">
        <label htmlFor="confirm">Type the new password again</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </div>
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save password"}
        </button>
        {!forced ? (
          <Link className="btn out" href="/">
            Cancel
          </Link>
        ) : null}
      </div>
    </form>
  );
}
