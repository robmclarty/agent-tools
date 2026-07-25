# `decisions` — durable capture of the *why*

_Spec seed, 2026-07-24. Candidate 6 of 10 from [`../../plugin-roadmap-survey.md`](../../plugin-roadmap-survey.md).
Working name; `why` is the punchier alternative._

## Problem

The reasoning behind agent-written code dies in the prompt that produced it. The code
survives; the constraint that shaped it does not.

Two failure modes, both documented:

> The auth middleware was written three different ways in three different places, all
> slightly different, all working... **The AI didn't write bad code. It wrote code that
> nobody understood, and the code was good enough that nobody had a reason to understand
> it.** That's a different kind of risk than a bug.

And the refactor signal disappearing:

> The old signal was simple: working with a module became painful, so you'd fix it. **With
> Claude that pain comes much later.** It understands the code even when you no longer hold
> the full picture in your head... But it won't tell you it's time to refactor. So
> MVP-quality solutions get dragged deep into production.

For a solo developer there is no second person who will ask "why is this like this?" — so
the question never gets asked until it is expensive.

## Why this one

**The delivery mechanism already ships in this catalog.** `commit-with-til` extracts `TIL:`
lines from commit messages for code-diary to parse. Decision capture is the same shape with
a different extraction target and a different destination. That is a small delta on proven
infrastructure, not a new system.

**Nothing has won this space.** Everyone reinvents it — `context.md`, `architecture.md`,
GitHub Issues as an agent scratchpad, handoff markdowns, ADR-ish notes. `docs/decisions/`
already exists in 4 repos here, so the convention is half-adopted locally and inconsistent.

## Shape

```
skills/decide/SKILL.md          # record one decision explicitly
hooks/hooks.json                # detect decision moments, offer to record
scripts/record.mjs              # write the artifact deterministically
templates/decisions.example.jsonc
```

### The hard part is the trigger, not the format

ADR formats are a solved problem. The reason `docs/decisions/` has 4 adopters and not 60 is
that recording a decision requires remembering to, at the exact moment you are busy doing
the thing. And the research is blunt that self-authored skills do not fire on their own:

> Way more often than not, I remind the agent that the skill exists before it does
> anything. **It's very rare that it will pick a skill unprompted.**

So the trigger should be a hook, not a skill invocation. Candidate signals:

- A `PostToolUse` edit that reverses a recent edit to the same region — you tried something
  and backed it out; *why* is exactly what will be lost.
- A user message that overrides a proposed approach ("no, do it the other way").
- A `Stop` hook that looks back over the turn and asks whether a durable choice was made.

`type: "prompt"` hooks are the right tool here — a single-turn LLM evaluation returning a
decision, no script, no dependencies. The bar for firing must be high: a tool that offers to
record a decision every third edit gets disabled within a day.

### Format

Match what already exists in the 4 repos rather than inventing a house ADR. Minimum viable
entry: what was decided, what was rejected, the constraint that forced it, and a link to the
commit. Everything else is optional.

### Config — `.claude/decisions.json`

- `path` — `docs/decisions/` vs a single `docs/decisions.md`
- `format` — numbered ADR files vs dated append-only log
- `triggers` — which detectors are enabled, and their sensitivity
- `commit_integration` — whether to also emit a trailer line for `commit-with-til` to carry

## Open questions

1. **Is this better as an extension to `commit-with-til` than a separate plugin?** A
   `WHY:` trailer alongside `TIL:` reuses the entire pipeline and adds one skill section.
   That may be the whole feature, and a much smaller build. Investigate first — it could
   collapse this candidate into a half-day change.
2. What is the actual read path? A decision log nobody reads is worse than nothing because
   it costs attention to maintain. `orient` ([`../orient/spec.md`](../orient/spec.md)) is
   the obvious consumer; there should be at least one more before this justifies itself.
3. Does the friction-lesson loop in the foundry family already cover part of this?
   `docs/lessons.md` captures *corrections*; this captures *choices*. Related but distinct —
   worth checking whether one store should hold both.
4. False-positive tolerance is the whole design. Better to miss decisions than to nag.

## Non-goals for v1

A queryable decision database. Enforcing ADR discipline. Retroactively mining decisions from
git history (interesting, but a separate and much harder problem — and `orient` covers the
reconstruction case at lower fidelity).

## Prior art to mine

`plugins/commit-with-til/` in this repo — the extraction and never-stage-filter pipeline is
directly reusable. The `docs/decisions/` directories in the 4 repos that have them, as the
format this must not fight. `ridgeline/docs/plans/` for the heavier end of the same need.
