import type { Db, Tx } from "@/db";
import { schema } from "@/db";

export async function audit(
  tx: Db | Tx,
  userId: number | null,
  action: string,
  entity: string,
  entityId: string | number | null,
  payload?: Record<string, unknown>,
) {
  await tx.insert(schema.auditEvents).values({
    userId,
    action,
    entity,
    entityId: entityId === null ? null : String(entityId),
    payload: payload ?? null,
  });
}
