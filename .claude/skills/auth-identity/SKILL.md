---
name: auth-identity
description: Accounts, sessions, profiles and staff roles with Better Auth 1.7 in this project, covering the session gate, the active profile and child PIN, the catalog scope, and staff session rules. Use when a change touches sign-up, sign-in, password reset, e-mail verification, `src/data/auth/`, profiles, the child catalog, staff roles or the Better Auth config.
---

The project layer over [RBAC.md](../next-architecture/RBAC.md), which already covers the `can()` decision function, where each check runs, and the three-user tests. The rules below come from ADR-008 and the spec (RF-AUT, RF-PRF, RN-04, DP-13). Pinned version: `better-auth` 1.7.x. Where an installed Better Auth skill or a doc example disagrees with this file, this file wins.

## Names

Better Auth's names are used in the database and in code. The glossary names stay in UI text, issues and ADRs.

| Better Auth | Glossary | In this project |
| --- | --- | --- |
| `user` | Conta (the adult holder) | Table `app.user`. Quote `"user"` in raw SQL, since it is a reserved word. Keys to it are `user_id` / `userId` |
| `account` | Identidade de login | One row per sign-in method. In code, *account* always means this |
| `session` | Sessão | One per device |
| `profiles` (ours) | Perfil | Owns enrollments and progress. `kind` is `standard` or `child` |

## The session gate

Identity comes from three helpers in `src/data/auth/`, each wrapped in `React.cache`:

- `verifySession()` returns `{ userId, roles, emailVerified, sessionId, sessionCreatedAt }` or `null`, read through `auth.api.getSession({ headers: await headers() })`.
- `requireActiveProfile()` returns `{ profileId, kind, scope }` for the current session, or redirects to "Quem está assistindo?" (RF-PRF-03).
- `requireStaff(capability, { fresh })` applies the staff session rules and `can()`.

Every `src/data` function, Server Action and Route Handler that serves private data starts with one of these. **Deny by default:** a missing session, profile or capability ends the call before any query runs.

## Auth flows go over HTTP

Sign-up, sign-in, password reset and e-mail verification forms use the Better Auth client (`authClient`, which calls `/api/auth/*`). That path applies rate limiting and the CSRF and origin checks. Calls to `auth.api` from server code skip rate limiting, so server code uses `auth.api` only to read the session, to sign out, and for staff operations already behind `requireStaff`.

`proxy.ts` checks only that the session cookie exists (`getSessionCookie`) and redirects to sign-in, keeping the requested path (RF-AUT-07). Authorization happens in the gate.

## Branches

- Changing `src/data/auth/auth.ts` or any Better Auth option: [CONFIG.md](CONFIG.md)
- Profiles, the active profile, the PIN, the child catalog scope, the holder's read-only view: [PROFILES.md](PROFILES.md)
- Staff roles, invites, staff sessions, sensitive actions, admin endpoints: [STAFF.md](STAFF.md)

## Tests

- RBAC.md's three users, plus a child profile of the owner and one staff account per role.
- Auth flows are tested through HTTP (`/api/auth/*`), the path real users take. That way rate limits and enumeration behaviour are covered.
- E2E suites sign in once per role and reuse the stored state, which keeps them well under the rate limits.

## Unverified (confirm in R0, then delete this section)

- U4: the admin plugin stores several roles comma-separated in `role` and honours all of them.
- U5: a password-reset request returns the same response for an unknown e-mail.
- U6: `after()` works inside Better Auth's e-mail callbacks, since they run in the request scope of the route handler.
- U9: the rate-limit path names in 1.7: `/sign-in/email`, `/sign-up/email`, `/request-password-reset` and `/send-verification-email`. `/sign-in/email` was confirmed in #11; the other three names are still to confirm.
- U11: `disabledPaths` is checked only by the HTTP router, so the admin plugin's permission check, called by the server, still works with its HTTP route disabled (CONFIG.md, STAFF.md).
- U12: Better Auth deletes the expired rate-limit rows in the database. The 1.5 release notes mention the automatic cleanup only for in-memory storage, so read the 1.7.15 code. The daily job deletes them either way (CONFIG.md).
