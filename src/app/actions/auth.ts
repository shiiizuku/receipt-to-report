"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { clearFailures, isLocked, recordFailure } from "@/lib/login-throttle";
import { createSession, destroySession } from "@/lib/session";
import { audit } from "@/services/audit";

// A fixed hash so an unknown username takes as long to reject as a wrong password.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };
  if (isLocked(username)) return { error: "Too many attempts. Wait ten minutes and try again." };

  const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.active || !ok) {
    recordFailure(username);
    await audit(db, null, "login.fail", "user", username);
    return { error: "That username and password do not match." };
  }
  clearFailures(username);
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await createSession(user.id);
  await audit(db, user.id, "login", "user", user.id);
  redirect(user.mustChangePassword ? "/change-password" : "/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
