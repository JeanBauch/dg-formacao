---
name: react-state
description: React 19 state decision ladder, Context, derived state, forms and actions, React Compiler and lazy loading in Next.js 16. Use when writing or reviewing Client Components, hooks, forms or state.
---

Rules for React 19.3 on Next.js 16 with the React Compiler on. Where a Next.js doc example contradicts these rules (it still shows `<Context.Provider>`), these rules win.

## State ladder

Start at the top. Move down a rung only when its trigger holds, and name the trigger in a comment on the ticket.

| Rung | Where state lives                                                                                                                                                     | Trigger to go further down                                                                    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 0    | Server Component data, passed as props or a promise read with `use()`                                                                                                 | the value must survive reload, be shareable by link, or change the server query               |
| 1    | URL: `searchParams` in the page, updated with `<Link>` or `router.push` inside `startTransition`                                                                      | the state is the result of a user write                                                       |
| 2    | Form and mutation: `<form action>` + `useActionState` + `useFormStatus` + `useOptimistic`                                                                             | the state is pure UI (open, draft, selection)                                                 |
| 3    | Local: `useState`; `useReducer` when transitions have rules                                                                                                           | two siblings need the same state                                                              |
| 4    | Lift to the common parent; pass JSX as `children`; then Context                                                                                                       | client-read data that changes without navigation and needs a shared cache, refetch or polling |
| 5    | TanStack Query: one `QueryClient` per request on the server, a singleton in the browser, `staleTime` above 0, prefetch in a Server Component with `HydrationBoundary` | client-only state shared by trees with no common ancestor                                     |
| 6    | Zustand: a store per request, created in a `"use client"` provider; selectors on every read                                                                           | none                                                                                          |

Libraries are adopted by trigger, not up front. URL state uses `URLSearchParams` by hand; adopt nuqs at about four or more typed parameters with defaults. Adopting TanStack Query, Zustand or nuqs is an `ASSUMPTION:` on the ticket, or a `NEEDS-DECISION:` when it reshapes existing code.

## Derive, don't store

- Compute values from props and state during render. An effect exists only to sync with an external system.
- Reset state with `key` (`<CourseForm key={courseId} />`); store `selectedId`, not the selected object.
- One `status` field instead of several booleans that can contradict each other.
- External sources (`navigator.onLine`, stores) use `useSyncExternalStore`.

## Forms and actions

- `useActionState(action, initial)` gives `[state, formAction, isPending]`; the action receives `(prevState, formData)`.
- `useFormStatus` lives in a child component of the `<form>`, never in the component that renders it.
- `useOptimistic` runs inside an action or transition; the optimistic value reverts when the action fails.
- After an `await` inside `startTransition`, wrap each further `setState` in another `startTransition`.

## Context

- Reach for Context after props and `children` composition fail.
- Split state and dispatch into two contexts when some consumers only dispatch; wrap each in a `useX()` hook that throws outside its provider.
- React 19 syntax: `<ThemeContext value={theme}>`, `ref` as a prop, `use(Context)` where reading is conditional.

## Performance

- The React Compiler memoizes components and hooks: write new code without `useMemo`, `useCallback` or `memo`. Use them only as a measured escape hatch (for example a value an effect depends on). Leave existing manual memoization in place.
- Code follows the Rules of React: pure render, immutable props and state, hooks at the top level. `eslint-plugin-react-hooks` `recommended` enforces them.
- Heavy filters and search: the input keeps synchronous `useState`, and the result list uses `useDeferredValue` or a transition, staying visible while stale.
- Lazy-load heavy client islands with `next/dynamic` (with `ssr: false` only inside Client Components), declared at module top level, inside `<Suspense>`.
- `useSearchParams` needs a `<Suspense>` above it, or the production build fails.

## ViewModel hooks

A client island is a View plus a ViewModel hook (`useCourseEditor(initialCourse)`). The hook owns `useReducer`, `useOptimistic`, `useActionState` and `useTransition`, and returns derived values plus named commands (`addLesson`, `save`). It holds no JSX and no authorization: it receives what the server already allowed. Test the reducer as a pure function, the hook with `renderHook`, and the View with a fake ViewModel.

## Verify

- `pnpm lint` passes with `react-hooks` `recommended` (it catches `set-state-in-effect`, impure render and mutated props).
- A test that needs `waitFor` to see a derived value usually points to an unneeded effect.
- Optimistic UI has two tests: the slow action shows the optimistic value, and the failing action reverts it.

## Version traps

- `useFormState` → `useActionState`. `forwardRef` → `ref` as a prop. `<Context.Provider>` → `<Context value>`.
- `eslint-plugin-react-compiler` is obsolete; its rules are in `eslint-plugin-react-hooks`.
- `searchParams` and `params` are promises.
- A promise created during a Client Component's render and passed to `use()` suspends forever; create it on the server or in a cache.
