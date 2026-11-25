import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/data/db/client";
import * as schema from "@/data/db/schema";
import { recordSignIn } from "./sign-in";
import {
  recordHolderProfileAndConsents,
  refuseIncompleteSignUp,
} from "./sign-up";

// Better Auth (ADR-008), configured as the skill auth-identity describes.
export const auth = betterAuth({
  // With the transaction on, the after-hook of user creation runs after the
  // user's commit and is skipped when it rolls back (A2.12).
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    schemaName: "app",
    transaction: true,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8, // RF-AUT-01
  },
  // A session lasts 7 days, renewed on its first use each day (A2.7). The
  // cookie cache stays off, so a revoked session stops on the next request.
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  // On in every environment (the default is off outside production), with the
  // counters in the database: memory dies with each serverless instance.
  rateLimit: { enabled: true, storage: "database" },
  hooks: { before: refuseIncompleteSignUp, after: recordSignIn },
  databaseHooks: {
    user: { create: { after: recordHolderProfileAndConsents } },
    // The session keeps no IP: the full IP goes only to the security log
    // (RNF-SEG-15). The rate limit reads it from the request, not from here.
    session: {
      create: {
        before: async (session) => ({ data: { ...session, ipAddress: null } }),
      },
    },
  },
  // The same UUIDv7 generator as every other table (skill data-layer).
  advanced: { database: { generateId: () => uuidv7() } },
  // nextCookies stays last, as the Better Auth docs require.
  plugins: [admin(), nextCookies()],
});
