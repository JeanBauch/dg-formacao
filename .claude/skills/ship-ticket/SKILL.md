---
name: ship-ticket
description: "Ship one ticket end to end: branch, implement, review, PR, green CI. Stops before the merge. Usage: /ship-ticket [ticket#]"
disable-model-invocation: true
---

Ship one ticket from `main` to a PR with green CI. The human merges. You orchestrate: the `implementer` subagent writes the code, and you verify, review and publish.

Everything a human reads (issue comments, PR body, your final report) is in Brazilian Portuguese.

## 1. Select the ticket

- With an argument, use that ticket.
- Without one, find the open `type:ticket` issues whose `blockedBy` are all closed (`gh issue list --label type:ticket --state open`, then `gh issue view <n> --json title,labels,parent,blockedBy`). Propose the lowest-numbered one and wait for the human to confirm.

Done when one ticket number is confirmed.

## 2. Preflight

Check each of these. If any fails, stop and say which one:

- `git status --porcelain` is empty.
- `git switch main` and `git pull --ff-only` succeed.
- The ticket is open and labelled `type:ticket`, and every `blockedBy` issue is closed.
- Its parent spec has `ready-for-agent`.
- The local services the tests need are up: if the project's `CLAUDE.md` lists a command that starts them (a database container, for example), run it and check that it succeeds.

Note whether the ticket has the `model:opus` label.

## 3. Branch

`git switch -c feat/<n>-<slug>`, where the slug is the ticket title in kebab-case ASCII, at most five words.

## 4. Implement

Call the Agent tool with `subagent_type: "implementer"`. Pass `model: "opus"` when the ticket has `model:opus`; otherwise leave `model` out so the agent's Sonnet default applies. Prompt: `Ticket #<n>, spec #<spec>. Branch feat/<n>-<slug> is checked out.`

Read the report's `Status`:

- `needs-decision`: relay the question to the human and stop.
- `stuck`: go to step 7 (escalation).
- `done`: go on.

## 5. Verify

Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm test` yourself, each on its own, with `CI=true` set as the CI sets it (in Bash: `CI=true pnpm test`). Some tools behave differently under `CI=true` (typescript-eslint, for one), so a run without it does not predict the CI. `git log main..HEAD --oneline` must show at least one `feat(#<n>)` commit.

Done when all four exit 0. Their output is the PR's evidence.

## 6. Review

Run the Skill tool with `code-review` (args `main`), then with `mattpocock-skills:code-review` (args `main`).

Give every finding a verdict:

- **fix**: correctness bugs are always fixed, unless the spec explicitly requires the behaviour.
- **accept**: a real issue you choose to carry. Give the reason.
- **reject**: false positive, or contradicts the spec. Give the reason.

Before the fix call, check step 7: when step 4 ran on Sonnet and at least one **fix** finding is a correctness bug, escalate now, so the fix call runs on Opus. Then send all the **fix** findings to a new `implementer` call in fix mode, listing each finding with its file and failure scenario, on the model step 4 used or on Opus if you escalated. Then repeat step 5.

A finding that both reviews report gets one verdict, citing both.

Done when every finding has a verdict, the fixes are committed, and step 5 is green again.

## 7. Escalation to Opus

Escalate when either is true: the implementer returned `stuck`, or the Sonnet run's review produced at least one **fix** correctness bug.

Rerun the pending work (step 4, or the fix call in step 6) with `model: "opus"`, and comment on the ticket: `Escalado para Opus: <motivo>`.

Escalate once per ticket. If Opus also returns `stuck`, stop and hand the failing output to the human.

## 8. Pull request

1. Write the body with the Skill tool `mattpocock-skills:pr`. Include:
   - `Closes #<n>`, and `Closes #<spec>` when this is the spec's last open ticket;
   - the step 5 evidence;
   - a findings table (finding, verdict, reason);
   - the model used and whether it escalated.
2. `git push -u origin feat/<n>-<slug>`. The human approves the push.
3. `gh pr create --base main --title "feat(#<n>): <ticket title>" --body-file <file>`

## 9. CI

`gh pr checks <pr> --watch`. Right after a push, it can exit 1 with "no checks reported" because GitHub has not registered the checks yet: that is not a failure. Run it again once `gh pr checks <pr>` lists them. When it goes red:

1. Read the failure. For a workflow job, `gh run view <run-id> --log-failed`. For a code scanning check such as CodeQL, which has no job log, read the open alerts on the PR: `gh api "repos/{owner}/{repo}/code-scanning/alerts?pr=<pr>&state=open"`. Filter by `pr`, not by `ref`: depending on the setup, CodeQL analyses the PR's head ref or its merge ref.
2. Fix it through the implementer in fix mode, with the model of step 4; a failure that is a correctness bug escalates as in step 7. Fix a code scanning alert in the code: dismissing one on GitHub is the human's decision.
3. Push, and watch again.

Allow at most two red rounds, then stop and report.

A red check in a test this ticket did not touch, which passes on rerun (`gh run rerun <run-id> --failed`) with no change, is a flaky test: open an issue `flaky: <test name>` with the failing log line, and do not count it as `ci-vermelho`.

Done when every check passes.

## 10. Report

Comment on the ticket with one line:

`Métricas: modelo=<sonnet|opus|sonnet→opus> · findings=<fix>/<accept>/<reject> · assumptions=<n> · ci-vermelho=<n>`

`assumptions` counts the ASSUMPTION items on the ticket. An item that a later `ASSUMPTION (substitui ...)` comment replaces counts once.

Then tell the human:

- the PR URL;
- that CI is green;
- the same metrics;
- and finally, when the PR closes the spec: "Spec #<spec> concluído. Depois do merge: `/clear` e o retro do spec (playbook, F8)." Otherwise: "Pronto para o seu merge. Depois: `/clear` e `/ship-ticket`."
