import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/data/db/client";
import * as schema from "@/data/db/schema";
import { env } from "@/env";
import {
  passwordResetLink,
  sendPasswordResetEmail,
  sendVerificationEmail,
  verificationLink,
} from "./emails";
import { authBasePath, disabledPaths, servedOverHttp } from "./http";
import { printAuthLog } from "./loggable";
import { recordSignIn } from "./sign-in";
import {
  recordHolderProfileAndConsents,
  refuseIncompleteSignUp,
} from "./sign-up";

// Better Auth (ADR-008), configured as the skill auth-identity describes.
const betterAuthInstance = betterAuth({
  basePath: authBasePath,
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
    // RF-AUT-02: the verification gates a child profile (R3), not the sign-in.
    requireEmailVerification: false,
    resetPasswordTokenExpiresIn: passwordResetLink.seconds, // RF-AUT-04
    sendResetPassword: sendPasswordResetEmail,
  },
  // The sign-up sends the confirmation link, valid for an hour (A3.1).
  emailVerification: {
    sendOnSignUp: true,
    expiresIn: verificationLink.seconds,
    sendVerificationEmail,
  },
  // A session lasts 7 days, renewed on its first use each day (A2.7). The
  // cookie cache stays off, so a revoked session stops on the next request.
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  // On in every environment (the default is off outside production), with the
  // counters in the database: memory dies with each serverless instance. Each
  // IP has its own counter per route, keyed by the route as Better Auth names
  // it, without the base path (A2.11).
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
    },
  },
  // Only the routes the R0 uses answer over HTTP (A4.17, A2.20).
  disabledPaths: disabledPaths({ signUpEnabled: env.SIGNUP_ENABLED }),
  // An unexpected error leaves the router instead of being printed whole by
  // it, so the app's handler logs it without the values of a failed query
  // (RNF-OBS-01). An expected one (an APIError) is still the router's answer.
  onAPIError: { throw: true },
  // Better Auth logs some errors it catches whole; this prints them without
  // the values of the failed query (RNF-OBS-01).
  logger: { log: printAuthLog },
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

// The app's Better Auth: its server API as it is, and its HTTP handler as the
// app serves it, which records what the router refuses on its own.
const handler = servedOverHttp(betterAuthInstance);

// Better Auth 1.7.15 also exposes its handler as `fetch`, an alias of the same
// function, so both are replaced: the alias would otherwise skip the wrapper.
export const auth = { ...betterAuthInstance, handler, fetch: handler };
