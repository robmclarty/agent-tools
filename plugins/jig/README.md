# jig

Guided per-repo workflows for Claude Code, bundled under one rule. A skill
belongs in jig when it is all four of these:

- **User-invoked only.** A skill only you can type stays out of the model's
  context until you type it, so the bundle can keep growing without taxing every
  session it is installed in.
- **Per-repo.** Each skill reads the repository it runs in, through a config
  that lives in that repo (`.claude/version.json`, say), so one install serves
  every project and nothing about a project lives in the plugin.
- **Script-backed.** The deterministic part of a workflow (semver math, a
  never-stage filter) belongs in a script the model calls, where it runs the same
  way every time and can be tested.
- **Ambient-free.** Nothing here runs outside your turn: no hooks, MCP servers,
  LSP servers, agents, monitors, or `bin/`, each of which Claude Code would load
  whether or not you asked for it this session.

The rule is what tells the next candidate whether it belongs. Two skills meet it
today:

- [`/jig:version`](#version) cuts a release from `.claude/version.json`.
- [`/jig:commit`](#commit) lands a conventional commit through a never-stage
  filter.

## Install

```shell
/plugin marketplace add robmclarty/agent-tools
/plugin install jig@robmclarty
```

Coming from the separate `version` and `commit-with-til` plugins? See
[Migrating](#migrating).

## version

`/jig:version` cuts a release — bump the version, summarize commits into a
changelog section, commit (and optionally tag/push) — in **any** repo, adapting
to each via a small per-repo config file. It replaces the bespoke, copy-pasted
version skill that otherwise accumulates in every project.

The design splits three concerns:

- **An invariant skill** (`skills/version/SKILL.md`) — the release workflow, the
  same everywhere. Drafts the changelog prose and runs git.
- **A deterministic engine** (`scripts/version/bump.mjs`, zero dependencies) —
  the dirty-tree check, target resolution, semver math, every version rewrite,
  and previous-release detection. Runs in the skill's preflight, before the
  model reasons, and emits a JSON contract the skill consumes.
- **A per-repo config** (`.claude/version.json`) — everything that differs from
  repo to repo. Generated once by `/jig:version init`.

### Quick start

Once per repo, generate the config (it inspects the repo and, if you already
have a bespoke version skill, migrates its conventions):

```shell
/jig:version init
```

Then cut releases:

```shell
/jig:version patch     # 0.4.6 → 0.4.7
/jig:version minor     # 0.4.6 → 0.5.0
/jig:version major     # 0.4.6 → 1.0.0
```

Recover from version drift across files (realign every target to the
authoritative version without bumping; leaves changes uncommitted for review):

```shell
/jig:version --repair-skew
```

### What a release does

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

### Configuration

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

#### Examples

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

### The engine, standalone

`scripts/version/bump.mjs` is usable on its own — it always prints one JSON
object and exits 0 even on expected failures (so a slash-command preflight never
swallows the error):

```shell
node scripts/version/bump.mjs init            # detection report, no writes
node scripts/version/bump.mjs patch           # bump; JSON reports old/new/since/files
node scripts/version/bump.mjs --repair-skew   # realign targets, no bump
```

It requires Node (any recent version) and a git repository with a
`.claude/version.json`.

## commit

`/jig:commit` creates conventional commits and extracts **TIL** ("today I
learned") entries for [code-diary](https://github.com/robmclarty/code-diary).
The model composes the message; a deterministic script owns staging and enforces
a never-stage filter, so secrets and junk can't slip into a commit.

### Usage

```shell
/jig:commit
/jig:commit some scope or context
```

The skill preloads the repo state (status + staged/unstaged diffs + recent
commits for style reference), decides which paths belong in the commit, composes
a `type(scope): summary` message, and hands staging + committing to the script in
a single tool call. It commits without asking — invoking `/jig:commit` is the
confirmation.

### How it works

Two pieces:

- **`skills/commit/SKILL.md`** — the model's side: read the diff, group changes,
  write a conventional-commit message, scan for a genuine TIL, and call the
  script.
- **`scripts/commit/commit.sh`** — the deterministic guard. Reads the message
  from a single-quoted stdin heredoc (so apostrophes, backticks, and `$` need no
  escaping), applies the never-stage filter, stages the survivors, and commits.

The message is piped in, never passed as a shell argument — one quoting layer,
no escaping of the body.

#### Never-stage filter

Paths are taken literally (`GIT_LITERAL_PATHSPECS=1`): no globs, no `:(magic)`, so
the filter always sees the exact file git will stage.

The script skips (and reports on stderr) paths matching:

- **secrets** — `.env` / `.env.*` (except `.env.example`, `.env.sample`),
  `*.pem`, `*.key`, `*.secret`, `*.token`, `token(s).json`, `*credentials*`
- **logs** — `*.log`
- **gitignored** — untracked paths that `.gitignore` excludes (a tracked file
  under an ignored directory is not ignored, and still stages)
- **oversize** — files larger than 1 MB
- **binary** — only with `--block-binary` (off by default, since the heuristic
  mis-flags legitimate committed binaries like snapshots and fixtures)
- **empty directory** — a directory arg that expands to nothing stageable

Directory arguments are expanded to their tracked + untracked-not-ignored files,
so passing a directory behaves like passing every file under it.

### TIL format

code-diary's parser extracts a TIL from any commit-body line containing `TIL:`
(case-sensitive), taking everything after it to end of line. Most commits have
no TIL — add one only for a genuine insight (first use of an API/flag in the
project, a surprising bug root cause, non-obvious platform behavior).

```
fix(internal-tools): handle timezone offsets with half-hour increments

India Standard Time (+0530) and similar half-hour offsets were being
truncated to whole hours during day segment calculation.

TIL: not all UTC offsets are whole hours — IST is +05:30, Nepal is +05:45
```

## Migrating

jig replaces the separate `version` and `commit-with-til` plugins, which this
marketplace no longer lists. Do the whole swap in one sitting: once the old
entries are gone from the catalog, a half-done swap leaves a skill with no
source.

```shell
/plugin uninstall version
/plugin uninstall commit-with-til
/plugin install jig@robmclarty
```

Change no repo config. Every repo's `.claude/version.json` and `.claude/version.md`
stay where they are and mean what they did; those files belong to the repo, not
to the plugin. From here on, type `/jig:version` and `/jig:commit`.

If you once ran the commit skill from your user-level skills directory at
`~/.claude/skills/commit-with-til`, delete that directory after installing, so
`/jig:commit` is the one commit path.

## License

MIT
