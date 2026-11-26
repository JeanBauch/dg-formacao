# Better Auth config

Read before changing `src/data/auth/auth.ts` or the app's HTTP handler. Each option carries the reason a doc example will not give you. The excerpts follow the code of `src/data/auth/`, with its comments shortened. Test files are in that folder unless a path says otherwise. In an excerpt, what is not in the code yet appears only as a comment that names the ticket bringing it; a reason may already describe such a piece. The `mailer` interface and the server's adapters live in `src/infra/mailer`.

```ts
const betterAuthInstance = betterAuth({
  basePath: authBasePath, // "/api/auth" (see Errors and logs)
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    schemaName: "app",
    transaction: true,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8, // RF-AUT-01. Staff need 12: see STAFF.md
    requireEmailVerification: false, // see E-mail
    resetPasswordTokenExpiresIn: passwordResetLinkLifetime.seconds, // RF-AUT-04
    // #17 adds revokeSessionsOnPasswordReset: true (A3.6)
    sendResetPassword: sendPasswordResetEmail,
  },
  emailVerification: {
    sendOnSignUp: false, // see The sign-up's confirmation
    expiresIn: verificationLinkLifetime.seconds,
    sendVerificationEmail,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      // #17 adds the A3.8 rules, 3 in 60 s: "/request-password-reset" and "/send-verification-email"
    },
  },
  // Only the R0 routes stay on (see Reasons)
  disabledPaths: disabledPaths({ signUpEnabled: env.SIGNUP_ENABLED }),
  onAPIError: { throw: true }, // see Errors and logs
  logger: { log: printAuthLog },
  // #21 adds the staff's 12 characters on the password reset to the before-hook (STAFF.md)
  hooks: { before: refuseIncompleteSignUp, after: recordSignIn },
  databaseHooks: {
    user: { create: { after: recordHolderProfileAndConsents } },
    session: {
      create: {
        // Drop the IP before the session row is written (RNF-SEG-15)
        before: async (session) => ({ data: { ...session, ipAddress: null } }),
      },
    },
  },
  advanced: { database: { generateId: () => uuidv7() } },
  // #19 configures the staff roles here: admin({ ac, roles, defaultRole: "user" })
  plugins: [admin(), signUpConfirmation, nextCookies()],
});

const handler = servedOverHttp(betterAuthInstance); // see The app's HTTP handler

export const auth = { ...betterAuthInstance, handler, fetch: handler };
```

Covered by:

- `database`: `sign-up.db.test.ts`, "Better Auth's tables in the app schema (A2.5)"; `transaction`: "the after-hook of user creation".
- `minPasswordLength`: `sign-up.db.test.ts`, "the password of a sign-up (A2.4)".
- `session`: `sign-in.db.test.ts`, "a sign-in with the right e-mail and password (A2.7)".
- `rateLimit`: `rate-limit.db.test.ts`, "the rate limit of the sign-in (A2.11)" and "the rate limit of the sign-up (A2.11)".
- `disabledPaths`: `routes.db.test.ts`, "the routes of Better Auth's HTTP handler (A4.17)"; `sign-up-closed.db.test.ts`, "with the public sign-up closed (A2.20)".
- `hooks`: `sign-up.db.test.ts`, "a sign-up without the adult declaration or the acceptance (A2.3)"; `sign-in.db.test.ts`, "the security log of a sign-in (A5.1)".
- `databaseHooks`: `sign-up.db.test.ts`, "a valid sign-up (A2.1)"; `sign-in.db.test.ts`, "the session of a sign-in (A5.4)".
- `advanced`: `sign-up.db.test.ts`, "the user's ID (A2.6)".
- `plugins`: for the routes the `admin` plugin adds, `routes.db.test.ts`, "that the R0 does not use answer 404, the admin plugin's and the account's own included". No test aims at `nextCookies`.
- The options that point to a section below are covered there.

## Reasons

