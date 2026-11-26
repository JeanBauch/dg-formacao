# DG Formação

## Framework rules

Claude Code reads this file instead of AGENTS.md, so the Next.js agent rules are imported here:
@AGENTS.md

## Commands

- Install: `pnpm install`
- Dev server: `pnpm dev`
- One test file: `pnpm vitest run path/to/file.test.ts`
- Tests related to changed files: `pnpm vitest related --run <files>`
- Typecheck: `pnpm typecheck` · Lint: `pnpm lint` · Unit: `pnpm test` · E2E: `pnpm test:e2e`
- Local services: the database tests need the local Postgres; start it with `pnpm db:up` (Docker must be running).
- Development database, in this order: `pnpm db:up` · `pnpm db:roles part-1` · `pnpm db:migrate` · `pnpm db:roles part-2` · `pnpm db:seed`.
- `pnpm test:e2e` needs the local Postgres (`pnpm db:up`) and a `pnpm build` of the current code: it serves the last build, even a stale one.
- `pnpm build` needs the required configuration variables, from `.env.local` or exported in the shell.
- Like the database tests, `pnpm test:e2e` never runs at the same time as another test run: its setup alters the roles, which belong to the whole Postgres instance.

## Workflow rules

- Specs and tickets live in GitHub Issues (labels `type:spec`, `type:ticket`); see `docs/agents/issue-tracker.md`. Never put file paths or code in them.
- A spec gets `ready-for-agent` only after the gap review (F3) closes with no open questions; publish it with `needs-triage` until then.
- One ticket, one branch, one PR: `feat/<ticket#>-<slug>` from `main`, commits `feat(#<ticket>)` / `fix(#<ticket>)`. `/ship-ticket` runs the whole cycle; tickets labelled `model:opus` are implemented with Opus.
- Never push to `main`, never merge PRs, never edit `.env*` except `.env.example` (variable names and placeholder values only). Lockfiles change only through `pnpm add`/`pnpm remove`, never by hand. The human merges.
- A choice the spec and ADRs don't settle: hard to reverse → comment `NEEDS-DECISION: ...` on the ticket and stop; easy to reverse → pick the simplest option and comment `ASSUMPTION: ...`.
- "Done" means evidence: the exact command you ran and its output.
- Review with the built-in `/code-review` and `/mattpocock-skills:code-review` (Standards and Spec axes); every finding gets a verdict: fix, accept or reject.
- Language: issues, PRs, ADRs and `GLOSSARY.md` in Brazilian Portuguese; code, identifiers and commit messages in English.

## Gotchas

- Multi-line edits: use Edit/Write, not line-number `sed`/`head` splicing. Splicing misplaces code, and the format hook only fires on Edit/Write.
- Never pipe a check into another command before `&&` (`pnpm format:check | tail -3 && git commit`): the pipe hides the failing exit code.
- Long text for a command (a script, a PR or issue body): write it to a file with Write, then pass the file (`--body-file`, `node <file>.mjs`). Heredocs break on quotes and backticks.
- Never run the database suite (`pnpm test`) in the background: there is a single test database, and the verify-gate hook runs tests too.

<!-- Filled by /retro: only things Claude got wrong twice. -->

## Pointers

- Domain terms: `GLOSSARY.md` · Decisions: `docs/adr/` · Review standards: `CODING_STANDARDS.md`

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
