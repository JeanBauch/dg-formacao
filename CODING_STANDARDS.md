# Coding standards: DG Formação

Read by the implementer before coding and by reviewers after. Only judgement calls belong here: anything mechanical
(formatting, import order, banned APIs) belongs in lint, typecheck or a hook. Where this file and the
reviewer's code-smell baseline disagree, this file wins.

## Framework patterns

The rules in `.claude/skills/data-layer/SKILL.md`, `.claude/skills/auth-identity/SKILL.md`, `.claude/skills/next-architecture/SKILL.md`, `.claude/skills/react-state/SKILL.md` and `.claude/skills/seo/SKILL.md` are standards too: review against them. This file holds the project's own judgement calls.

## Privacy and security

- No e-mail, phone number or name in analytics events, logs, error reports or job summaries; use the pseudonymised profile identifier (RPV-09, RNF-SEG-13).
- Rich text is restricted Markdown rendered by React components, never raw HTML (RNF-SEG-12).
- Accept links only with `https:` or a relative path, validated at the boundary (RNF-SEG-12).
- No third-party script, font or image (RNF-SEG-12).
- Workflows declare minimal `permissions`, pin actions by SHA and never use `pull_request_target` (RNF-SEG-13).
- Issues and PRs never describe a vulnerability that is still open (RNF-SEG-13).
- Real data never reaches development, CI, staging, seeds or fixtures (RNF-SEG-14).
- Connect to the database only over TLS (RNF-SEG-14).
- Each encryption key (backups, analytics HMAC, Better Auth secret) is separate from the others and lives outside the database and the repository (RNF-SEG-14).

## Design

- Prefer deep modules: a small public interface hiding real behaviour. Avoid pass-through wrappers.
- No speculative generality: no options, layers or abstractions the spec does not need yet.
- Names use the terms in `GLOSSARY.md`; one concept, one name.

## Next.js and React

- Server Components by default. Add `"use client"` only for interactivity or browser APIs, as low in the tree as possible.
- Validate every external input (form data, route params, request bodies) at the boundary, before it reaches domain code.
- Data access lives behind a module interface, never inline in components.

## Errors

- No silent `catch`: handle the error, or let it propagate with context.
- Empty, loading and error states are explicit in the UI, not console output.
- Every client-side Server Action call handles a rejected promise (network drop, server restart) with an in-UI message. "The spec doesn't cover it" is not a reason to skip this.
- A multi-statement transaction rolls back on failure; a shared connection never stays inside an open transaction.

## Tests

- Test behaviour through public interfaces at the agreed seams; no tests of private functions or internal calls.
- Expected values come from the spec or a worked example, never recomputed the way the code computes them.
- A bug fix starts with a failing regression test.
