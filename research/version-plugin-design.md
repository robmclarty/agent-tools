# Design: portable `/version` plugin

_2026-07-19. Design for a single installable `/version` plugin that replaces the ~12
bespoke per-repo skills. Companion to [version-skills-survey.md](version-skills-survey.md),
which derives the requirements empirically from the existing skills._

_**Superseded in part, 2026-11-01:** [`specs/version-v2.md`](specs/version-v2.md) revises
the architecture (a plan/finish/push split, config v2, prereleases, voice from hand-owned
exemplars) and moves the plugin into `jig`. Where the two disagree, v2 wins; the "Scope
decisions" below (lockstep only, no prereleases) no longer hold._

## Goal

One plugin, installed from this marketplace, that works in any repo — npm single-package,
lockstep monorepo, Odin project with a version constant, marketplace catalog — by
generalizing the gen-3 architecture (ridgeline/fascicle/weft) instead of inventing a new
one. Capture every hard-won behavior from the survey; push all repo-to-repo variance into
a small per-repo config; keep an escape hatch for repos too weird to be declarative.

## Architecture: three layers

### Layer 1 — the skill (invariant, ships with plugin)

Essentially ridgeline/weft's SKILL.md with the repo-specific constants replaced by reads
from the engine's JSON output + the repo config. The model's job is unchanged from gen 3:

- validate arguments (`major|minor|patch`, plus `--repair-skew`), fail fast otherwise
- branch on the preflight JSON (`bump` / `repair-skew` / `error` with typed error handling)
- fetch the commit range from `since`, draft the changelog section in the
  config-selected format, print it verbatim before writing
- run the config's verify command; on failure, roll back exactly and stop
- stage exactly the changed files, commit/tag/push per config, report

Preflight block runs the engine before the model reasons:

```
- Bump result: !`node ${CLAUDE_PLUGIN_ROOT}/scripts/bump.mjs $ARGUMENTS`
```

The engine reads config from the cwd, so the same preflight line works in every repo.
All the survey's "hard-won behaviors" (exit-code discipline, never recompute the version,
print-before-write, narrow verify + rollback, stage-exactly, tag/push error handling,
BREAKING warning, permission-pattern discipline) carry over verbatim.

### Layer 2 — the engine (`scripts/bump.mjs`, ships with plugin)

A single zero-dependency Node script — Node is always present on any machine running
Claude Code, even for Odin projects, and JSON/regex surgery in bash+sed is where
determinism dies. It is the union of the three gen-3 scripts, made config-driven:

- ridgeline's JSON contract and exit-code discipline (exit 0 on expected failure so the
  preflight doesn't swallow stdout; exit 2 only on crashes)
- fascicle's tag-first `since` detection with commit-message fallback
- weft's lockstep discovery, skew preflight, and `--repair-skew` mode