- **`after()` lives in the server's mailer adapters; the callbacks do not wait for the send.** The callback starts the send without awaiting it (see E-mail), so the response returns before the e-mail goes out. Response time then reveals nothing about whether the account exists, and the adapter's `after()` keeps the function alive until the send finishes. `after()` comes from `next/server` (ADR-009 rules out `waitUntil`). Tests swap in a fake adapter, which has no `after()`.
- **Only the R0 routes answer; everything else is in `disabledPaths`.** On: sign-up, sign-in, sign-out and `/get-session`; the password-reset request and completion (including the e-mail link); sending and confirming the e-mail verification. Everything else, the admin plugin's endpoints and the account's own (update user, change password or e-mail, revoke sessions) included, answers 404. A test walks the endpoints the installed version exposes, so a new endpoint after an upgrade breaks it and forces a decision. `disabledPaths` is checked only by the HTTP router, so the plugin's permission check still works when the server calls it (item U11 in SKILL.md).
- **`SIGNUP_ENABLED=false` also disables sign-up.** `/sign-up/email` joins `disabledPaths`; sign-in, reset, invite and bootstrap keep working.
- **A before-hook on the reset requires 12 characters for staff.** The hook finds the account from the reset link, so a staff password is never set shorter. The sign-in check in STAFF.md stays as the second barrier.
- **`rateLimit.enabled: true`.** The default is off in development, so tests and local runs would never meet the real limits.
- **`storage: 'database'`.** Memory storage dies with each serverless instance.
- **The rate limit names a route by its path without the base path** (`/sign-in/email`, never `/api/auth/sign-in/email`). Its counters are keyed that way, and `customRules` use the same name. Confirmed in 1.7 for sign-in, sign-up, the password-reset request and the verification send. Test: `rate-limit.db.test.ts`, "the names of the routes in the rate limit of Better Auth 1.7 (U9)".
- **Session cookie cache stays off.** With it on, a ban or a revoked session survives until the cache expires; off, it ends on the next request.
- **IP tracking stays on; the session keeps no IP.** Rate limiting reads the client IP from the request (`x-forwarded-for`) on every call and keys the `rateLimit` rows on it. Whether Better Auth prunes the expired rows itself is unconfirmed (item U12 in SKILL.md), so the daily job deletes them: rows whose last request is older than the longest rule window. `advanced.ipAddress.disableIpTracking` would switch rate limiting off entirely, so it stays unset. The session row never needs the IP, so the `session.create.before` hook drops it. The full IP goes only to the security log (`security_events`, RNF-SEG-15), never to the UI or the application logs. Confirm in R0 that the hook leaves `ip_address` empty and that rate limiting still applies behind Vercel (spec section 10.4, check 3).
- **Every hook that writes to the security log takes the IP as the request sent it.** It reads the header the rate limit reads (`x-forwarded-for`) and splits it the way Better Auth splits it, never through Better Auth's own IP reading: that one cuts an IPv6 address to its /64 and, in development and in tests, swaps a value that is not an IP for the local address, so the log would keep a wrong IP (RNF-SEG-15). The `audit` module validates the value and reduces it to its range. The `auth` module has one reading of the header, which its hooks and its HTTP handler share. Test: `sign-in.db.test.ts`, "keeps the client's IP (A5.11)".
- With the Drizzle adapter's transaction on, `databaseHooks.user.create.after` runs in the sign-up request, after the account's commit and outside its transaction, and does not run when the account write rolls back (confirmed in R0). A failure inside the hook leaves a committed account, so the hook compensates by deleting it, as the sign-up does.
- **Sign-up enumeration is accepted.** With `autoSignIn` on and verification not required at sign-in, signing up with an existing e-mail returns an error. Better Auth hides this only when sign-in waits for verification. RF-AUT-04 requires identical responses only on password reset, which does not reveal accounts.
- **Fields users must not set** (`role`, `banned`, phone verification) are declared with `input: false` whenever they appear in `additionalFields`.
- **Plugins in the MVP:** `admin`, the app's own `signUpConfirmation` and `nextCookies`, with `nextCookies` last as the docs require. MFA arrives post-MVP as the `twoFactor` plugin plus a migration (RF-AUT-08).
- **`generateId`** is the same UUIDv7 generator the rest of the schema uses (skill `data-layer`).

## The app's HTTP handler

The app serves its own handler, which wraps Better Auth's. Better Auth 1.7.15 also exposes its handler as `fetch`, so `auth` replaces both: the alias would skip the wrapper.

