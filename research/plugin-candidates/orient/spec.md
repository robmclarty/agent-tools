# `orient` — reawaken a dormant repo

_Spec seed, 2026-07-24. Candidate 5 of 10 from [`../../plugin-roadmap-survey.md`](../../plugin-roadmap-survey.md)._

## Problem

You open a repo you have not touched since April. The code works. You have no idea what you
were in the middle of, why the architecture is shaped that way, or what the next move was.

This is a real and current state here, not a hypothetical: `foundry`, `gantry`, `trailhead`,
and `ridgeline-mk2` have been dormant since April–June; `storium` (385 commits) since June;
`trellis` (140 commits) since late June. Their skills are frozen, which is precisely why
they drifted rather than converged.

The underlying cause is documented in the pain-point research and is not a memory problem —
it is that the reasoning never landed anywhere durable:

> Claude makes decisions fast. Sometimes *too* fast... a week later I'm staring at the code
> wondering why we avoided the simpler option or why a certain constraint exists. And the
> answer is usually: "it came up in the prompt... somewhere." Chat history helps until it
> doesn't. **Git history is basically useless here. The reasoning lived in a prompt, not in
> the repo.**

## Why this one

Onboarding/codebase-comprehension is a thin category (24 plugins of 2,542), and it is
dominated by MCP servers doing semantic code search (Greptile, Sourcegraph, Serena). Almost
nothing operates at the skill level, and nothing addresses the specific case of
*re-onboarding yourself* to your own stale project — which is a different problem from
onboarding a stranger to a large codebase. You do not need the code explained. You need to
know where you stopped and why.

Pairs directly with [`../decisions/spec.md`](../decisions/spec.md): `decisions` captures the
rationale going forward, `orient` reconstructs what it can from repos where nobody was
capturing it.

## Shape

```
skills/orient/SKILL.md
scripts/gather.mjs              # collect evidence, emit contract
```

Probably no config for v1 — the inputs are conventional enough to discover.

### Evidence the script gathers

- **Git**: last commit date and message, commit cadence over the final month before it went
  quiet, branches not merged, stashes, uncommitted work
- **Gate**: `.check/summary.json` if present (see [`../check/spec.md`](../check/spec.md)) —
  was it green when abandoned, or did it stop *because* it went red?
- **Conventions**: `docs/lessons.md`, `docs/conventions.md` (5 repos), `docs/decisions/`
  (4 repos), `BACKLOG.md`, `ROADMAP.md`, `docs/plans/`
- **Intent**: TODO/FIXME density and location, especially clustered ones
- **Version state**: last release vs commits since — was it mid-release?
- **Claude context**: `CLAUDE.md`, `.claude/skills/`, and the per-project memory directory

### Output

Not a summary of the codebase. A **brief**, in this order:

1. Where you stopped — the last thing in flight, with evidence
2. Why it stopped, if inferable — red gate, blocked on a decision, or just went quiet
3. What was being avoided or deferred — from lessons, TODOs, and decision docs
4. What is stale now — dependencies, drifted skills, an old `/version` skill
5. The two or three plausible next actions

Point 2 is the differentiator and the risky one. "It went quiet after a failing mutation
test" is genuinely useful; a confident invented narrative is worse than silence. The skill
must distinguish evidence from inference explicitly and say "no signal" when there is none.

## Open questions

1. **Does the per-project memory directory survive long enough to help?** Auto-memory
   shipped ~Feb 2026, so April-dormant repos may have some. Worth checking what is actually
   in `~/.claude/projects/<encoded-root>/memory/` for the dormant ones before designing
   around it.
2. How much of this is already covered by reading `CLAUDE.md` plus `git log`? The honest
   test: run it by hand on `foundry` and see whether the output beats five minutes of manual
   poking. If it does not, this candidate drops.
3. Should it write its findings back as a durable artifact (`docs/state.md`), or stay
   ephemeral? Writing risks another rotting file. Ephemeral risks redoing the work next time.
4. Overlaps with [`../fleet/spec.md`](../fleet/spec.md) — `fleet status` says *which* repos
   are dormant; `orient` goes deep on one. Possibly one plugin, two altitudes.

## Non-goals for v1

Explaining the codebase (that is what the model already does well, and what the MCP servers
in this category do). Fixing anything. Any cross-repo view — that is `fleet`.

## Prior art to mine

`ridgeline/code/ridgeline/BACKLOG.md` and `ridgeline/docs/plans/` — the richest example of
intent actually written down; a good test case for whether the brief adds anything over just
reading them. `fascicle/code/fascicle/docs/roadmap.md`. The `docs/lessons.md` corpus in the
foundry family.
