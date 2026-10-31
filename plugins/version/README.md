# version

A portable `/version` release skill for Claude Code. One plugin that cuts a
release — bump the version, summarize commits into a changelog section, commit
(and optionally tag/push) — in **any** repo, adapting to each via a small
per-repo config file. It replaces the bespoke, copy-pasted version skill that
otherwise accumulates in every project.

The design splits three concerns:

- **An invariant skill** (`skills/version/SKILL.md`) — the release workflow, the
  same everywhere. Drafts the changelog prose and runs git.
- **A deterministic engine** (`scripts/bump.mjs`, zero dependencies) — the
  dirty-tree check, target resolution, semver math, every version rewrite, and
  previous-release detection. Runs in the skill's preflight, before the model
  reasons, and emits a JSON contract the skill consumes.
- **A per-repo config** (`.claude/version.json`) — everything that differs from
  repo to repo. Generated once by `/version init`.

## Install

```shell
/plugin marketplace add robmclarty/agent-tools
/plugin install version@robmclarty
```

## Quick start

Once per repo, generate the config (it inspects the repo and, if you already
have a bespoke version skill, migrates its conventions):

```shell
/version init
```

Then cut releases:

```shell
/version patch     # 0.4.6 → 0.4.7
/version minor     # 0.4.6 → 0.5.0
/version major     # 0.4.6 → 1.0.0
```

Recover from version drift across files (realign every target to the
authoritative version without bumping; leaves changes uncommitted for review):

```shell
/version --repair-skew
```

## What a release does

1. The engine refuses a dirty tree (a release commit must contain only the bump
   + changelog), then rewrites every configured version target and reports the
   previous-release SHA.
2. The skill summarizes every commit since that SHA into a new changelog
   section, in the style your config selects, and prints it for you to see
   before it's written. If the changelog opens with an Unreleased section
   (`## Unreleased` or `## [Unreleased]`) that already holds entries, the skill
   promotes that section to the release instead, adding entries only for
   commits it doesn't cover.
3. It runs your narrow verify command (if any), stages exactly the changed
   files, commits with your marker convention, and tags/pushes per config.

## Configuration

`.claude/version.json` — see [`templates/version.example.jsonc`](templates/version.example.jsonc)
for a fully annotated reference. Only `targets` is required; every other section
has defaults.

| Key | Purpose |
|-----|---------|
| `targets[]` | Where versions live. The **first** entry is authoritative (read from); the rest are force-written each bump (self-healing skew). Each is a `json` target (dot-path `key`) or a `regex` target (a `match` literal with one `{semver}` placeholder). |
| `discover[]` | Glob rules whose matches join the target set — for lockstep monorepos. A discovered file that exists but doesn't match its pattern fails loudly. |
| `driver` | Escape hatch: a repo-local script that performs all writes for repos too bespoke to describe declaratively. The engine still owns semver math and release detection. |
| `marker` | Release-marker convention — the commit message (`commit`), whether to tag, whether tags are authoritative for finding the previous release, and any `legacy` patterns still in history. |
| `changelog` | `path`, `style` (`sections` \| `keep-a-changelog` \| `flat`), and an optional `linkRef` for keep-a-changelog link references. |
| `verify` | A narrow command run on the (version + changelog) diff before staging. `null` for none. |
| `publish` | `pushTag`, `pushBranch`, and `confirm` (ask first — set when a push triggers external machinery like a CI publish). |

Repo-specific workflow prose that can't be expressed declaratively (a CI
approval gate, why verify is intentionally skipped) goes in `.claude/version.md`;
the skill reads it automatically when present.

### Examples

Single npm package, bare `vX.Y.Z` commit marker, dated sectioned changelog:

```json
{
  "targets": [{ "type": "json", "path": "package.json", "key": "version" }],
  "marker": { "commit": "v{version}", "tag": true, "tagAuthoritative": true },
  "changelog": { "style": "sections" },
  "verify": "npm run lint:markdown",
  "publish": { "pushTag": true }
}
```

Lockstep monorepo (root + every package manifest + opt-in version constant):

```json
{
  "targets": [{ "type": "json", "path": "package.json", "key": "version" }],
  "discover": [
    { "glob": "packages/*/package.json", "type": "json", "key": "version" },
    { "glob": "packages/*/src/version.ts", "type": "regex", "match": "export const version = '{semver}';" }
  ],
  "marker": { "commit": "v{version}", "tag": true, "tagAuthoritative": true }
}
```

Non-JavaScript project (version in a source constant):

```json
{
  "targets": [{ "type": "regex", "path": "src/main.odin", "match": "VERSION :: \"{semver}\"" }],
  "marker": { "commit": "v{version}" },
  "changelog": { "style": "flat" }
}
```

## The engine, standalone

`scripts/bump.mjs` is usable on its own — it always prints one JSON object and
exits 0 even on expected failures (so a slash-command preflight never swallows
the error):

```shell
node scripts/bump.mjs init            # detection report, no writes
node scripts/bump.mjs patch           # bump; JSON reports old/new/since/files
node scripts/bump.mjs --repair-skew   # realign targets, no bump
```

It requires Node (any recent version) and a git repository with a
`.claude/version.json`.

## License

MIT
