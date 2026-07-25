# `ast-grep-rules` — the adaptive structural-lint loop

_Spec seed, 2026-07-24. Candidate 4 of 10 from [`../../plugin-roadmap-survey.md`](../../plugin-roadmap-survey.md)._

## Problem

Four repos carry a three-skill loop that turns recurring friction into enforced structural
lint rules:

1. **`post-friction-lesson`** — after a correction, append the lesson to `docs/lessons.md`.
2. **`mine-ast-grep-rules`** — cluster accumulated lessons, find the ones that recur.
3. **`propose-ast-grep-rule`** — promote a cluster to a real `tools/ast-grep/rules/*.yml`.

It is a genuinely good mechanism: the agent's mistakes become machine-enforced conventions
instead of prose nobody rereads. It is trapped in four repos, three of which are dormant.

## Why this one

**Lowest design risk in the set.** `mine-ast-grep-rules` is byte-identical across all four
repos — 77 lines, zero drift. `post-friction-lesson` is identical in three. There is almost
nothing to reconcile.

**Reach far exceeds the four.** `@ast-grep/cli` appears in ~20 repos and there are **25
`sgconfig.yml` files** on the machine. The loop is deployed in 4; the substrate is in 25.

**Market:** structural lint is essentially unrepresented. The saturated categories are
security scanning (188) and generic "optimizer" agents (193); adaptive, project-specific
structural rules mined from your own correction history is not a thing anyone ships.

It also carries a live drift case worth fixing on the way in: `propose-ast-grep-rule` is
111 lines in three repos, but **gantry has a better 97-line version** that replaced the
hand-written YAML skeleton with `pnpm scaffold:ast-grep-rule <kebab-id>`. Generalize from
gantry, not from the majority.

## Shape

```
skills/post-friction-lesson/SKILL.md
skills/mine-lessons/SKILL.md
skills/propose-rule/SKILL.md
scripts/mine.mjs                    # clustering — deterministic, not model work
templates/ast-grep.example.jsonc
```

The clustering step is currently model work and probably should not be. Grouping lesson
entries by similarity, counting recurrences, and ranking by frequency × recency is
mechanical. Let the script emit candidate clusters with evidence; let the model judge which
clusters are actually expressible as an AST pattern — that part is real judgment, since
plenty of good lessons ("this API is confusing") have no structural form.

### Config — `.claude/ast-grep.json`

The variance across the four repos is genuinely tiny:

- `lessons_path` — `docs/lessons.md`
- `conventions_path` — `docs/conventions.md` (present in 5 repos)
- `rules_dir` — `tools/ast-grep/rules/` vs `rules/`
- `scaffold_command` — `pnpm scaffold:ast-grep-rule` if available, else write YAML directly
  (this is the gantry improvement; make it a capability flag, not a fork)
- `sgconfig` — path to `sgconfig.yml`

## Primitives worth using

- **`paths:` glob-gated skill activation.** `post-friction-lesson` should be available when
  editing source, not when editing docs. Costs nothing when irrelevant.
- **`PostToolUse` hook** as the friction trigger. Today the lesson gets recorded only if
  you remember to invoke the skill — and the research is blunt that self-authored skills
  rarely fire unprompted: *"It's very rare that it will pick a skill unprompted... It's just
  silent failure."* A hook that notices a correction pattern and offers to record it closes
  the loop that currently depends on discipline.
- **`type: "prompt"` hook** for that detection — an LLM gate with no script, no
  dependencies, and no cross-platform shell problems. The ecosystem uses `type: "command"`
  almost exclusively; this is a good first use of the alternative.

## Open questions

1. **Is the loop actually working in the four repos, or did it stall?** Check the git
   history of `docs/lessons.md` and `tools/ast-grep/rules/` — how many rules were actually
   promoted, and when? If the answer is "two rules in April," the mechanism needs rethinking
   before it gets packaged, and the honest finding is that the loop is aspirational.
2. Is `docs/lessons.md` the right store? It is append-only prose in 4 repos. A structured
   format would make mining deterministic, but prose is what actually gets written.
3. Should rules be shareable across repos, or are they inherently project-specific? Some
   ("never use `git -C` in a skill's Bash block") are universal. That points at a bundled
   starter ruleset plus per-repo mined rules.
4. ast-grep is TypeScript-shaped here. Fine — the whole portfolio is TS. Worth stating as a
   deliberate scope limit rather than pretending otherwise.

## Non-goals for v1

Replacing oxlint. A rule *library* — the value is that rules are mined from this specific
project's friction, not curated from someone else's best practices. Auto-enforcing newly
mined rules without review.

## Prior art to mine

`gantry/code/gantry/.claude/skills/propose-ast-grep-rule/SKILL.md` (the better variant —
generalize from this one), `foundry/code/foundry/.claude/skills/mine-ast-grep-rules/SKILL.md`
(byte-identical across four, so any copy works), and the `docs/lessons.md` +
`docs/conventions.md` files in the four repos as the corpus this must actually handle.
