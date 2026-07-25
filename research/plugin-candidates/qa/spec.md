# `qa` — test quality, generalized out of storium

_Spec seed, 2026-07-24. Candidate 9 of 10 from [`../../plugin-roadmap-survey.md`](../../plugin-roadmap-survey.md)._

## Problem

Coverage is not quality, and with agent-written tests the gap widens: the same agent that
wrote the code wrote the tests, so the tests encode the same misunderstanding. The community
articulation:

> The code passed every check... Tests covered 78% of branches. On paper, it was fine. Then
> I spent a week actually reading it.

There is exactly one body of tooling on this machine that addresses it, and it is trapped in
one repo. `storium/.claude/skills/` holds **8 `qa-*` skills**: snapshot, analyze, fragile,
health, make-tests, review, test-id, trace — built on fallow, knip, dependency-cruiser, and
ast-grep.

## Why this one

**The substrate is already portfolio-wide.** vitest in ~48 `package.json`, `@ast-grep/cli`
in ~20, `lint:fallow` in 12, `lint:knip` in 8, `@stryker-mutator/core` in 6. The 8 skills
were written against tools that are already installed nearly everywhere. This is the
clearest "not yet duplicated, but obviously portable" case in the survey.

**Market:** flaky-test detection is a 10-plugin category and testing generally is thin
(127, contested but not saturated). The saturated neighbour is code review (97 + first-party
at 422K installs) — but reviewing *test quality* specifically, with mutation testing as
ground truth, is not what those do.

**Mutation testing is the honest signal.** Stryker is already in 6 repos. A test suite that
passes while mutants survive is measurably not testing anything, and that is a fact, not a
model's opinion — which matters given the documented noise floor of AI reviewers:

> It will *always* find about 8 issues. The number doesn't change, but it gets a bit...
> weird if it can't really find a defect... When a tool flags 8 issues on clean code and 8
> issues on broken code, it's not a reviewer, it's a random number generator with a UI.

Grounding findings in surviving mutants and dead-code analysis rather than model judgment is
the way to stay out of that trap.

## Shape

```
skills/qa-health/SKILL.md       # portfolio/suite-level read
skills/qa-fragile/SKILL.md      # find tests that will break for the wrong reasons
skills/qa-review/SKILL.md       # review a specific test file or diff
scripts/analyze.mjs             # deterministic: mutants, dead code, test/source mapping
templates/qa.example.jsonc
```

Fewer skills than storium's eight. Eight skills in one plugin is a context-budget problem
(see [`../catalog/spec.md`](../catalog/spec.md)) and several of storium's are probably
project-specific rather than general. The consolidation is part of the work: read all eight,
keep what generalizes.

### Grounding, in priority order

1. **Surviving mutants** (stryker) — the strongest signal; a specific line no test detects.
2. **Dead code** (knip, fallow) — code no test and no caller reaches.
3. **Test/source structural mapping** (dependency-cruiser, ast-grep) — which source has no
   corresponding test, and which tests assert on implementation detail rather than behaviour.
4. **Model judgment** — last, and only on top of the above.

### Config — `.claude/qa.json`

- `runner` — vitest (universally, but do not hardcode)
- `mutation` — stryker config path, or off (only 6 repos have it)
- `dead_code` — knip / fallow availability flags
- `test_placement` — colocated vs `__tests__/` (the same variance `scaffold` handles)
- `thresholds` — what mutation score is worth flagging

## Open questions

1. **Are the 8 storium skills actually good, or just present?** They have never run
   anywhere else. Read them before committing; the survey found them by name, not by
   quality assessment.
2. Mutation testing is slow. Full-suite stryker on every invocation is a non-starter —
   incremental (mutate only the diff) is likely the only viable mode.
3. Does this belong inside [`../check/spec.md`](../check/spec.md) instead? `.check/mutation.json`
   already exists in the checkride artifact set. Strong argument that `qa` is a *deeper read*
   of the same artifacts rather than a separate plugin — which would make it a second skill
   in `check` rather than a tenth plugin.
4. `make-tests` (generation) is a different job from the rest (assessment). Probably do not
   ship both in one plugin; generation is closer to saturated territory.

## Non-goals for v1

Writing tests. Coverage reporting (vitest does it). Competing with code review. Anything
that produces a fixed-size list of findings regardless of input — that is the failure mode
this plugin exists to avoid.

## Prior art to mine

`storium/.claude/skills/qa-*` — all eight, read before designing. `.check/mutation.json` and
`.check/dead.json` in the checkride artifact set. The stryker configs in checkride, fascicle,
weft, plumbbob, ridgeline, and ts-check-scaffold.
