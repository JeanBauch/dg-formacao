import { index, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { consentDocuments } from "@/domain/auth";
import { app } from "./app";
import { user } from "./auth";

export const consentDocument = app.enum("consent_document", consentDocuments);

// The user's consents: the document, its version and when it was given
// (aceite and declaração de maioridade, GLOSSARY.md). No IP and no IP hash:
// the full IP lives only in the security log (RNF-SEG-15). Written only by the
// auth module.
export const consents = app.table(
  "consents",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    document: consentDocument("document").notNull(),
    version: text("version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("consents_user_id_idx").on(table.userId)],
);
