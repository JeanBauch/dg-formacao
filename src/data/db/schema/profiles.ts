import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { app } from "./app";
import { user } from "./auth";

// Perfil padrão and perfil infantil (GLOSSARY.md).
export const profileKind = app.enum("profile_kind", ["standard", "child"]);

// A user's identities of use (ADR-0004). Written only by the auth module; the
// R0 writes only the holder's profile, when the user is created.
export const profiles = app.table(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: profileKind("kind").notNull(),
    // The holder's profile (perfil do titular).
    isPrimary: boolean("is_primary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("profiles_user_id_idx").on(table.userId),
    // At most one holder's profile per user (A2.2). Partial on purpose: the
    // user may have other profiles, which are not the holder's (R3).
    uniqueIndex("profiles_one_holder_per_user")
      .on(table.userId)
      .where(sql`${table.isPrimary}`),
  ],
);
