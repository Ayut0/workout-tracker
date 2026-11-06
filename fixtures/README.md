# Fixtures

Test data for the Strong CSV import.

**Personal data never goes in this repo.** It is public. Every file checked in
here is synthetic: made-up workouts, not anyone's real training log.

- `strong-sample.csv`: a synthetic Strong export used by
  `src/lib/strongCsv.test.ts`. Its weights are in kg and its distances in km.
- `private/`: git-ignored. Put your real Strong export here (for example
  `fixtures/private/strong.csv`) to try the parser on it locally. Never commit
  it, and never copy rows from it into a checked-in fixture.

`*.csv` is git-ignored everywhere; `.gitignore` re-includes only
`fixtures/strong-sample.csv`. Add any new synthetic fixture to that exception
on purpose, one file at a time.
