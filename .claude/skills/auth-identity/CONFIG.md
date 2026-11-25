# Better Auth config

Read before changing `src/data/auth/auth.ts`. Each option carries the reason a doc example will not give you. The mailer calls are illustrative; the `mailer` interface lives in `src/infra/mailer`.

```ts
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema, schemaName: 'app' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8, // RF-AUT-01. Staff need 12: see STAFF.md
    requireEmailVerification: false, // RF-AUT-02 gates child profiles, not sign-in
    resetPasswordTokenExpiresIn: 60 * 30, // RF-AUT-04: 30 minutes
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      void mailer.send(passwordResetEmail(user.email, url)) // not awaited: the server adapter holds the send in after()
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      void mailer.send(verificationEmail(user.email, url))
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 3 },
      '/request-password-reset': { window: 60, max: 3 },
      '/send-verification-email': { window: 60, max: 3 },
    },
  },
  // Only the R0 routes stay on (see Reasons); with SIGNUP_ENABLED=false, /sign-up/email goes in too
  disabledPaths,
  // Before-hook on /reset-password: staff accounts need 12 characters (STAFF.md)
  hooks: { before: staffResetPasswordLength },
  databaseHooks: {
    session: {
      create: {
        // Drop the IP before the session row is written (RNF-SEG-15)
        before: async (session) => ({ data: { ...session, ipAddress: null } }),
      },
    },
  },
  advanced: { database: { generateId: () => uuidv7() } },
  plugins: [admin({ ac, roles, defaultRole: 'user' }), nextCookies()],
})
```

## Reasons

- **`after()` lives in the server's mailer adapters; the callbacks do not wait for the send.** The callback calls `mailer.send` without `await`, so the response returns before the e-mail goes out. Response time then reveals nothing about whether the account exists, and the adapter's `after()` keeps the function alive until the send finishes. `after()` comes from `next/server` (ADR-009 rules out `waitUntil`). Tests swap in a fake adapter, which has no `after()`.
- **Only the R0 routes answer; everything else is in `disabledPaths`.** On: sign-up, sign-in, sign-out and `/get-session`; the password-reset request and completion (including the e-mail link); sending and confirming the e-mail verification. Everything else, the admin plugin's endpoints and the account's own (update user, change password or e-mail, revoke sessions) included, answers 404. A test walks the endpoints the installed version exposes, so a new endpoint after an upgrade breaks it and forces a decision. `disabledPaths` is checked only by the HTTP router, so the plugin's permission check still works when the server calls it (item U11 in SKILL.md).
- **`SIGNUP_ENABLED=false` also disables sign-up.** `/sign-up/email` joins `disabledPaths`; sign-in, reset, invite and bootstrap keep working.
- **A before-hook on the reset requires 12 characters for staff.** The hook finds the account from the reset link, so a staff password is never set shorter. The sign-in check in STAFF.md stays as the second barrier.
- **`rateLimit.enabled: true`.** The default is off in development, so tests and local runs would never meet the real limits.
- **`storage: 'database'`.** Memory storage dies with each serverless instance.
- **Session cookie cache stays off.** With it on, a ban or a revoked session survives until the cache expires; off, it ends on the next request.
- **IP tracking stays on; the session keeps no IP.** Rate limiting reads the client IP from the request (`x-forwarded-for`) on every call and keys the `rateLimit` rows on it. Whether Better Auth prunes the expired rows itself is unconfirmed (item U12 in SKILL.md), so the daily job deletes them: rows whose last request is older than the longest rule window. `advanced.ipAddress.disableIpTracking` would switch rate limiting off entirely, so it stays unset. The session row never needs the IP, so the `session.create.before` hook drops it. The full IP goes only to the security log (`security_events`, RNF-SEG-15), never to the UI or the application logs. Confirm in R0 that the hook leaves `ip_address` empty and that rate limiting still applies behind Vercel (spec section 10.4, check 3).
- **Every hook that writes to the security log takes the IP as the request sent it.** It reads the header the rate limit reads (`x-forwarded-for`) and splits it the way Better Auth splits it, never through Better Auth's own IP reading: that one cuts an IPv6 address to its /64 and, in development and in tests, swaps a value that is not an IP for the local address, so the log would keep a wrong IP (RNF-SEG-15). The `audit` module validates the value and reduces it to its range. The sign-in hook in `src/data/auth/sign-in.ts` shows the reading.
- With the Drizzle adapter's transaction on, `databaseHooks.user.create.after` runs in the sign-up request, after the account's commit and outside its transaction, and does not run when the account write rolls back (confirmed in R0). A failure inside the hook leaves a committed account, so the hook compensates by deleting it, as the sign-up does.
- **Sign-up enumeration is accepted.** With `autoSignIn` on and verification not required at sign-in, signing up with an existing e-mail returns an error. Better Auth hides this only when sign-in waits for verification. RF-AUT-04 requires identical responses only on password reset, which does not reveal accounts.
- **Fields users must not set** (`role`, `banned`, phone verification) are declared with `input: false` whenever they appear in `additionalFields`.
- **Plugins in the MVP:** `admin` and `nextCookies`, with `nextCookies` last as the docs require. MFA arrives post-MVP as the `twoFactor` plugin plus a migration (RF-AUT-08).
- **`generateId`** is the same UUIDv7 generator the rest of the schema uses (skill `data-layer`).

## Schema generation

Generate the Better Auth tables with the CLI (`npx auth@latest generate --adapter drizzle --dialect postgresql`; older docs call the package `@better-auth/cli`). Write the output to `src/data/db/schema/auth.ts`, then follow the migration steps of skill `data-layer`. Better Auth's `validateSchema`, on by default outside production, reports any drift between that file and what the library writes.

- Declare every Better Auth table with the shared `app` schema object (`app.table(...)`), never in the default schema. That declaration is what puts the tables in `app` at runtime: the adapter uses the schema object it receives.
- Keep `schemaName: 'app'` in the adapter, so the CLI generates the tables in `app` when the schema is regenerated. On its own, the option moves no table: in 1.7, only the CLI's schema generator reads it.
