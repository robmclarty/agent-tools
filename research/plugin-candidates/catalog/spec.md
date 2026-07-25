# `catalog` — skill-sprawl and context-budget hygiene

_Spec seed, 2026-07-24. Candidate 10 of 10 from [`../../plugin-roadmap-survey.md`](../../plugin-roadmap-survey.md)._

## Problem

Skills you cannot see do not exist, and past a token budget Claude Code stops showing them —
silently.

> Skills beyond the 30-skill display limit are completely undiscoverable by Claude. The
> `<available_skills>` section shows "Showing 30 of 39 skills due to token limits" — but
> those 9 truncated skills might as well not exist... **The truncation algorithm punishes
> good documentation practices.**

Open from Dec 2025 (issue #13343) through at least May 2026 (#60560, reporting 175
descriptions dropped). Related open issues: #56710, #56966, #57599, #64606, #65293.

Current local exposure: **93 project `SKILL.md` files**, 18 user-level skills, 20 installed
plugins. The composition problem compounds it — skills cannot invoke skills, so shared steps
get copy-pasted, which is the same force driving [`../drift/spec.md`](../drift/spec.md).

And cross-contamination is real at this scale:

> Every time I opened a Swift project, pdf2anki's LLM pipeline skills appeared in Discovery.
> In Python projects, Swift Actor patterns showed up. Wasting Character Budget.

## Why this one — and why it is ranked last

**For:** it is measurable now. `claude plugin details` reports per-plugin always-on vs
on-invoke token cost via the `count_tokens` API, and since v2.1.143 users see that number in
the install dialog. Anthropic has shipped a "Not used recently" grouping (v2.1.187, for
plugins unused ≥2 weeks across ≥10 sessions) and `/doctor` now sweeps for dead plugins,
unused skills, bloated CLAUDE.md, and slow hooks — the platform treats plugin rot as a
first-class health problem.

**Against:** that same list is the argument for *not* building this. Anthropic is actively
shipping into this space, so anything built here risks being obsoleted in a release. And the
adjacent category — token/cost optimization — is saturated at 165 plugins.

Ranked tenth deliberately. Included because the local exposure is real and the differentiator
is narrow but genuine: existing plugins compress *conversation* tokens; nothing audits *your
own catalog* for truncation risk, cross-project contamination, and dead skills.

## Shape

Small. This should be one skill and one script, not a system.

```
skills/catalog/SKILL.md
scripts/audit.mjs
```

### What the script measures

- Every skill visible in the current context: user-level, project, and plugin-provided
- Description length per skill, against the **1,536-character** truncation on combined
  `description` + `when_to_use`
- Total listing budget consumed, and **how close to truncation** — the single number that
  matters
- Skills with `disable-model-invocation: true` (which cost listing budget differently)
- Skills that have not fired in N sessions
- Skills whose descriptions overlap enough that the model will pick between them badly
- Project skills leaking into unrelated projects

### What the skill recommends

Concrete edits, in descending value: descriptions to shorten (with rewrites), skills to
disable per-project, near-duplicates to merge, dead skills to delete, and plugins whose
always-on cost is not earning its place.

There is a known cleanup backlog to validate against on day one: 13 stale `pb-*` /
`plumbbob-*` skills in `_minga/projects/lodestar/` that duplicate the shipped plumbbob
plugin, `code-diary`'s `commit-til` (superseded by `commit-with-til`), an empty
`~/.claude/skills/datum/`, a stale `~/.claude/skills/version.zip`, and `spec-to-ridgeline`
duplicated between `~/.claude/skills/` and `ridgeline/code/ridgeline/.claude/skills/`. If the
audit does not surface all six, it is not working.

## Open questions

1. **Can a skill actually observe the truncation state?** If the budget calculation is not
   exposed, this has to reimplement it from the documented rules — which will drift out of
   sync with the harness. This is the gating feasibility question.
2. How much does `/doctor` already cover as of v2.1.219? **Run it first.** If it covers most
   of this, the candidate drops to a documentation note.
3. Overlap with [`../drift/spec.md`](../drift/spec.md) — that one finds *divergent* copies,
   this finds *too many*. Same scan, different verdicts. Plausibly one plugin with two verbs,
   and that is probably the right call if both survive.
4. Is per-project skill scoping even controllable, or is the answer just "delete things"?

## Non-goals for v1

Conversation-token compression (saturated). Rewriting skills automatically. Anything that
duplicates `/doctor`. A leaderboard of plugin costs.

## Prior art to mine

`claude plugin details` output for the three plugins in this catalog — establishes the
measurement baseline and, incidentally, tells you what `version` and `commit-with-til`
actually cost users. Both set `disable-model-invocation: true`, which is already the right
instinct; this plugin generalizes it.