```ts
export function servedOverHttp({ handler, $context }: BetterAuthHttp): Handler {
  const logError: LogError = async (message) => {
    (await $context).logger.error(message);
  };
  return async (request) => {
    const route = routeOf(request); // without the base path and trailing slashes
    if (isSocialCallback(route)) return notFound();
    if (sentFromAnotherSite(request) && !opensFromAnEmail(request, route))
      return forbidden();
    let response: Response;
    try {
      response = await handler(request);
    } catch (error) {
      await logError(`An auth request failed: ${loggable(error)}`);
      return new Response(null, {
        status: 500,
        statusText: "Internal Server Error",
      });
    }
    // A server error Better Auth answers itself (see Errors and logs)
    if (response.status >= 500)
      await logError(
        `An auth request to ${routePattern(route)} answered ${response.status}`,
      );
    if (blockedByRateLimit(response))
      await recordRateLimited(request, logError);
    return response;
  };
}

function sentFromAnotherSite(request: Request) {
  return request.headers.get("sec-fetch-site") === "cross-site";
}

function opensFromAnEmail(request: Request, route: string) {
  return (
    request.method === "GET" &&
    request.headers.get("sec-fetch-dest") === "document" &&
    (route === "/verify-email" || /^\/reset-password\/[^/]+$/.test(route))
  );
}
```

- **The rate limit's block is recorded here.** The rate limit refuses a request in the router, before any hook runs, so the wrapper writes the `rate_limited` event, with the route and the IP as the request sent them. Tests: `rate-limit.db.test.ts`, "the security log of a request the rate limit blocks (A5.1, A5.2)" and "a request the rate limit blocks, when its security log write fails".
- **The social sign-in's return answers 404 here.** Its path, `/callback/:id`, has a variable segment, and `disabledPaths` compares exact paths. Test: `routes.db.test.ts`, "the social sign-in's return answers 404 to %s %s".
- **A request that a page of another site makes the browser send is refused with 403, before the rate limit, whatever its method.** The rate limit counts a request by its route before Better Auth checks its origin or its body. Another site could make its visitors' browsers send sign-ins or sign-ups, as a form or an image: each would count on the IP they share, such as a school's network, and the real sign-ins from that IP would get 429 for a minute, again and again, with one more block in the security log each minute. The browser marks such a request with `Sec-Fetch-Site: cross-site`, and the page cannot change the mark.
  - **Exception: the links of an e-mail.** A webmail opens them from another site, so the e-mail verification and the password reset's link pass when the browser opens them as the page in the tab. Loaded as an image or in a frame they are refused too, because the verification has a counter per IP that another site could spend.
  - Requests from the app's own pages and from a subdomain of the same site go on, and so do requests without the mark: a server's, a command-line tool's, an old browser's.
  - **The mark, not the origin:** Better Auth compares the origin with the trusted origins only after the rate limit, and comparing it earlier would need a second list of origins.

  Test: `rate-limit.db.test.ts`, "a request a page of another site makes the browser send".

## Errors and logs

```ts
basePath: authBasePath,
onAPIError: { throw: true },
logger: { log: printAuthLog },
```

```ts
export function printAuthLog(
  level: LogLevel,
  message: unknown,
  ...values: unknown[]
) {
  const text = typeof message === "string" ? message : loggable(message);
  const errors = values.filter((value) => value instanceof Error);
  printLog(
    level,
    "Better Auth",
    [text].concat(errors.map(loggable)).join(": "),
  );
}
```

