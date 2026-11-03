# workout-tracker — review policy

Highest-priority instructions for a **posted** review — the independent CI
reviewer (`.github/workflows/claude-review.yaml`, triggered by `@claude review`).
This file governs the posted artifact only. *How* to review lives in the
`workflow:code-review-guideline` skill plus
[docs/agents/review-lenses.md](docs/agents/review-lenses.md); where they
disagree about a posted review, **this file wins**.

## Stance

- **Advisory.** The reviewer MUST NOT gate merges.
- The review MUST be COMMENT-type. Never `APPROVE`, never `REQUEST_CHANGES`.
- Prefer a few high-confidence findings over noise.

## Labels

| Label | Meaning |
| --- | --- |
| **Important** | Act on this before merge. |
| **Nit** | Optional — the author MAY ignore it. |

- The summary MUST open with a one-line tally: `2 Important, 3 Nits`.
- Critical and Major collapse to **Important**; Minor and Nit to **Nit**. The
  internal ladder MUST NOT appear in posted output.
- An unmet or unverifiable acceptance criterion of the linked issue MUST be
  reported **Important**.

## Do not report

- Anything the tooling already enforces: type errors (`tsc --noEmit`), and formatting / import order (Biome style: tabs, double quotes) — once Biome's config is fixed.
- Generated files and lockfiles — flag the *source* change instead.
- Pre-existing problems the diff does not touch.

## Out of scope

- Running the build or test suite. When a change needs verification the
  reviewer cannot run, it MUST say so rather than assume it passes.