Responsibilities, in order: clean-tree check → resolve targets from config (static +
discovered) → skew check across the resolved set → read current version from the
authoritative target → compute new semver → rewrite every target (preserving JSON
indent/trailing-newline, keying regex rewrites on the exact configured literal, failing
loudly on a file that opted in but doesn't match) → find `since` per the marker config →
emit the JSON.

Contract (superset of gen 3):

```
{ mode: 'bump',        old, new, since, files: [{rel, kind, changed}], changed_count }
{ mode: 'repair-skew', old, new,        files: [...], changed_count }
{ mode: 'error',       error_type: 'dirty_tree'|'skew'|'usage'|'config'|'runtime', message }
```

New `error_type: 'config'` covers a missing/invalid `.claude/version.json` — the message
tells the user to run `/version init`.

### Layer 3 — per-repo config (`.claude/version.json`)

The five variance dimensions from the survey, and nothing more:

```jsonc
{
  // 1. Where versions live. First target is authoritative (read from);
  //    the rest are force-written (plumbbob-style self-healing).
  "targets": [
    { "type": "json",  "path": "package.json", "key": "version" },
    { "type": "json",  "path": ".claude-plugin/plugin.json", "key": "version" },
    { "type": "regex", "path": "src/main.odin", "match": "VERSION :: \"{semver}\"" }
  ],
  // Discovered lockstep sets (weft). Optional.
  "discover": [
    { "glob": "packages/*/package.json", "type": "json", "key": "version" },
    { "glob": "packages/*/src/version.ts", "type": "regex",
      "match": "export const version = '{semver}';", "optIn": true }
  ],
  // 2. Release marker — drives both the release commit and finding `since`.
  "marker": {
    "commit": "v{version}",            // or "chore: release {version}"
    "tag": true,                        // annotated vX.Y.Z tag
    "tagAuthoritative": false,          // fascicle: tag-first since-detection
    "legacy": ["chore: bump version to {version}"]
  },
  // 3. Changelog.
  "changelog": {
    "path": "CHANGELOG.md",
    "style": "sections",                // "sections" | "keep-a-changelog" | "flat"
    "linkRef": null                     // e.g. "https://www.npmjs.com/package/checkride/v/{version}"
  },
  // 4. Narrow verify. null = none (record why in notes).
  "verify": "npm run lint:markdown",
  // 5. Publish behavior.
  "publish": {
    "pushTag": true,
    "pushBranch": false,
    "confirm": false                    // true when a push triggers external machinery (CI publish)
  }
}
```

**Repo-local prose notes:** anything that can't be declarative — plumbbob's CI
approval-gate narrative ("the Publish workflow pauses at the npm-publish environment;
approve it in the Actions tab"), volley's "no verify needed because…" reasoning — lives
in an optional `.claude/version.md`. The skill reads it if present and folds it into its
reporting/confirmation steps. This is what lets one skill absorb each repo's "unique
characteristics" without forking.

**Escape hatch — the driver contract:** a repo too weird for declarative targets sets
`"driver": "./scripts/bump-driver.mjs"` in place of `targets`/`discover`. The driver
receives the new version as argv[1], rewrites whatever it needs, prints changed file
paths (one per line), exits non-zero on failure. The plugin engine still owns the
clean-tree check, semver math, `since` detection, and the JSON contract; the driver owns
only the bespoke file surgery. A repo can be arbitrarily strange without forking the
skill or the engine.

## `/version init`

Where LLM judgment belongs: once per repo, at setup time. Init:

1. **Detects an existing bespoke skill first.** If `.claude/skills/version/SKILL.md`
   exists, extract its conventions — marker format, changelog style, verify command,
   tag/push behavior, legacy patterns — into config, and offer to retire the old skill.
   There are ~12 migration targets across the repos, spanning gen 1 → gen 3, which
   doubles as the validation suite for the config schema.
2. Otherwise sniffs the repo: package.json? workspaces/`packages/*`? marketplace.json?
   plugin.json? `*.odin` with a version constant? Existing `v*` tags vs. `vX.Y.Z`
   commits (marker inference)? Existing CHANGELOG heading style?
3. Proposes the config + any `.claude/version.md` notes, shows both, writes after
   approval.

## Everyday flow after setup

```
/version patch
  └─ preflight: bump.mjs runs → tree clean? skew? → rewrites targets → JSON
  └─ skill: drafts changelog from `since`..HEAD → prints it verbatim →
     writes CHANGELOG → verify → stage exactly → commit "v1.2.4" →
     tag + push per config → report
```

One deterministic script run, one LLM prose pass, one commit.

## Scope decisions

- **Lockstep only in v1.** Independently-versioned workspace packages are a genuinely
  different problem (per-package changelogs, dependency-range rewrites — changesets
  territory). None of the current repos need it; weft's lockstep covers the monorepo
  case that actually exists.
- **No auto bump-type inference from conventional commits in v1.** The BREAKING warning
  (survey item 12) stays; choosing the bump type remains the user's call.
- **Config lives at `.claude/version.json`**, riding with the repo so the plugin works
  the moment the repo is cloned.

## Where it lives

`plugins/version/` in this repo, with a relative-path marketplace source (see
[commit-with-til-plugin.md](commit-with-til-plugin.md) for the `plugins/` restructure):

```
plugins/version/
  .claude-plugin/plugin.json
  skills/version/SKILL.md         # invariant workflow; ${CLAUDE_PLUGIN_ROOT} paths
  scripts/bump.mjs                # config-driven engine, zero deps
  templates/version.json          # annotated starter config for /version init
```

## Build/validation plan

1. Build the engine + skill; dogfood on this repo (gen-1 marketplace skill → config
   migration: `metadata.version` json target, `v{version}` marker, flat changelog).
2. Validate the schema against the two hardest real cases: weft (discovery + skew +
   repair) and plumbbob (multi-file force-write + confirmation-gated CI publish via
   `.claude/version.md` notes).
3. Migrate the remaining repos with `/version init` as they next need a release.
