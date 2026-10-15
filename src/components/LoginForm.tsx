"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action}>
      <h2>Sign in</h2>
      <div className="field-row">
        <label htmlFor="username">Username</label>
        <input id="username" name="username" autoComplete="username" autoFocus required />
      </div>
      <div className="field-row">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
