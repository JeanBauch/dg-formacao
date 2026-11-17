---
name: next-architecture
description: Next.js 16 rules for rendering, Cache Components, Server Actions, data access layering, routing and authorization. Use when writing or reviewing pages, layouts, data access, mutations or auth checks.
---

Rules for Next.js 16.4 with Cache Components. Your training data predates this version: when an API looks unfamiliar or a rule conflicts with memory, these rules and `node_modules/next/dist/docs/` win.

## Expected config

`next.config.ts` has `cacheComponents: true`, `partialPrefetching: true` and `reactCompiler: true`. If one is missing, comment `NEEDS-DECISION:` on the ticket instead of coding around it.

## Rendering

- Components are Server Components. Put `"use client"` on the interactive leaf, and pass Server Components into it as `children` or props.
- Client Components receive serializable DTOs or promises, never raw database records. A promise passed down is read with `use()` inside `<Suspense>`.
- Indexable content renders on the server; content behind an interaction is invisible to crawlers.
- Context providers are Client Components that wrap `{children}`, placed as deep as possible, never around `<html>`.

## Static shell and Suspense

- Every runtime read (`cookies()`, `headers()`, `searchParams`, dynamic `params`, uncached fetch, `Date.now()`) sits inside a `<Suspense>` close to where it is read.
- Pass the `params` promise down and `await` it inside the boundary, not at the top of a layout.
- Per-user UI on a public page (enroll button, progress) is a leaf inside `<Suspense>` with reserved height; the rest stays in the static shell.
- Prefer `<Suspense>` near the data over `loading.tsx`. A route that must return a real 404 has no `loading.tsx` above its `notFound()` call.

## Caching

- Nothing is cached unless it runs in `"use cache"`. Every cached function calls `cacheLife(...)` explicitly and `cacheTag(...)` with a tag from one module (`data/tags.ts`).
- Inside `"use cache"`, read no `cookies()`/`headers()`/`searchParams`: resolve the value outside and pass it as an argument. Session-derived caches use a non-exported `"use cache"` function that takes the `userId`.
- Cache keys and tags are plain text: no secrets or personal data in them.
- After a mutation in a Server Action: `updateTag(tag)` for read-your-writes. In a Route Handler or webhook: `revalidateTag(tag, 'max')`.
- Self-hosted with several instances, `revalidateTag` only reaches one instance: flag it with `NEEDS-DECISION:` (custom cache handler) rather than assuming it works.

## Mutations (Server Actions)

- An action is a public POST endpoint. Inside every action, in this order: read the session, authorize (including ownership), validate the input with a schema, call the data layer, update tags, return a minimal result.
- Take an id plus the change from the client; derive identity from the session and reread everything else.
- Expected failures (validation, conflicts) are return values shown with `useActionState`; `throw` only for the unexpected, caught by `error.tsx`.
- Actions run one at a time per client: never `Promise.all` actions; parallel work goes inside one action.

## Layers

| Layer       | Folder                              | Holds                                                                         |
| ----------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| Model       | `src/domain/`                       | types, invariants, permission policies; pure, no `next/*`                     |
| Data        | `src/data/`                         | `import 'server-only'`; queries, session checks, DTOs, `"use cache"` and tags |
| Actions     | `src/actions/`                      | `"use server"`; thin: validate → data → tags                                  |
| Composition | `src/app/`                          | Server Components that call `data/` and place Suspense; no inline queries     |
| ViewModel   | `src/ui/<feature>/use-<feature>.ts` | client hook: UI state, `useOptimistic`, `useActionState`, named commands      |
| View        | `src/ui/<feature>/`                 | props in, JSX out; no fetching, no rules                                      |

`ui/` and `"use client"` files never import `data/`. Policies are pure functions in `domain/`, applied in `data/`.

## Routing

- Public and authenticated areas are separate route groups (`(public)`, `(app)`, `(admin)`). Groups organize; they protect nothing.
- `generateStaticParams` returns at least one param (an empty array fails the build). Reject unknown params with `notFound()`.
- `proxy.ts` (formerly `middleware.ts`) does optimistic cookie checks and redirects only, with a `matcher` that excludes static assets. It reads no database.
- `error.tsx` receives `{ error, retry }`; call `retry()` to refetch and re-render.

## Authorization

- Deny by default. Check permissions on every request in the data layer, every Server Action and every Route Handler; checks in layouts, pages or `proxy.ts` are UX only.
- Scope queries by ownership (`where: { id, instructorId: user.id }`) so a forgotten check cannot leak another user's record (IDOR).
- When a ticket touches sessions, roles, enrollment or ownership, read [RBAC.md](RBAC.md) first.

## Verify

- `pnpm build` passes (it fails on a `server-only` import in client code, on runtime reads outside Suspense, and on removed route configs).
- Data-layer and action tests run as at least three users: owner, another user of the same role, and anonymous.
- A route that must 404 is asserted on `response.status()`, not only on the rendered text.

## Version traps

- Removed: `export const dynamic`, `revalidate`, `fetchCache`, `dynamicParams`, `experimental.ppr`, `unstable_noStore`, sync `params`/`searchParams`/`cookies()`/`headers()`.
- Renamed: `middleware` → `proxy`; `unstable_cacheLife`/`unstable_cacheTag` → `cacheLife`/`cacheTag`; `error.js` `reset` → `retry`.
- Changed: `revalidateTag` needs a second argument; `updateTag` and `refresh` work only in Server Actions; `next lint` is gone (ESLint CLI); Turbopack is the default bundler.
