import bcrypt from "bcryptjs";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { db as defaultDb, schema, type Db } from "@/db";
import { AppError } from "@/lib/errors";
import { generatePassword, passwordProblem } from "@/lib/password";
import { audit } from "./audit";
import { isPgError, pgConstraint } from "./books";

const { users, officers } = schema;
const ROUNDS = 12;

export interface UserRow {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "collector";
  officerId: number | null;
  officerName: string | null;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export async function listUsers(db: Db = defaultDb): Promise<UserRow[]> {
  const rows = await db
    .select({ u: users, officerName: officers.name })
    .from(users)
    .leftJoin(officers, eq(officers.id, users.officerId))
    .orderBy(asc(users.role), asc(users.displayName));
  return rows.map(({ u, officerName }) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role as UserRow["role"],
    officerId: u.officerId,
    officerName,
    active: u.active,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  }));
}

export interface CreateUserInput {
  username: string;
  displayName: string;
  role: "admin" | "collector";
  /** A collector acts for one collecting officer: an existing one, or a new one created with the account. */
  officerId?: number | null;
  newOfficer?: { name: string; title?: string | null } | null;
  /** Leave out to have one generated. */
  password?: string | null;
}

export async function createUser(input: CreateUserInput, adminId: number | null, db: Db = defaultDb) {
  const username = input.username.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new AppError("The username needs 3 to 30 letters, numbers, dots, dashes or underscores.");
  if (displayName.length < 2 || displayName.length > 80) throw new AppError("Enter the person's full name.");
  if (input.role !== "admin" && input.role !== "collector") throw new AppError("Choose a role.");

  const generated = !input.password;
  const password = input.password || generatePassword();
  if (!generated) {
    const problem = passwordProblem(password, username);
    if (problem) throw new AppError(problem);
  }
  const hash = await bcrypt.hash(password, ROUNDS);

  try {
    return await db.transaction(async (tx) => {
      let officerId: number | null = null;
      if (input.role === "collector") {
        if (input.newOfficer?.name?.trim()) {
          const name = input.newOfficer.name.trim().toUpperCase();
          const [o] = await tx.insert(officers).values({ name, title: input.newOfficer.title?.trim() || null }).returning();
          officerId = o.id;
          await audit(tx, adminId, "officer.create", "officer", o.id, { name });
        } else if (input.officerId) {
          const [o] = await tx.select().from(officers).where(eq(officers.id, input.officerId));
          if (!o) throw new AppError("That collecting officer does not exist.");
          officerId = o.id;
        } else {
          throw new AppError("A collector needs a collecting officer. Pick one or add a new one.");
        }
      }
      const [u] = await tx
        .insert(users)
        .values({ username, displayName, role: input.role, officerId, passwordHash: hash, mustChangePassword: true, passwordChangedAt: new Date() })
        .returning();
      await audit(tx, adminId, "user.create", "user", u.id, { username, role: input.role, officerId });
      return { id: u.id, username, generatedPassword: generated ? password : null };
    });
  } catch (err) {
    if (isPgError(err, "23505")) {
      if (pgConstraint(err).startsWith("officers")) throw new AppError("A collecting officer with that name already exists. Pick them from the list.");
      throw new AppError(`The username "${username}" is already taken.`);
    }
    throw err;
  }
}

/** Sets a new temporary password. The person must choose their own at next sign-in. */
export async function resetPassword(userId: number, adminId: number | null, password: string | null, db: Db = defaultDb) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw new AppError("That account does not exist.", "not-found");
  const generated = !password;
  const next = password || generatePassword();
  if (!generated) {
    const problem = passwordProblem(next, u.username);
    if (problem) throw new AppError(problem);
  }
  const hash = await bcrypt.hash(next, ROUNDS);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: hash, mustChangePassword: true, passwordChangedAt: new Date() }).where(eq(users.id, userId));
    await audit(tx, adminId, "user.reset-password", "user", userId, { username: u.username });
  });
  return { username: u.username, generatedPassword: generated ? next : null };
}

export async function setUserActive(userId: number, active: boolean, adminId: number | null, db: Db = defaultDb) {
  await db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!u) throw new AppError("That account does not exist.", "not-found");
    if (!active) {
      if (u.id === adminId) throw new AppError("You cannot disable your own account.");
      if (u.role === "admin") {
        const [{ n }] = await tx
          .select({ n: count() })
          .from(users)
          .where(and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, userId)));
        if (n === 0) throw new AppError("This is the last active administrator. Add another one first.");
      }
    }
    await tx.update(users).set({ active, passwordChangedAt: active ? u.passwordChangedAt : new Date() }).where(eq(users.id, userId));
    await audit(tx, adminId, active ? "user.enable" : "user.disable", "user", userId, { username: u.username });
  });
}

export async function changeOwnPassword(userId: number, current: string, next: string, db: Db = defaultDb) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw new AppError("That account does not exist.", "not-found");
  if (!(await bcrypt.compare(current, u.passwordHash))) throw new AppError("The current password is not right.", "wrong-password");
  if (current === next) throw new AppError("Choose a password you have not used just now.");
  const problem = passwordProblem(next, u.username);
  if (problem) throw new AppError(problem);
  const hash = await bcrypt.hash(next, ROUNDS);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: hash, mustChangePassword: false, passwordChangedAt: new Date() }).where(eq(users.id, userId));
    await audit(tx, userId, "user.change-password", "user", userId, { username: u.username });
  });
}
