# `fleet` — portfolio status and fan-out across many repos

_Spec seed, 2026-07-24. Candidate 2 of 10 from [`../../plugin-roadmap-survey.md`](../../plugin-roadmap-survey.md)._

## Problem

Sixty repos, one person, no view of the whole. The questions that have no answer today:

- Which repos have uncommitted work I forgot about?
- Which have a red gate?
- Which are still on a bespoke `/version` skill instead of `version.json`? (**31 of them**,
  against 2 migrated.)
- Which have drifted copies of a skill I improved somewhere else?
- Which have gone quiet — and were they finished, or abandoned mid-thought?
- What should I touch next?

## Why this one

It is the clearest unserved need in the entire ecosystem research. Nothing exists. The
community threads asking for it get answered with "kanban board", "notepad", and — from one
respondent, literally — "I put literal plates spinning on color coded rods in my office."
One person described building a dashboard for it and concluded *"that became another
project to manage."*

It is also the vehicle that finishes work already planned: the 31-repo `/version` migration
in [`../../version-plugin-design.md`](../../version-plugin-design.md) is currently specified as
"migrate as each repo next needs a release," which after five weeks has moved 2 repos. As a
fan-out operation it is one afternoon.

## Shape

This one wants a real CLI, not a skill wrapping shell one-liners. Plugin `bin/` executables
land on the Bash tool's `PATH` and are callable as bare commands — no `${CLAUDE_PLUGIN_ROOT}`
gymnastics, no permission-rule path matching.

```
bin/fleet                      # the scanner + fan-out runner
skills/fleet/SKILL.md          # interpretation and next-action reasoning
templates/fleet.example.jsonc
```

State lives in `${CLAUDE_PLUGIN_DATA}` — a per-plugin directory that survives plugin
updates and is deleted only on uninstall. That is the correct home for a scan index that
should not be rebuilt from scratch every invocation.

### Two verbs

**`fleet status`** — scan, cache, report. Per repo: last commit date, dirty/clean, ahead or
behind remote, gate state (read `.check/summary.json` — see [`../check/spec.md`](../check/spec.md)),
version-migration state (`.claude/version.json` present?), skill inventory hash (feeds
[`../drift/spec.md`](../drift/spec.md)), open TODO count.

Emits a JSON contract; the skill turns it into a ranked "what deserves attention" read
rather than a wall of rows. The interpretation is the product — a table of 60 repos is the
dashboard that becomes another project to manage.

**`fleet run <command> [--filter <predicate>]`** — fan out across matching repos. The
motivating case is `/version init`, but the general shape covers dependency bumps, config
migrations, and convention rollouts.

Fan-out demands care:

- **Dry-run by default.** `--apply` to actually write.
- **Per-repo isolation.** Subagents support `isolation: worktree`, and worktree Bash
  containment has been hardened (v2.1.203/210/216) so a subagent cannot redirect git back
  into the main checkout. Note the cost: ~200–500ms setup plus disk per agent.
- **Never auto-commit across repos.** Leave changes in the working tree; the human reviews
  and commits. A batch operation that commits to 31 repos unattended is the failure mode
  this plugin should be most afraid of.
- **Report what was skipped.** Silent truncation reads as "covered everything."

### Config — `.claude/fleet.json` (user-level, not per-repo)

This is the one plugin in the set whose config is global rather than per-repo:

- `roots` — where to scan (`~/Projects`), with the nesting quirk that many repos live a
  level deeper (`<proj>/code/<name>/`)
- `exclude` — `_archive`, `_archive2`, worktrees, stryker sandboxes, `node_modules`
- `stale_after` — what counts as dormant
- `signals` — which per-repo probes to run

## Open questions

1. **How much does this overlap with `claude agents` / the agent view?** That covers
   sessions; this covers repos. Adjacent but not the same — worth confirming before
   building.
2. Does the scan need to be incremental? Sixty repos × several git calls each is not free.
   Cache in `${CLAUDE_PLUGIN_DATA}`, invalidate on git dir mtime.
3. Is fan-out actually better than a shell loop plus `/version init` per repo? The honest
   answer may be "no, for a one-time migration" — in which case the value is concentrated
   in `status`, and `run` is a v2 question.
4. **Would this generalize to anyone else?** No primary source in the research describes
   operating at this scale; the largest concrete cases were "six repos" and "a dozen
   sessions." Build it for the one confirmed user.

## Non-goals for v1

Session tracking. Anything resembling a TUI or persistent dashboard. Cross-repo dependency
graphing ("which projects duplicate each other") — genuinely wanted, but a much harder
problem and a separate spec. Auto-committing anything.

## Prior art to mine

The local survey that produced [`../../plugin-roadmap-survey.md`](../../plugin-roadmap-survey.md)
is essentially `fleet status` run by hand — the frequency tables, mtime rankings, and
config-presence probes in it are the v1 output spec.
