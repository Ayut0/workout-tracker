# workout-tracker — Working Agreement

workout journal PWA (MVP): log workouts, exercises, sets, reps and weights, and chart progress (estimated 1RM, volume). Local-first: Vite + React + TypeScript, records in IndexedDB (Dexie) on the phone, plus a small Cloudflare Worker that only sends rest-timer pushes.

This file is the working agreement for any agent or contributor. It is
intentionally thin: the shared cycle and review method live in the
[`workflow` plugin](https://github.com/Ayut0/marketplace-for-ai-agent) (auto-enabled by
`.claude/settings.json`) and the
[matt-pocock skill suite](https://github.com/mattpocock/skills); this file only
spells out the facts specific to this repo.

## Requirement Level Keywords

| Keyword | Synonym | Meaning |
| ------- | ------- | ------- |
| "MUST" | "REQUIRED" | Non-negotiable requirement; no exceptions. |
| "MUST NOT" |  | Non-negotiable prohibition; no exceptions. |
| "SHOULD" | "RECOMMENDED" | Strongly preferred; deviation is allowed only after weighing the implications. |
| "SHOULD NOT" | "NOT RECOMMENDED" | Strongly discouraged; allowed only after weighing the implications. |
| "MAY" | "OPTIONAL" | Genuinely optional; no preference implied. |

## The cycle

`/workflow:address` drives one unit of work — a GitHub issue, a pull request,
or a free-form prompt — through this cycle end-to-end.

Every unit of work follows `plan → implement → self-review → verify → report`.
Before planning, you MUST classify the request (bugfix, feature, refactor,
docs, triage) and define success criteria, affected surface, and verification
expectations, then inspect only the minimal context that classification needs.

1. **Plan** — clarify intent and design before coding. → `to-prd` /
   `to-issues`, then `grill-with-docs`.
2. **Implement** — test-first where there's runtime behavior, in the narrowest
   scope that satisfies the request (SHOULD). → `tdd`.
3. **Self-review** — you MUST reset into reviewer mode and read your own diff
   as a distinct phase. → `workflow:code-review-guideline`.
4. **Verify** — you MUST run the [Verify](#verify) commands and report the
   actual output, not a claim.
5. **Report** — you MUST summarize changed files, verification status,
   trade-offs, residual risk, deferred follow-ups, and whether skill
   maintenance was done, skipped, or blocked. Ask a concrete question when a
   decision needs product, scope, or domain input you can't infer.

## Review Independence Gates

A single agent cannot self-certify non-trivial work. Self-review MUST be a
distinct reset into reviewer mode against `git diff`, and Critical/Major
findings from it MUST be fixed before you report. Changes that hit an
[Escalation](#escalation) trigger MUST additionally go through the independent
CI reviewer (`@claude review`) before the work is reported done.

## Skill routing

| When you're… | Use |
| --- | --- |
| Delivering a unit of work end-to-end | `/workflow:address` |
| Turning an idea into scoped work | `to-prd` → `to-issues` |
| Pressure-testing a plan against the domain | `grill-with-docs` |
| Triaging an incoming issue | `triage` |
| Writing code or a bugfix | `tdd` |
| Chasing a bug, test failure, or surprise | `diagnose` |
| Refactoring or improving structure | `improve-codebase-architecture` |
| Suspending work across sessions | `handoff` |
| Self-reviewing, or reviewing a PR | `workflow:code-review-guideline` |

Routing changes that apply to every repo belong upstream in
`Ayut0/marketplace-for-ai-agent`, not here. Propose a repo-local change only for a
convention specific to this repo.

## Agent skills

- **Issue tracker:** GitHub issues on `Ayut0/workout-tracker` — see
  [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).
- **Domain docs:** see [docs/agents/domain.md](docs/agents/domain.md).
- **Review lenses:** see [docs/agents/review-lenses.md](docs/agents/review-lenses.md).

## Project map

Vite + React PWA in `src/` (components, `src/sw.ts` service worker,
`src/lib` push and timer logic, `src/db` Dexie/IndexedDB). The notification
worker (Cloudflare Worker + Durable Object) lives in `worker/`. There are no
accounts and no workout data on servers: the worker only ever learns a push
endpoint and a time. Package manager: pnpm, pinned by the `packageManager`
field in `package.json` (Corepack picks it up).

Intended direction: components render and emit events; logic lives in
`src/lib` and persistence in `src/db`. `src/lib` and `src/db` MUST NOT import
components, and the service worker and `worker/` MUST NOT import React. The
current `App.tsx` mixes these and is a phase-1 shortcut, not the target.

## Verify

Run these and report their actual output before you call a change done:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

CI (`.github/workflows/ci.yaml`) runs the same commands on every PR.

An independent, advisory CI reviewer runs on demand: comment `@claude review`
on a PR (owner/member/collaborator only). It follows
`workflow:code-review-guideline` plus this repo's lenses, under the
posted-review policy in [REVIEW.md](REVIEW.md), which wins on conflict.

## Conventions

- **Branches:** `<prefix>/issue-<number>-<short-description>` (`feat/`,
  `bugfix/`, `doc/`). One issue per branch — never mix issues.
- **Syncing:** `git rebase origin/main`. Never merge the default
  branch or plain `git pull` on a feature branch.
- **Rewriting pushed history:** the follow-up push MUST be
  `git push --force-with-lease`, never bare `--force`. An agent MUST ask the
  maintainer before rewriting history on a pushed branch (rebase,
  `--force-with-lease`, `commit --amend`, `reset --hard`).
- **Commits/PRs:** open a PR per issue; link it to the issue it addresses.

## Escalation

Changes touching **IndexedDB schema versions (`src/db`), data loss (the Strong import, destructive writes), or the notification worker's trust boundary (`worker/`: allowed origin, push-host allowlist, VAPID keys)** warrant extra review and a short
ADR in `docs/adr/` recording the decision.
