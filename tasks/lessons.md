# Lessons

Patterns to avoid, written after a correction. Review at the start of a session.

## 2026-11-22 — Exercise instructions (#97)

### 1. Write the plan and check in before implementing
- **What happened:** I started building the whole feature without writing
  `tasks/todo.md` or asking for a go-ahead. The owner stopped me mid-way.
- **Rule:** For any task with 3+ steps, write the plan to `tasks/todo.md`, show
  it, and wait for a yes before changing code. Starting "just the easy part"
  still counts as implementing.

### 2. After grilling, split the work into small issues before coding
- **What happened:** I filed one issue for data, backup, form and UI. One PR for
  all of it was "brutal for reviewers". I had to split it into #98, #99, #100.
- **Rule:** Grilling → `to-issues` → implement. One issue is one reviewable PR.
  Put escalation-sensitive parts (backup validation, URL handling) in their own
  slice. Get the owner's OK on the split before creating the issues.

### 3. Search the code before saying something does not exist
- **What happened:** I told the owner and the agents that the repo has no
  component tests. `ExerciseNotes.test.ts` calls a component directly, and the
  reviewer pointed it out.
- **Rule:** Before stating "the repo has no X", grep for it. A component can be
  tested by calling it as a function when its outer part has no hooks.

### 4. Plan the shared files when slices run in parallel on a stack
- **What happened:** #99 and #100 both created `src/lib/instructions.ts` and its
  test. After one merged, the other conflicted and needed a rebase and a
  force-push. Every squash-merge below a stack also forced a rebase above it.
- **Rule:** When slices will be built in parallel, decide up front which slice
  creates each shared file and give the others their own file (or a later
  hand-off). Expect to rebase the rest onto `main` after each squash-merge, and
  ask before force-pushing.
