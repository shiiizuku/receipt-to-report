"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { AppError, errorMessage } from "@/lib/errors";
import { canActFor, requireUser } from "@/lib/session";
import { audit } from "@/services/audit";
import { registerBook, setActiveBook } from "@/services/books";
import { cancelDeposit, recordDeposit, validateDeposit } from "@/services/deposits";
import { addDivision, type AddDivisionInput } from "@/services/divisions";
import { postReceipt, updateReceipt, voidReceipt, type PostReceiptInput, type UpdateReceiptInput } from "@/services/receipts";

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

function refresh() {
  revalidatePath("/", "layout");
}

async function guarded<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const out = await fn();
    refresh();
    return { ok: true, ...out };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function postReceiptAction(input: PostReceiptInput) {
  const user = await requireUser();
  return guarded(async () => {
    if (!canActFor(user, input.officerId)) throw new AppError("You can only issue receipts for your own books.");
    const r = await postReceipt(input, user.id);
    return {
      id: r.id,
      controlNo: r.controlNo,
      totalCents: r.totalCents,
      bookExhausted: r.bookExhausted,
      nextBookNo: r.nextBookNo,
    };
  });
}

export async function updateReceiptAction(id: number, input: UpdateReceiptInput) {
  const user = await requireUser();
  return guarded(async () => {
    const [r] = await db.select({ officerId: schema.receipts.officerId }).from(schema.receipts).where(eq(schema.receipts.id, id));
    if (!r) throw new AppError("That receipt does not exist.");
    if (!canActFor(user, r.officerId)) throw new AppError("You can only edit your own receipts.");
    const res = await updateReceipt(id, input, user.id);
    return { id: res.id, controlNo: res.controlNo, changed: res.changed };
  });
}

export async function addDivisionAction(input: AddDivisionInput) {
  const user = await requireUser();
  return guarded(async () => {
    const d = await addDivision(input, user.id);
    return { code: d.code, rccCode: d.rccCode, noOpNumber: d.noOpNumber };
  });
}

export async function voidReceiptAction(id: number, reason: string) {
  const user = await requireUser();
  return guarded(async () => {
    const [r] = await db.select({ officerId: schema.receipts.officerId }).from(schema.receipts).where(eq(schema.receipts.id, id));
    if (!r) throw new AppError("That receipt does not exist.");
    if (!canActFor(user, r.officerId)) throw new AppError("You can only void your own receipts.");
    await voidReceipt(id, reason, user.id);
    return {};
  });
}

const BookInput = z.object({
  fromNo: z.number().int(),
  toNo: z.number().int(),
  officerId: z.number().int(),
  receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function registerBookAction(input: z.input<typeof BookInput>) {
  const user = await requireUser();
  return guarded(async () => {
    const parsed = BookInput.safeParse(input);
    if (!parsed.success) throw new AppError("Check the control numbers and the date received.");
    if (!canActFor(user, parsed.data.officerId)) throw new AppError("You can only register books for yourself.");
    const b = await registerBook(parsed.data, user.id);
    return { bookNo: b.bookNo };
  });
}

export async function activateBookAction(bookId: number) {
  const user = await requireUser();
  return guarded(async () => {
    const [b] = await db.select({ officerId: schema.orBooks.officerId }).from(schema.orBooks).where(eq(schema.orBooks.id, bookId));
    if (!b) throw new AppError("That book does not exist.");
    if (!canActFor(user, b.officerId)) throw new AppError("You can only change your own active book.");
    await setActiveBook(bookId, user.id);
    return {};
  });
}

export async function recordDepositAction(input: { officerId: number; receiptIds: number[]; slipNo: string; date: string }) {
  const user = await requireUser();
  return guarded(async () => {
    if (!canActFor(user, input.officerId)) throw new AppError("You can only deposit your own collections.");
    const d = await recordDeposit(input, user.id);
    return { slipNo: d.slipNo, totalCents: d.totalCents };
  });
}

async function depositOfficer(id: number): Promise<number> {
  const [d] = await db.select({ officerId: schema.deposits.officerId }).from(schema.deposits).where(eq(schema.deposits.id, id));
  if (!d) throw new AppError("That deposit does not exist.");
  return d.officerId;
}

export async function validateDepositAction(id: number, bankMsgNo: string) {
  const user = await requireUser();
  return guarded(async () => {
    if (!canActFor(user, await depositOfficer(id))) throw new AppError("You can only validate your own deposits.");
    await validateDeposit(id, bankMsgNo, user.id);
    return {};
  });
}

export async function cancelDepositAction(id: number) {
  const user = await requireUser();
  return guarded(async () => {
    if (!canActFor(user, await depositOfficer(id))) throw new AppError("You can only remove your own deposits.");
    await cancelDeposit(id, user.id);
    return {};
  });
}

const SignatoryInput = z.array(z.object({ key: z.string().min(1), name: z.string().trim().min(1).max(120), title: z.string().trim().max(240) })).max(20);

export async function saveSignatoriesAction(input: z.input<typeof SignatoryInput>) {
  const user = await requireUser();
  return guarded(async () => {
    const parsed = SignatoryInput.safeParse(input);
    if (!parsed.success) throw new AppError("Every name needs some text.");
    await db.transaction(async (tx) => {
      for (const s of parsed.data) {
        await tx.update(schema.signatories).set({ name: s.name, title: s.title }).where(eq(schema.signatories.key, s.key));
      }
      await audit(tx, user.id, "signatories.update", "signatories", null, { keys: parsed.data.map((s) => s.key) });
    });
    return {};
  });
}

export async function saveOfficerTitleAction(officerId: number, title: string) {
  const user = await requireUser();
  return guarded(async () => {
    await db.update(schema.officers).set({ title: title.trim() || null }).where(eq(schema.officers.id, officerId));
    await audit(db, user.id, "officer.title", "officer", officerId, { title });
    return {};
  });
}
