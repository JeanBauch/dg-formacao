# Staff accounts

Read when a change touches staff roles, invites, staff sessions, sensitive backoffice actions or the admin plugin. Staff are the roles `instructor` and `admin`, kept in the admin plugin's `role` field (comma-separated when an account holds both). Students carry the default role `user`.

## Capabilities

- `can()` in `src/domain` maps roles to the capability keys of section 4 of the spec (`course:create`, `course:update:own`, `course:publish`, `course:review`, `taxonomy:manage`, `user:manage`), as RBAC.md describes.
- The admin plugin's HTTP endpoints (`/api/auth/admin/*`) are switched off through `disabledPaths` and answer 404 (CONFIG.md). Staff operations go through Server Actions, which call the plugin's permission check from the server; `disabledPaths` is checked only by the HTTP router, so that call still works (item U11 in SKILL.md). Build `ac` with `createAccessControl` from the plugin's default statements. The `admin` role gets every statement except impersonation: nobody acts as a student, and many students are minors.

## Invites (RF-AUT-08)

An admin invites staff through a Server Action behind `requireStaff('user:manage', { fresh: true })`. The action does not use the admin plugin's create-user call, which writes outside the transaction and would leave a staff account without an audit row. It writes in one Drizzle transaction: the account with its role and sign-in identity, the owner's profile and the audit row. The send is a separate step after the commit, a password-reset link used as the invitation. The invitee accepts the Terms and the Privacy Policy on the password-definition screen, with the same consent rows as sign-up (no IP). Staff accounts never sign up; they come from this write, and the first admin from the bootstrap below.

## First admin (bootstrap)

A Node script, like the seed, calls only the invite write, with an e-mail and a name and without the send. It makes the account with the admin role, the owner's profile and an audit row whose actor is the new account and whose action is bootstrap. It refuses, writing nothing, when an admin already exists or the e-mail already has an account. It has no HTTP route. The person finishes through "Esqueci minha senha", the acceptance and a password of 12 characters or more.

## Staff session rules

These are the MVP's protections in place of MFA (RF-AUT-08). `requireStaff` enforces them on every call:

- **Session age at most 12 hours,** counted from `sessionCreatedAt`. An older session redirects to sign-in with `reauth=1`, and the sign-in page ends the old session. The limit lives in the session gate, which reads the role from the database on each read, and there are no session hooks. A session renewed in the database keeps its age, with or without "remember me".
- **`fresh: true` for sensitive actions:** inviting or suspending an account, changing a role, approving or archiving a course. The session must have been created within the last 10 minutes. Otherwise the action returns `{ status: 'reauth' }` and the UI sends the user to sign in again, then back to the action.
- **Roles are read from the database on every call.** The session cookie cache is off, so a demotion takes effect on the next request (RBAC.md).

## Staff passwords

Staff passwords have at least 12 characters. A before-hook on the reset finds the account from the link and refuses a shorter password, so the password does not change and the link stays valid until it expires (CONFIG.md). The sign-in check below stays as the second barrier. An after-hook on `/sign-in/email` checks the length of the submitted password once the password has been verified. When a staff account's password is shorter, the hook revokes the new session and answers with an error that sends the user to set a new password. An after-hook on `/sign-in/email` reaches and deletes the session that sign-in has just created, and drops the `set-cookie` the answer already carries (confirmed in #11, commit 80dc97e). Because the check runs only after verification, it reveals nothing to someone who does not know the password, and it covers every path that can set a password.

## Suspension and audit

- Suspending a student or staff member (RF-ADM-11) uses the admin plugin's ban, which also revokes that account's sessions.
- Every staff write records the actor, action, entity, and the before and after values in `audit_log`, in the same transaction as the change (RF-ADM-10).

## Tests

- An instructor editing another instructor's course is refused, and nothing changes.
- A session older than 12 hours gets `reauth`, and so does a sensitive action on an 11-minute-old session.
- The admin impersonation endpoint is refused for every role.
- Signing in as staff with an 11-character password is rejected and leaves no session behind.
- Each staff write leaves exactly one `audit_log` row, and none when the write fails.
