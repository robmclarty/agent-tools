---
name: init
description: Configure a repo for the ast-grep-rules plugin — detect its ast-grep layout, generate .claude/ast-grep.json, bootstrap a minimal sgconfig.yml when the repo has none, and offer the two opt-in starter rule tiers. Run this once per repo before /audit, /rule, /lesson or /mine; a second run reports the resolved config instead of overwriting it, and can still adopt a tier.
allowed-tools: Read, Write, Glob, Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs*), Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/install-starter.mjs*)
---

# init

Set a repo up for `ast-grep-rules`, in one pass, without duplicating anything ast-grep
already knows. Two files carry the whole configuration and they divide cleanly:

- **`sgconfig.yml`** — ast-grep's own config. It owns where rules, utils, tests and
  snapshots live. This skill never restates those paths anywhere else; a path that
  genuinely varies across repos (`rules`, `tools/ast-grep/rules`, `config/ast-grep/rules`)
  with two sources of truth is a path that drifts.
- **`.claude/ast-grep.json`** — the per-repo variance this plugin owns: where the prose
  stores live, how to invoke ast-grep, and an optional repo-local rule scaffolder.

A repo with no `sgconfig.yml` is still in scope: this skill offers to write a minimal
one. Refusing every repo that hasn't already adopted ast-grep would cap the plugin at
the repos that need it least, and would break greenfield entirely.

Configuration leaves a repo with zero rules, which is the honest starting point — the
rules worth having come from `/ast-grep-rules:audit` reading the conventions this
project actually states. Two small bundled tiers exist for the repo that wants somewhere
to start, and this skill offers them at the end. They are opt-in every time.

`$ARGUMENTS` — none. Anything passed is a free-text hint about the repo's layout.

## Preflight context

- Resolver result: !`node ${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs`
- Starter tiers: !`node ${CLAUDE_PLUGIN_ROOT}/scripts/install-starter.mjs --list`

The resolver runs *first*. Its JSON already tells you which branch you are in — read it
before Globbing anything:

| Preflight | Meaning | Go to |
|---|---|---|
| `mode: "config"` | this repo is already configured | **Steps — configured** |
| `error_type: "config"` | no (or unparseable) `.claude/ast-grep.json` | **Steps — configure** |
| `error_type: "sgconfig"` | our config is fine; ast-grep's is missing or unreadable | **Steps — bootstrap** |
| `error_type: "usage"` / `"runtime"` | relay `message` verbatim and stop | — |

## Conventions

