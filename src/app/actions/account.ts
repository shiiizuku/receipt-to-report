"use server";

import { redirect } from "next/navigation";
import { AppError, errorMessage } from "@/lib/errors";
import { clearFailures, isLocked, recordFailure } from "@/lib/login-throttle";
import { createSession, requireUser } from "@/lib/session";
import { changeOwnPassword } from "@/services/users";

export interface ChangePasswordState {
  error?: string;
}

export async function changePasswordAction(_prev: ChangePasswordState, form: FormData): Promise<ChangePasswordState> {
  const user = await requireUser({ allowPasswordChange: true });
  const key = `pw:${user.id}`;
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (!current || !next) return { error: "Fill in every box." };
  if (next !== confirm) return { error: "The two new passwords do not match." };
  if (isLocked(key)) return { error: "Too many wrong attempts. Wait ten minutes and try again." };
  try {
    await changeOwnPassword(user.id, current, next);
  } catch (err) {
    if (err instanceof AppError && err.code === "wrong-password") recordFailure(key);
    return { error: errorMessage(err) };
  }
  clearFailures(key);
  // Every older session ended with the change, so sign this one in again.
  await createSession(user.id);
  redirect("/");
}
