# workout-tracker — Working Agreement

workout journal web app (MVP): log workouts, exercises, sets, reps and weights, and chart progress (estimated 1RM, volume). Next.js 15 + TypeScript + Prisma + Supabase.

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

Next.js 15 (App Router) app in `src/app`, Prisma schema and migrations in
`prisma/`, Supabase (Postgres + Auth + RLS) for persistence. Package manager:
pnpm (the lockfile is v6, so pnpm 8 — a newer pnpm refuses it with
`ERR_PNPM_LOCKFILE_BREAKING_CHANGE`).

Intended architecture (README § Architecture): Presentation (presentational +
container components) → Application (use cases, DTOs) → Domain (entities, core
logic) → Infrastructure (Prisma, Auth, DB, API routes). Data flows
Container → Use Case → Repository → DB → Presentational Component. `src/`
currently holds only `src/app`, so most layers are not on disk yet.

## Verify

Run these and report their actual output before you call a change done:

```bash
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build
```

Use pnpm 8 (`npx pnpm@8 …` if yours is newer) — the lockfile is v6.

Known gaps, not part of verify until fixed: `pnpm lint` runs ESLint, which is
not installed or configured; `biome check .` fails on `biome.json` itself
(`files.ignore` is Biome 1.x syntax, 2.2.6 expects `files.includes`); there is
no unit-test runner yet (`test:db` needs a live `DATABASE_URL`). A change that
touches the DB layer SHOULD also run `pnpm test:db` when a database is
available.

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

Changes touching **migrations (`prisma/migrations`), data loss, or auth (Supabase Auth, Row Level Security)** warrant extra review and a short
ADR in `docs/adr/` recording the decision.
