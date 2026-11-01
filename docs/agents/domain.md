# Domain Docs

How the engineering skills should consume this repo's domain documentation.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, if it exists — the domain glossary,
  created lazily by `/grill-with-docs`.
- **`docs/adr/`** — ADRs that touch the area you're about to work in.
- **`README.md`** § Architecture and § Database Schema — design rationale and the data model, until `docs/architecture.md` exists.

If any of these files don't exist, **proceed silently** — don't flag their
absence or suggest creating them upfront.

## Use the glossary's vocabulary

When your output names a domain concept, use the term as defined in
`CONTEXT.md`. If the concept isn't there yet, either you're inventing language
the project doesn't use (reconsider) or there's a real gap (note it for
`/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly:

> _Contradicts ADR-0001 (…) — but worth reopening because…_
