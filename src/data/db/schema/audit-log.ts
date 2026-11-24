import { jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { app } from "./app";

// The audit log (registro de auditoria, RNF-OBS-10): one row per staff action.
// Written only by the audit module, which only inserts and reads it: the roles
// script takes change and delete away from the application role (A1.12). The
// actor is kept without a foreign key, so deleting a user never deletes or
// blocks on its rows.
export const auditLog = app.table("audit_log", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  actorUserId: text("actor_user_id").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  diff: jsonb("diff").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
