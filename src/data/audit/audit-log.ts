import "server-only";
import { db } from "@/data/db/client";
import { auditLog } from "@/data/db/schema";
import { type AuditEntry, auditDiff } from "@/domain/audit";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Records one staff action in the audit log, in the transaction of the change
// it records: the row commits with the change, or neither does.
export async function recordAuditEntry(tx: Transaction, entry: AuditEntry) {
  await tx.insert(auditLog).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    diff: auditDiff(entry),
  });
}
