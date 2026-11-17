# RBAC in Next.js 16

Read when a ticket touches sessions, roles, enrollment or ownership. The roles and capabilities of a project live in its ADRs and `GLOSSARY.md`; this file is the pattern they plug into.

## Decision function

`can(user, capability, resource?)` in `src/domain/`, pure and unit-tested:

1. **Role grant (RBAC):** is the capability granted to the user's role? Unknown role or capability → `false`.
2. **Resource relation (ABAC/ReBAC):** for resource capabilities, does the relation hold (owner, enrolled, member)?

Capabilities are `resource:action` strings (`course:edit`, `lesson:read`, `progress:write`), mapped to roles in one table in `domain/`.

## Where each check runs

| Layer                                                              | Check                                                                           | Strength                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------- |
| `proxy.ts`                                                         | session cookie present for private areas; redirect to login                     | optimistic, never the barrier |
| `data/` session helper (`verifySession`, wrapped in `React.cache`) | valid session; returns a minimal `{ id, role }`                                 | secure                        |
| `data/` resource functions                                         | `can()` plus a query scoped by ownership or enrollment; returns `null` or a DTO | secure, authoritative         |
| Server Components                                                  | decide what UI to show from DTOs the data layer already filtered                | UX                            |
| Server Actions                                                     | session + `can()` + schema validation inside each action                        | secure                        |
| Route Handlers                                                     | 401 without a session, 403 without permission, same data functions              | secure                        |
| Client islands                                                     | hide controls from capabilities received as props                               | UX                            |

## Rules

- A role read from a stateless cookie is optimistic. Destructive and admin actions reread the role from the database, so revocation takes effect.
- Public catalog DTOs carry no protected URLs (video, files). Protected content comes from a separate data function behind `<Suspense>` that checks the session.
- Static and media files (video, PDFs) need their own access control at the storage or video provider. Flag it with `NEEDS-DECISION:` when a ticket serves them.
- A missing permission on a resource the user should not know about returns `notFound()`; one they know exists returns a forbidden result. The project's ADR picks which applies where.
- Log denials in a parseable format, without personal data.

## Tests

- A `can()` matrix: role × capability × relation, including unknown role and unknown capability → `false`.
- Each data function and action with three users: the owner, another user of the same role, and anonymous.
- An action called without a session, and with another user's resource id, fails without changing data.