- **Use Glob and Read for every file check**, never `ls` or `cat`.
- **Write exactly two paths with the Write tool**, and only after the user approves:
  `sgconfig.yml` (or whatever path the config's `sgconfig` key names) and
  `.claude/ast-grep.json`. The one exception is a `.gitkeep` in a rules or tests
  directory this skill just created. Rule files are never hand-written here — the only
  thing that puts one in the repo is `install-starter.mjs`, run with an explicit
  `--tier` the user just named.
- **Never edit the repo's `package.json`**, and never install anything. If
  `@ast-grep/cli` is missing, that is a line in the report, not an action.
- **`.claude/ast-grep.json` is written whole**, in the key order below, as strict JSON —
  no comments, no trailing commas. `${CLAUDE_PLUGIN_ROOT}/templates/ast-grep.example.jsonc`
  is the annotated reference for what each key means.

## Detection

Every branch that writes shares this. Each key is *proposed*, never assumed — show the
user what you found and what you concluded from it.

1. **sgconfig** — Glob `sgconfig.yml`, `sgconfig.yaml`, `.ast-grep/sgconfig.yml`, then
   `**/sgconfig.y*ml` as a sweep. Prefer a repo-root match, then `.ast-grep/`, then the
   shallowest. A match in a package subdirectory of a monorepo is a candidate, not an
   answer — say which one you picked and why. No match anywhere → the bootstrap offer
   in step 6 below.

   Do **not** parse the file yourself for `ruleDirs`/`testConfigs`. Point the `sgconfig`
   key at it and let the resolver read those paths back in the verify step; that is the
   whole reason this plugin has one.

2. **`lessons_path`** — Glob `docs/lessons.md`, then `**/lessons.md`. No match keeps the
   `docs/lessons.md` default. **Do not create the file.** `/ast-grep-rules:lesson` owns
   the entry template and creates the log on its first append; seeding a second copy of
   that template here is how the two versions drift apart.

3. **`conventions_path`** — Glob `docs/conventions.md`, then `**/conventions.md`. No
   match keeps the `docs/conventions.md` default, and the report says it is absent —
   `/ast-grep-rules:audit` reads it, so an absent one is worth knowing about, not worth
   inventing.

4. **`convention_docs`** — the *other* docs that state enforceable conventions. Always
   list `CLAUDE.md`, **even when it does not exist yet**; add any `spec.md`,
   `constraints.md` or `taste.md` you find at the root or under `docs/`. Rules get
   authored from these far more often than from a friction log, so a repo whose real
   conventions live in `constraints.md` and isn't told to read it will audit clean while
   enforcing nothing — and a repo that grows a `CLAUDE.md` next week should be audited
   against it without anyone remembering to edit this file. A listed doc that is absent
   costs nothing: the resolver reports it as `exists: false` and moves on. Never write an
   empty list — that is an explicit override that turns the default off. The resolver
   dedupes `conventions_path` out of the list, so listing it twice is harmless.

5. **`ast_grep_command`** — Read the root `package.json`. ast-grep is a per-repo
   devDependency in every repo we have seen and is **never** on `PATH`, so this is a
   command *prefix* that arguments get appended to. Pick it from the lockfile:

   | Lockfile | Command |
   |---|---|
   | `pnpm-lock.yaml` | `pnpm exec ast-grep` |
   | `package-lock.json` | `npx --no-install ast-grep` |
   | `yarn.lock` | `yarn exec ast-grep` |
   | none, or unsure | `pnpm exec ast-grep` (the default) |

   `./node_modules/.bin/ast-grep` works under any of them and is the safe answer if the
   lockfiles disagree. If `@ast-grep/cli` is in neither `devDependencies` nor
   `dependencies` — or there is no `package.json` at all — still write the key, and put
   a line in the report saying the rest of the plugin will not run until it is installed.

6. **`scaffold_command`** — a `package.json` script whose name matches
   `scaffold.*ast.?grep` or `ast.?grep.*scaffold`. Found → propose it as the invocation
   the repo's package manager uses (e.g. `pnpm scaffold:ast-grep-rule`), which
   `/ast-grep-rules:rule` will prefer over writing YAML itself. Not found → `null`, and
   `/ast-grep-rules:rule` writes the rule and its fixture directly. Either way a rule is
   not done until its `*-test.yml` fixture passes.

7. **Superseded bespoke skills** — Glob `.claude/skills/*/SKILL.md`. If any of
   `post-friction-lesson`, `mine-ast-grep-rules` or `propose-ast-grep-rule` are present,
   this repo already carries an earlier, hand-rolled version of this loop. Read them:
   they encode this repo's established conventions, and a `scaffold_command` or rules
   directory named in one of them beats anything inferred. Then add an adoption note to
   the report recommending they be removed once the plugin is adopted, so `/lesson` and
   `/rule` resolve to one implementation. **Report only — never delete them**, and never
   fold their removal into this run.

## Steps — configure

The repo has no usable `.claude/ast-grep.json`.

1. **Repair or fresh?** Glob `.claude/ast-grep.json`. If it exists, the resolver could
   not parse it (its `message` says why): this is a repair. Read whatever is legible,
   preserve the intent behind every key you can recover, and show the user the parse
   problem alongside the corrected file. If it does not exist, this is a fresh configure.

2. **Run Detection** above, all seven points.

3. **Compose `.claude/ast-grep.json`.** Write all six keys explicitly, in this order,
   even where the value equals the default — an empty `{}` resolves identically, but
   this file is the first thing the next reader opens to learn the contract:

   ```json
   {
     "sgconfig": "sgconfig.yml",
     "lessons_path": "docs/lessons.md",
     "conventions_path": "docs/conventions.md",
     "convention_docs": ["CLAUDE.md"],
     "ast_grep_command": "pnpm exec ast-grep",
     "scaffold_command": null
   }
   ```

   Never add `rules_dir`, `utils_dir`, `tests_dir` or `snapshot_dir`. The resolver
   ignores them with a warning, because sgconfig.yml owns them.

4. **If detection found no sgconfig anywhere**, also compose the bootstrap document from
   step 6 of **Steps — bootstrap** below, and present both files together.

5. **Propose, then write.** Show each file as a fenced block, verbatim, exactly as it
   will land, with a one-line note per key saying what it was inferred from. Config
   generation is judgment, so the user signs off before anything is written — this is
   the skill's one interactive gate. On approval, Write them. On refusal, stop; nothing
   has been written yet.

6. **Verify and report** — the shared closing steps below.

## Steps — bootstrap

`.claude/ast-grep.json` is valid, but the resolver could not use ast-grep's own config.
Three different situations wear this one `error_type`, so establish which before acting.
Glob for a real sgconfig (Detection step 1) and compare it to the `sgconfig` key the
config declares:

1. **A real sgconfig exists somewhere else.** The config points at the wrong path.
   Propose rewriting `.claude/ast-grep.json` with `sgconfig` corrected to the found
   path, every other key preserved as-is. Show the one-line diff in prose, get approval,
   Write it.

2. **The configured sgconfig exists but the resolver rejected it** — malformed YAML, or
   it declares no `ruleDirs`. **Write nothing.** Relay the resolver's `message` verbatim,
   name the file, and stop. This is someone else's ast-grep config with real rules
   behind it; a repair guessed at from outside is worse than a clear error.

3. **No sgconfig exists anywhere.** This is the bootstrap case. Propose the minimal real
   shape — one rule dir, one test config — at the path the config's `sgconfig` key
   already names:

   ```yaml
   ruleDirs:
     - rules

   testConfigs:
     - testDir: tests
       snapshotDir: __snapshots__
   ```

   `testConfigs` is not optional garnish: every rule this plugin writes ships with a
   `<id>-test.yml` fixture, and without a test dir `ast-grep test` has nowhere to look.

   Then, and only for directories that do not already exist, Write a `.gitkeep` into the
   rule dir and the test dir. A bootstrap that leaves ast-grep pointed at directories
   that aren't there hasn't bootstrapped anything, and an empty directory does not
   survive a commit. Never overwrite an existing `.gitkeep`.

   Present the file, get approval, Write it.

4. **Verify and report** — the shared closing steps below.

## Steps — configured

The repo is already set up. **This branch writes nothing.** That is the point: `/init`
is safe to re-run, and a second run is a status report, not a re-configuration.

1. **Report the resolved contract** from the preflight JSON: `sgconfig_path`,
   `paths.rules_dir`, `paths.tests_dir`, `paths.snapshot_dir`, `lessons_path`,
   `conventions_path`, the `convention_docs` list with each one's `exists` flag, and
   `ast_grep_command` / `scaffold_command`. State plainly that the repo is already
   configured and nothing was changed.

2. **Relay every `warnings` entry verbatim** and offer to fix it. The two that matter:

   - *no `testConfigs`* — `ast-grep test` has nowhere to look, so
     `/ast-grep-rules:rule` cannot finish a rule. Offer to add a `testConfigs` entry to
     the existing sgconfig.yml.
   - *an ignored key* (`rules_dir` and friends) — the user meant something by writing
     it. Explain that sgconfig.yml owns that path and offer to remove the dead key.

3. **Offer, never perform.** If the user wants a key changed, change that key and
   rewrite the file whole; otherwise stop here. Do not re-derive the config, do not
   "refresh" it, and do not overwrite a value the user chose deliberately just because
   detection would now infer a different one.

4. **Make the starter-tier offer** — see **Starter tiers** below. A repo that declined
   both tiers at configure time is exactly the repo that might want one now, so the
   offer belongs on the re-run too. It stays an offer: this branch still writes nothing
   unless the user names a tier.

## Steps — error

`usage` or `runtime`: the resolver never got far enough to say anything about this repo.
Relay `message` verbatim and stop. No Globbing, no writes, no retry.

## Verify and report

Both writing branches end here.

1. **Re-run the resolver:** `node ${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs`. This is the
   proof the write actually took, read back through the same contract every other skill
   in this plugin reads.

2. **A surviving `mode: "error"` means it did not take.** Report the `message`, say what
   was written, and stop — do not retry and do not start guessing at a second config.

3. **On `mode: "config"`, report:** the files written, the resolved `sgconfig_path` and
   `paths` (rules, utils, tests, snapshots), which of them exist on disk, and every
   `warnings` entry verbatim. Then the follow-ups, in order:

   - `@ast-grep/cli` not installed → the install command for their package manager.
   - A smoke check they can run themselves: `<ast_grep_command> test`, which should be
     green against zero rules.
   - Any bespoke-skill adoption note from Detection step 7.
   - `/ast-grep-rules:audit` as the natural next move — it reports which conventions
     their docs already state that no rule enforces, which is where most rules come from.

4. **Make the starter-tier offer** — see **Starter tiers** below.

## Starter tiers

Two small bundled rulesets ship with the plugin. Both writing branches and the
already-configured branch end with the same offer, and it is **an offer every time**:
nothing here has a default, and declining is a complete answer that leaves the repo with
zero rule files.

The plugin's whole claim is that the rules worth having are mined from *this* project's
friction and *this* project's stated conventions — not curated from someone else's. A
tier that installed itself would quietly turn this into the rule library that claim
refuses. So the tiers exist for one narrow reason: a repo starting from zero has nothing
for `/ast-grep-rules:audit` to compare against, and a few rules you can read and argue
with beat an empty directory.

1. **Present both tiers from the preflight `--list` JSON**, in its own words — each
   tier's `title`, `summary`, its `rules` by id, and its `adopt_when` / `decline_when`.
   Do not paraphrase the two into one recommendation; they are different kinds of claim,
   which is why they are two tiers:

   - **hygiene** describes defects. Each rule names a way a TypeScript codebase leaks,
     and a stranger can be told why the flagged line is wrong.
   - **functional-style** describes a house style. These rules are right only where the
     project has actually made that call. Say so plainly — a repo that uses classes
     should decline, and declining costs it nothing.

   State the third option out loud alongside them: **neither**, and let `/audit` propose
   rules from what this repo's own docs already say. For a repo with real conventions
   written down, that is the better path, and this skill should say which one it thinks
   fits based on what Detection found in `convention_docs`.

2. **Install only what the user names**, one command per invocation:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/install-starter.mjs --tier <name> [--tier <name>]
   ```

   Never run it without `--tier`; never pass a tier the user did not name. The script
   copies three files per rule — the rule, its `*-test.yml` fixture and its recorded
   snapshot — to the paths sgconfig.yml declares, and it is atomic: if any rule in the
   tier collides with one this repo already has, it writes nothing and says which.

3. **On `error_type: "exists"`, relay the message and stop.** The local rule is the tuned
   one and it wins by default. `--skip-existing` installs the rest of the tier around it
   — offer that, do not assume it. Never resolve a collision by overwriting.

4. **Report what landed**, from the JSON: the rule ids, the file count, and then

   - Every `path_scoped` entry with a non-empty `missing_prefixes` — that rule's `files:`
     globs point at a directory this repo does not have, so it currently governs nothing
     while looking enforced. Offer to edit the glob. This is the one thing in the install
     that is genuinely wrong until someone fixes it.
   - The `next` list verbatim. It starts with `<ast_grep_command> test`, which should be
     green immediately — every bundled rule ships with its snapshot, so a fresh install
     needs no `--update-all`.
   - That `<ast_grep_command> scan` will now flag existing code, and on a mature repo it
     usually finds plenty. Adopting a tier is a decision to fix or suppress those.

## When to use this skill

- Adopting `ast-grep-rules` in a repo for the first time.
- The user asks to "set up ast-grep", "configure ast-grep-rules", or wire this plugin
  into a project.
- Another skill in this plugin failed with "no `.claude/ast-grep.json` found" or
  "sgconfig not found".
- Checking what the current configuration resolves to — the already-configured branch is
  a read-only status report.
- Adopting a starter tier in a repo that is already configured — the offer is on the
  re-run for exactly that reason.

## When NOT to use this skill

- Adding a rule (`/ast-grep-rules:rule`) or finding what needs one
  (`/ast-grep-rules:audit`) — configuration is a one-time move.
- Changing a rules directory. That lives in `sgconfig.yml`; edit it there and every
  skill in this plugin follows, with no config change at all.
- Writing a rule of this project's own. The starter tiers are a floor, not the
  mechanism; `/ast-grep-rules:audit` is what finds the rules this repo actually needs.

## Edge cases

- **Monorepo with several sgconfigs.** Configure the repo you are in, using the sgconfig
  that governs it, and say which one you chose. Do not try to serve all of them from one
  config.
- **sgconfig outside the repo root** (e.g. `.ast-grep/sgconfig.yml`). Paths inside it
  resolve relative to *that file*, not to the repo root — which is what ast-grep does,
  and what the resolver reproduces. Point at it and let the verify step report where its
  `ruleDirs` actually landed; do not "helpfully" rewrite them to root-relative.
- **`rules/` or `tests/` already exists** when bootstrapping. Leave them exactly as they
  are — no `.gitkeep`, no reorganizing. Existing rules must keep loading.
- **A repo with no `package.json`.** Fully supported. Write the default
  `ast_grep_command` and report that ast-grep needs installing before anything else in
  the plugin will run.
- **The user declines the write.** Nothing has been written. Say what would have been
  written and stop; re-running `/ast-grep-rules:init` picks up from the same place.
- **The user declines both starter tiers.** The expected answer for a repo whose
  conventions are already written down, and the right one for a repo that has not
  decided yet. Zero rule files are written. Point at `/ast-grep-rules:audit` and move on
  — do not re-offer, and do not soften a tier into a "just this one rule" install.
- **A tier installs but `<ast_grep_command> test` is red.** Not a rule to debug: every
  bundled rule ships its snapshot and is green on arrival. Look for a `snapshotDir` in
  sgconfig.yml that changed after the install, or a pre-existing rule elsewhere in the
  repo that was already red. Report what you find rather than running `--update-all`,
  which would bake the current behavior in as correct.
