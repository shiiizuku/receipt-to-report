"use server";

import { revalidatePath } from "next/cache";
import { errorMessage } from "@/lib/errors";
import { AppError } from "@/lib/errors";
import { requireAdmin } from "@/lib/session";
import { createUser, resetPassword, setUserActive, type CreateUserInput } from "@/services/users";

export type AdminResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T extends object>(fn: (adminId: number) => Promise<T>): Promise<AdminResult<T>> {
  const admin = await requireAdmin();
  try {
    const out = await fn(admin.id);
    revalidatePath("/admin/users");
    return { ok: true, ...out };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function createUserAction(input: CreateUserInput) {
  return run(async (adminId) => {
    const r = await createUser(input, adminId);
    return { username: r.username, generatedPassword: r.generatedPassword };
  });
}

export async function resetPasswordAction(userId: number, password: string | null) {
  return run(async (adminId) => {
    if (!Number.isInteger(userId)) throw new AppError("That account does not exist.");
    const r = await resetPassword(userId, adminId, password || null);
    return { username: r.username, generatedPassword: r.generatedPassword };
  });
}

export async function setUserActiveAction(userId: number, active: boolean) {
  return run(async (adminId) => {
    await setUserActive(userId, active, adminId);
    return {};
  });
}
