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
      after(() => mailer.send(passwordResetEmail(user.email, url)))
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      after(() => mailer.send(verificationEmail(user.email, url)))
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
  advanced: { database: { generateId: () => uuidv7() } },
  plugins: [admin({ ac, roles, defaultRole: 'user' }), nextCookies()],
})
```

## Reasons

- **E-mail inside `after()`.** The response returns before the e-mail goes out. Response time then reveals nothing about whether the account exists, and the function stays alive until the send finishes. `after()` comes from `next/server` (ADR-009 rules out `waitUntil`).
- **`rateLimit.enabled: true`.** The default is off in development, so tests and local runs would never meet the real limits.
- **`storage: 'database'`.** Memory storage dies with each serverless instance.
- **Session cookie cache stays off.** With it on, a ban or a revoked session survives until the cache expires; off, it ends on the next request.
- **IP tracking stays on.** Rate limiting keys on the client IP, which is stored in `session` and `rateLimit`. The IP is never shown in the UI or written to logs (RPV-06).
- **Sign-up enumeration is accepted.** With `autoSignIn` on and verification not required at sign-in, signing up with an existing e-mail returns an error. Better Auth hides this only when sign-in waits for verification. RF-AUT-04 requires identical responses only on password reset, which does not reveal accounts.
- **Fields users must not set** (`role`, `banned`, phone verification) are declared with `input: false` whenever they appear in `additionalFields`.
- **Plugins in the MVP:** `admin` and `nextCookies`, with `nextCookies` last as the docs require. MFA arrives post-MVP as the `twoFactor` plugin plus a migration (RF-AUT-08).
- **`generateId`** is the same UUIDv7 generator the rest of the schema uses (skill `data-layer`).

## Schema generation

Generate the Better Auth tables with the CLI (`npx auth@latest generate --adapter drizzle --dialect postgresql`; older docs call the package `@better-auth/cli`). Write the output to `src/data/db/schema/auth.ts`, then follow the migration steps of skill `data-layer`. Better Auth's `validateSchema`, on by default outside production, reports any drift between that file and what the library writes.
