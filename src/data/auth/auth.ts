import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/data/db/client";
import * as schema from "@/data/db/schema";
import { holderPasswordMinLength } from "@/domain/auth";
import { env } from "@/env";
import {
  passwordResetLinkLifetime,
  sendPasswordResetEmail,
  sendVerificationEmail,
  signUpConfirmation,
  verificationLinkLifetime,
} from "./emails";
import { authBasePath, disabledPaths, servedOverHttp } from "./http";
import { printAuthLog } from "./loggable";
import { completePasswordReset, passwordResetRequest } from "./password-reset";
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
    // RF-AUT-01, the same length the sign-up form's strength calls too short.
    minPasswordLength: holderPasswordMinLength,
    // RF-AUT-02: the verification gates a child profile (R3), not the sign-in.
    requireEmailVerification: false,
    resetPasswordTokenExpiresIn: passwordResetLinkLifetime.seconds, // RF-AUT-04
    // Whoever had the old password loses the access it gave (A3.6).
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: sendPasswordResetEmail,
    // Runs once the new password is saved, with Better Auth's own context: the
    // instance below, which exists by the time any request runs.
    onPasswordReset: (reset, request): Promise<void> =>
      completePasswordReset(betterAuthInstance.$context, reset, request),
  },
  // The confirmation link is valid for an hour (A3.1). The sign-up's own is
  // sent by `signUpConfirmation`, once the sign-up has ended well.
  emailVerification: {
    sendOnSignUp: false,
    expiresIn: verificationLinkLifetime.seconds,
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
  // it, without the base path (A2.11, A3.8).
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      // Better Auth 1.7.15 gives these two the same rule by default, from an
      // internal list. Stated here, the limit A3.8 sets stays the same if an
      // upgrade changes that list.
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
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
  advanced: {
    // Better Auth checks the request's origin and every return address it is
    // sent against the app's own origin, but skips both checks when NODE_ENV
    // is "test". Off is stated outright, so the database tests meet the checks
    // production runs: a sign-in that asks to return to another domain is
    // refused (A2.9a).
    disableOriginCheck: false,
    // The same UUIDv7 generator as every other table (skill data-layer).
    database: { generateId: () => uuidv7() },
  },
  // The app's own plugins hold the hooks of one route each: the sign-up's
  // confirmation, and the password reset request's destination and security
  // log. nextCookies stays last, as the Better Auth docs require.
  plugins: [admin(), signUpConfirmation, passwordResetRequest, nextCookies()],
});

// The app's Better Auth: its server API as it is, and its HTTP handler as the
// app serves it, which records what the router refuses on its own.
const handler = servedOverHttp(betterAuthInstance);

// Better Auth 1.7.15 also exposes its handler as `fetch`, an alias of the same
// function, so both are replaced: the alias would otherwise skip the wrapper.
export const auth = { ...betterAuthInstance, handler, fetch: handler };
