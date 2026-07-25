# `drift` — detect and reconcile divergent skills and conventions

_Spec seed, 2026-07-24. Candidate 3 of 10 from [`../../plugin-roadmap-survey.md`](../../plugin-roadmap-survey.md)._

## Problem

You write one good skill, copy it forward, and the artifact meant to enforce consistency
becomes the source of inconsistency. This is the documented failure mode for one-person
many-repo shops, and it is measurable here right now:

- **31 bespoke `/version` skills** across three generations, against 2 migrated repos.
- The `foundry` / `gantry` / `trailhead` / `ridgeline-mk2` cluster shares a scaffold
  lineage and has drifted four ways.
- `mine-ast-grep-rules` is **byte-identical** across all four (77 lines) — zero drift.
- `post-friction-lesson` is identical in three; ridgeline-mk2 is +2 lines.
- `propose-ast-grep-rule` is identical in three at 111 lines — and **gantry holds a
  strictly better 97-line version** that replaced the hand-written YAML skeleton with a
  `pnpm scaffold:ast-grep-rule <kebab-id>` call. That improvement has been stranded in one
  dormant repo since April.
- `add-package` has 4 distinct hashes whose diffs are purely cosmetic.

The gantry case is the one that matters. Drift detection is not only about finding stale
copies — it is about finding the copy that got *better* and nobody noticed.

## Why this one

The ecosystem answer today is a paid native desktop app, launched July 2026 by a solo dev
who hit exactly this wall at six repos. There is no CLI and no git-native option. The
underlying platform gap — no memory/convention scope between "global" and "one git root" —
is an open Claude Code issue (#39195, filed 26 Mar 2026), and the request keeps being
refiled and folded rather than shipped.

This plugin is also the general case of the specific thing this marketplace already does
twice. `version` and `commit-with-til` each resolved one drift family by hand. This finds
the next ones automatically.

## Shape

```
bin/drift                      # scan + diff engine
skills/drift/SKILL.md          # adjudication: which copy is canonical, what to do
templates/drift.example.jsonc
```

### Detection

Scan the configured roots for `.claude/skills/*/SKILL.md`, `.claude/settings*.json`,
`CLAUDE.md`, and any path patterns in config. Group by name and near-synonym, hash each,
and cluster.

The output that matters is not "these differ" but **which direction the difference runs**:

```
{ family: 'propose-ast-grep-rule',
  copies: [
    { repo, path, hash, lines, mtime, last_commit },
    ...
  ],
  clusters: [ { hash, repos: [...], count } ],
  divergence: 'improvement_stranded' | 'cosmetic' | 'genuine_variance' | 'identical',
  suspected_canonical: { repo, reason } }
```

`divergence` is the hard part and the reason this needs a model, not just a diff. The
engine can compute clusters, line counts, and recency; classifying a diff as *cosmetic*
(tsconfig base path) versus *an improvement worth propagating* (gantry's scaffold call)
versus *legitimate per-repo variance* (a repo with no remote genuinely should not push
tags) is judgment. Engine emits the evidence; skill adjudicates.

### Reconciliation

Three outcomes per family, and the skill should propose one:

1. **Promote to a plugin** — the `version` / `commit-with-til` path. Right when the
   variance reduces to a small config schema. The survey doc for `/version` derived exactly
   five variance dimensions; that derivation is the template.
2. **Sync from canonical** — right when the drift is accidental and one copy is simply
   newer or better. Write the winner outward; leave changes uncommitted per repo.
3. **Leave alone** — right when variance is real. Record *why* so the next scan does not
   re-flag it. This matters: a drift tool that cries wolf gets ignored, and the whole value
   is in being trusted enough to act on.

Outcome 3 needs somewhere to persist the verdict. A `.claude/drift-exempt.json` per repo,
or a central ledger in `${CLAUDE_PLUGIN_DATA}`.

## Open questions

1. **Where does the canonical copy live once identified?** This plugin finds drift; it does
   not solve the absence of a subset-scope. Options: promote to a plugin (heavyweight, only
   worth it for stable families), a shared repo pulled by a `SessionStart` hook, or just
   report and let the human decide. Start with report-only.
2. Name-matching is weak. `commit` vs `commit-til` vs `commit-with-til` are the same family;
   `check` in trellis (a 5-line npm wrapper) and `build-check` in ridgeline are not. Content
   similarity may beat name matching, but it is slower and fuzzier.
3. Does this subsume [`../catalog/spec.md`](../catalog/spec.md)? Overlapping — that one is
   about *too many* skills, this is about *divergent* ones. Possibly one plugin, two verbs.
4. Should it watch, or run on demand? A `SessionStart` hook that flags "this repo's version
   skill is 3 generations behind" is more useful than a scan you have to remember to run —
   but it is also a startup cost on every session.

## Non-goals for v1

Auto-syncing without review. Anything that writes to more than one repo per invocation.
Solving the platform's missing subset-memory scope — this reports on the symptom.

## Prior art to mine

[`../../version-skills-survey.md`](../../version-skills-survey.md) is a hand-run instance of
exactly this plugin's output: three-generation clustering, per-repo variance table, and the
reduction to five config dimensions. If `drift` can produce that document automatically for
the next family, it works.