- **An unexpected error leaves the router without being printed by it, and Better Auth's logger goes through a filter.** Better Auth's router and the route library under it print the whole error, and the error of a failed query carries its values: e-mail, name, password hash, token, IP. With `onAPIError.throw`, the app's handler logs only the error's name and code and answers 500. Better Auth's logger prints each error it catches the same way, so `logger.log` keeps each one to its name and code, and leaves out the other values that come with the message (RNF-OBS-01). Tests: `sign-up.db.test.ts`, "a sign-up whose login identity write fails" (the handler's line) and "a sign-up whose user write fails" (the logger's line); `sign-in.db.test.ts`, "logs the failure without the session's token (RNF-OBS-01)".
- **The log of a server error names the route by its pattern, never by the path as received.** With `onAPIError.throw` on, the router no longer logs a server error that Better Auth answers itself, so the app's handler logs a line with the status and the route; without it, a failure such as the session read's would reach the user as a 500 that no line names. The route goes through `routePattern`, because the path of the password reset's link carries the token, and a route outside its list is logged as `other`. No test shows that this line names the pattern rather than the path: `routes.db.test.ts`, "is logged with the status and the route (RNF-OBS-01)", uses `/get-session`, whose pattern is the path itself. What `routePattern` returns is covered through the security log, a token's segment and a route outside the list included: `src/data/audit/security-events.db.test.ts`, "whose route keeps %s".
- **The base path is explicit** because the app's handler strips it to get the route that the rate limit and the security log use. Test: `rate-limit.db.test.ts`, "of a sign-in spelled with a trailing slash names the sign-in's route".

## E-mail

```ts
export const verificationLinkLifetime = { seconds: 60 * 60, text: "1 hora" };
export const passwordResetLinkLifetime = {
  seconds: 60 * 30,
  text: "30 minutos",
};

function startSending(kind: "verification" | "password reset", email: Email) {
  void (async () => {
    try {
      await mailer.send(email);
    } catch (error) {
      printLog(
        "error",
        "Mailer",
        `Sending the ${kind} e-mail failed: ${loggable(error)}`,
      );
    }
  })();
}

// sendPasswordResetEmail does the same, with its own words and lifetime
export async function sendVerificationEmail({ user, url }: LinkEmailData) {
  startSending("verification", {
    to: user.email,
    subject: "Confirme o seu e-mail",
    text: `Abra o link para confirmar o seu e-mail. O link vale por ${verificationLinkLifetime.text}.\n\n${url}\n`,
  });
}
```

- **A callback starts the send, does not wait for it, and handles its failure.** Both callbacks call one function of the `auth` module, which logs a failed send as an error with the failure's name and code only. The message stays out, as a provider's can name the recipient (RNF-OBS-01). A bare `void mailer.send(...)` would leave a failed send as a rejection nobody handles, against A3.9: the failure goes to the log, and the request does not break. Tests: `email-delivery.db.test.ts`, "the response of a request that sends an e-mail (A3.7, NF-4)" and "a request whose e-mail fails to send (A3.9)"; the adapter's `after()`: `src/infra/mailer/mailer.test.ts`, "the file adapter holds the send in after(), and the message reaches the mailbox only when Next runs it".
- **Both links' lifetimes are explicit, next to the words the message says them in:** 1 hour for the verification, 30 minutes for the password reset. A message then never names a time its link does not have (A3.10). Tests: `email-verification.db.test.ts`, "still confirms the e-mail 59 minutes later" and "no longer confirms it 61 minutes later, and sends the holder to a page of the app with the error"; `email-delivery.db.test.ts`, "the password reset e-mail names the 30 minutes its link really lasts".
- **`requireEmailVerification: false` is explicit.** RF-AUT-02: the confirmed e-mail gates a child profile, not the sign-in, and the config states that choice instead of leaving it to the library's default. Test: `email-verification.db.test.ts`, "a sign-in with an e-mail not yet confirmed (A3.4)".

## The sign-up's confirmation

`emailVerification.sendOnSignUp` stays `false`, and the app's own plugin sends the confirmation from an after-hook of `/sign-up/email`:

```ts
export const signUpConfirmation = {
  id: "sign-up-confirmation",
  hooks: {
    after: [
      {
        matcher: (ctx) => ctx.path === "/sign-up/email",
        handler: createAuthMiddleware(async (ctx) => {
          const signedUp = ctx.context.newSession;
          // A sign-up whose holder's profile fails has created its session already, and answers an error (A2.13)
          if (!signedUp || ctx.context.returned instanceof APIError) return;
          await sendVerificationEmailFn(ctx, signedUp.user);
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin;
```

- **The sign-up's e-mail leaves after the commit and after the holder's profile hook.** In the installed version, Better Auth's own send on sign-up starts inside the user's transaction, before the holder's profile and consents are written, so a sign-up that then failed would send a link to an account that does not exist, against the rule of skill `data-layer` that an e-mail leaves after the commit. The after-hook sends only when the sign-up answered well, with the Better Auth function that makes the same link; a refused or failed sign-up sends nothing. Tests: `email-verification.db.test.ts`, "the confirmation e-mail of a sign-up (A3.1)" and "a sign-up that does not end well (A3.1)".

## Schema generation

Generate the Better Auth tables with the CLI (`npx auth@latest generate --adapter drizzle --dialect postgresql`; older docs call the package `@better-auth/cli`). Write the output to `src/data/db/schema/auth.ts`, then follow the migration steps of skill `data-layer`. Better Auth's `validateSchema`, on by default outside production, reports any drift between that file and what the library writes.

- Declare every Better Auth table with the shared `app` schema object (`app.table(...)`), never in the default schema. That declaration is what puts the tables in `app` at runtime: the adapter uses the schema object it receives.
- Keep `schemaName: 'app'` in the adapter, so the CLI generates the tables in `app` when the schema is regenerated. On its own, the option moves no table: in 1.7, only the CLI's schema generator reads it.
