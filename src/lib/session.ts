import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { sessionStillValid } from "./session-rules";

const COOKIE = "r2r_session";
const MAX_AGE = 60 * 60 * 12; // 12 hours

export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "collector";
  officerId: number | null;
  mustChangePassword: boolean;
}

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, Number(payload.uid)));
    if (!u || !u.active) return null;
    if (!sessionStillValid(payload.iat, u.passwordChangedAt)) return null;
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role as SessionUser["role"],
      officerId: u.officerId,
      mustChangePassword: u.mustChangePassword,
    };
  } catch {
    return null;
  }
}

/**
 * The signed-in user, or a redirect to sign in. Someone who must still choose a new password gets sent
 * there first, so a temporary password cannot be used to do anything else.
 */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/change-password");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** Collectors act for their own officer; administrators may act for anyone. */
export function canActFor(user: SessionUser, officerId: number): boolean {
  return user.role === "admin" || user.officerId === officerId;
}
