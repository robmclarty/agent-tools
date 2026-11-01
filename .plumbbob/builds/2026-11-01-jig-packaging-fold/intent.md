# jig packaging fold

**Phase:** decided, ready to build
**Size:** small
**Scope:** jig

*Source: inline intent, 2026-11-01. Background: `research/specs/version-v2.md`, read for
its Packaging section, D12 (config-stays-put), D16 (jig-bundle), and Q1 (dx-bundle) only.
This build is that spec's step 1, done on its own; the v2 engine work is a separate, later
build and nothing else from v2 is pulled in here.*

## Frame

- **Problem:** agent-tools ships `version` and `commit-with-til` as two plugins. Both are
  user-invoked, script-backed, per-repo workflow skills, and they lean on each other. More
  skills of the same kind are queued (`check`, `orient`, `qa`, `catalog`, the explicit
  `/decide` half of `decisions`, `scaffold`'s `package` verb), and each one would add
  another manifest and another install line. User-only skills cost a session nothing per
  turn, so one bundle can grow without a tax; a growing row of separate plugins cannot.
- **Smallest thing that solves it:** move both plugins under `plugins/jig/` with `git mv`,
  keep their behavior unchanged, and repoint everything that names the old paths. One
  manifest, one marketplace entry, one README that states what jig admits, and one test
  that enforces the checkable half of that rule.
- **Done looks like:**
  - `bash scripts/check.sh` is green and ends `3 plugins validated, 10 test files` (today
    it ends `4 plugins validated, 9 test files`).
  - `claude plugin validate plugins/jig` and `claude plugin validate .` both pass.
  - `git log --follow` shows history across the move for `bump.mjs`, `commit.sh`, and both
    `SKILL.md` files.
  - Outside `CHANGELOG.md`, `research/`, and `.plumbbob/`, grep finds none of
    `plugins/version`, `plugins/commit-with-til`, `version@robmclarty`,
    `commit-with-til@robmclarty`, or a `scripts/bump.mjs` or `scripts/commit.sh` path
    missing its `version/` or `commit/` segment.
  - Manual, run by Rob after the build: under `claude --plugin-dir plugins/jig`,
    `/jig:version` with no args reaches the engine's usage output, and `/jig:commit` runs
    its script with no permission prompt.
- **Explicitly NOT doing:**
  - Any v2 engine work: no `release.mjs`, no `lib/` split, no new modes, no behavior
    change in `bump.mjs` or `commit.sh`.
  - Cutting a release, or touching `CHANGELOG.md` or the marketplace's `metadata.version`;
    the next `/version` run does that.
  - Adding a third skill to jig.
  - Moving `ast-grep-rules` or `plumbbob`; both fail the admission rule (a hook on every
    edit; an npm package with a `bin/`).
  - Editing other repos, anything under `research/`, or `~/.claude/settings.json` (it
    enables `version@robmclarty` and `commit-with-til@robmclarty` today; Rob swaps the
    installs after the push).

## Architecture sketch

The target layout. Each line says where the file comes from; "new" means written in
this build.

```text
plugins/jig/
  .claude-plugin/plugin.json                         new: name "jig", merged keywords, one description
  README.md                                          from plugins/version/README.md, rewritten in step 2
  skills/version/SKILL.md                            from plugins/version/skills/version/SKILL.md, paths repointed
  skills/commit/SKILL.md                             from plugins/commit-with-til/skills/commit/SKILL.md, paths repointed
  scripts/version/bump.mjs                           from plugins/version/scripts/bump.mjs, byte-identical
  scripts/version/__tests__/bump-changelog.test.mjs  from plugins/version/scripts/__tests__/, byte-identical
  scripts/commit/commit.sh                           from plugins/commit-with-til/scripts/commit.sh, byte-identical
  scripts/commit/__tests__/commit.test.mjs           from plugins/commit-with-til/scripts/__tests__/, byte-identical
  templates/version.example.jsonc                    from plugins/version/templates/, byte-identical
  __tests__/admission.test.mjs                       new, step 3

.claude-plugin/marketplace.json                      the version and commit-with-til entries become one jig entry
README.md                                            install block and plugin table
```

`${CLAUDE_PLUGIN_ROOT}` resolves to the installed `plugins/jig/`, so each skill reaches
its script at `${CLAUDE_PLUGIN_ROOT}/scripts/version/bump.mjs` or
`${CLAUDE_PLUGIN_ROOT}/scripts/commit/commit.sh`. Neither script resolves any path from
its own location, so the move changes nothing they do.

## Decisions

- <a id="d1"></a>**D1 (jig-bundle)**: `version` and `commit-with-til` ship as one plugin named `jig`, *because* the two already lean on each other, user-only skills cost a session nothing per turn so the bundle can grow, and `jig` is free in the official marketplace and in this one, where the first candidate `dx` collides with the work marketplace (Claude Code resolves plugin names across marketplaces; v2's D16).
- <a id="d2"></a>**D2 (config-stays-put)**: every repo's config stays at `.claude/version.json` and its notes at `.claude/version.md`, whatever the plugin is called, *because* those files belong to the repo, not the packaging (v2's D12); this repo's own `.claude/version.json` is untouched.
- <a id="d3"></a>**D3 (pure-renames)**: `bump.mjs`, `commit.sh`, both test files, and `version.example.jsonc` move byte-identical, each `__tests__/` staying beside its script, *because* neither script resolves a path from its own location and each test finds its script with `new URL('../bump.mjs')` or `new URL('../commit.sh')`, so a pure rename keeps all of them valid with no edit and `git diff -M` can prove it.
- <a id="d4"></a>**D4 (segment-everywhere)**: every path that names a script in either SKILL.md gains its `version/` or `commit/` segment, eight sites in all (version: `allowed-tools` and the `!` preflight; commit: `allowed-tools`, the intro line, the run step, the "what the script handles" paragraph, the never-stage edge case, and the worked example), *because* an `allowed-tools` grant that no longer matches the command turns every run into a permission prompt, and the grep in Done treats a prose `scripts/commit.sh` the same as a live one.
- <a id="d5"></a>**D5 (marketplace-with-move)**: the marketplace edit lands in the same step as the `git mv`, replacing the two entries with one `jig` entry (`source: ./plugins/jig`, license MIT, category `development`, the merged keywords, the same homepage and repository) and leaving `metadata.version` alone, *because* `validate-marketplace.sh` fails the moment an entry points at a directory that is gone, and `/version` owns the catalog version.
- <a id="d6"></a>**D6 (one-description)**: `plugin.json` and the marketplace entry share one description, `Guided per-repo workflows: /version cuts a release from .claude/version.json and /commit lands a conventional commit through a never-stage filter. User-invoked, script-backed skills only; nothing ambient.`, *because* the two manifests have always said the same thing, and the builder should not have to invent the catalog's one line of copy.
- <a id="d7"></a>**D7 (readme-carry)**: step 1 moves `plugins/version/README.md` to `plugins/jig/README.md` with `git mv` and removes `plugins/commit-with-til/README.md`; step 2 writes the merged README, taking the commit content from the baseline (`git show 4e29ebb:plugins/commit-with-til/README.md`), *because* two files cannot share one name and the version README is the larger, so it is the one whose history is worth following.
- <a id="d8"></a>**D8 (admission-rule)**: jig admits a skill that is user-invoked only, per-repo, script-backed, and ambient-free, and the README opens with that rule, one reason per clause, then names the skills `/jig:version` and `/jig:commit` ([D14 (namespaced-names)](#d14)), *because* the bundle is named for the rule, not for the two skills it starts with, and the rule is what tells the next candidate whether it belongs.
- <a id="d9"></a>**D9 (rule-is-tested)**: the rule's two checkable clauses, user-invoked and ambient-free, are enforced by `plugins/jig/__tests__/admission.test.mjs`, which runs its checks as functions over a plugin root and proves each failure against a scratch copy under `os.tmpdir()`, removed afterward, with one violation injected; it reads `disable-model-invocation` from each SKILL.md's leading frontmatter block only, and its ambient set is [D13 (ambient-list)](#d13)'s, *because* a deterministic check beats a reviewer remembering, a "fails when" that is only asserted in a comment can pass vacuously, a scratch copy inside the plugin would be found by `check.sh` and could outlive a failing run, and a whole-file grep would pass a key mentioned only in prose; per-repo and script-backed stay prose, since they are judgments about a skill's design, not file shapes.
- <a id="d10"></a>**D10 (migration-one-sitting)**: the README's migration note says to uninstall `version@robmclarty` and `commit-with-til@robmclarty`, install `jig@robmclarty`, change no repo config, and do all of it in one sitting, *because* the old entries leave the marketplace in this build, so a half-done swap leaves a skill with no source.
- <a id="d11"></a>**D11 (name-check-first)**: step 1 does not start until `jig` is confirmed free in the work marketplace, *because* Claude Code resolves plugin names across marketplaces, and a collision found after the fold would mean a second rename across every path this build repoints.
- <a id="d12"></a>**D12 (carry-version)**: jig's `plugin.json` starts at 0.2.0, carried over from `version`, *because* the release engine is the bundle's substance, and the same code under a new name continues its count rather than restarting it.
- <a id="d13"></a>**D13 (ambient-list)**: the ambient clause names hooks, MCP servers, LSP servers, agents, monitors, and `bin/`, in the README and in the test, which refuses `hooks/`, `agents/`, `bin/`, `monitors/`, `.mcp.json`, and `.lsp.json` under the plugin root and the `hooks`, `mcpServers`, and `lspServers` keys in `plugin.json`, *because* each is a component Claude Code loads outside the user's turn: agent descriptions ride every session's Agent tool listing, and an LSP server is a background process like an MCP server.
- <a id="d14"></a>**D14 (namespaced-names)**: the skills are written `/jig:version` and `/jig:commit` everywhere, in the plugin README, the root README, and the eight bare `/version` and `/commit` mentions in the two SKILL.md files, with no bare-name note, *because* bare `/version` never resolved (Rob types `/version:version` today), and editor autocomplete makes the namespaced form the convenient one, as with every other marketplace plugin.
- <a id="d15"></a>**D15 (root-readme-in-step-1)**: the root README's install block, plugin table, and both "small single-skill utilities" phrases change in step 1 alongside the marketplace, *because* no commit should carry docs behind its manifest, and one file is edited once; step 2 is the plugin README alone.

## Constraints

- <a id="c1"></a>**C1 (no-engine-change)**: `bump.mjs` and `commit.sh` land byte-identical to the baseline; `git diff -M --stat 4e29ebb` shows each as a 100% rename.
- <a id="c2"></a>**C2 (no-release)**: `CHANGELOG.md` and the marketplace's `metadata.version` are not touched.
- <a id="c3"></a>**C3 (nothing-outside)**: nothing under `research/`, no other repo, and not `~/.claude/settings.json`.
- <a id="c4"></a>**C4 (two-skills)**: jig ships exactly `version` and `commit`; `ast-grep-rules` and `plumbbob` stay where they are.
- <a id="c5"></a>**C5 (check-is-the-gate)**: `bash scripts/check.sh` is green at every checkpoint, and neither `scripts/check.sh` nor `scripts/validate-marketplace.sh` is edited; both discover plugins and tests on their own.
- <a id="c6"></a>**C6 (history-follows)**: `git log --follow` reaches pre-move history for `bump.mjs`, `commit.sh`, and both `SKILL.md` files, so the move is a `git mv` plus edits in one commit, never a delete and re-add.
- <a id="c7"></a>**C7 (grep-clean)**: outside `CHANGELOG.md`, `research/`, and `.plumbbob/`, no `plugins/version`, `plugins/commit-with-til`, `version@robmclarty`, `commit-with-til@robmclarty`, or a `scripts/bump.mjs` or `scripts/commit.sh` path without its segment survives the build.
- <a id="c8"></a>**C8 (house-style)**: new code (the admission test) is functional, free functions and named exports, on `node:test` and `node:assert/strict` with no dependencies, matching the tests already in the tree.
- <a id="c9"></a>**C9 (namespaced-only)**: no bare `/version` or `/commit` invocation survives under `plugins/jig/` or in the root `README.md`; every mention reads `/jig:version` or `/jig:commit`.

## Steps

1. [ ] chore(jig): fold version and commit-with-til into one plugin, **done when:** `plugins/jig/` holds the target layout from the sketch (the README carried per [D7 (readme-carry)](#d7), the admission test not yet), `git diff -M --stat 4e29ebb` shows `bump.mjs`, `commit.sh`, both test files, and the template as 100% renames ([D3 (pure-renames)](#d3)), `grep -rn 'scripts/bump.mjs\|scripts/commit.sh' plugins/jig/skills` returns nothing and both `allowed-tools` lines name the segmented path ([D4 (segment-everywhere)](#d4)), neither SKILL.md names a bare `/version` or `/commit` any longer, the eight mentions reading `/jig:version` or `/jig:commit` and the init step's sentence about deleting the bespoke skill reworded rather than prefixed ([D14 (namespaced-names)](#d14)), `plugins/jig/.claude-plugin/plugin.json` carries name `jig`, version 0.2.0 ([D12 (carry-version)](#d12)), the author, license, homepage, and repository of the old manifests, the merged keyword list, and the [D6 (one-description)](#d6) text, `.claude-plugin/marketplace.json` lists one `jig` entry per [D5 (marketplace-with-move)](#d5) and no `version` or `commit-with-til` entry, root `README.md` installs `jig@robmclarty` in place of the two old lines, its plugin table has one `jig` row naming `/jig:version` and `/jig:commit`, and both "small single-skill utilities" phrases read "small utilities" ([D15 (root-readme-in-step-1)](#d15)), `plugins/version/` and `plugins/commit-with-til/` are gone, `bash scripts/check.sh` ends `3 plugins validated, 9 test files`, and `claude plugin validate plugins/jig` and `claude plugin validate .` both pass
   - seam: `plugins/version/**` to `plugins/jig/**`, `plugins/commit-with-til/**` to `plugins/jig/**`, `plugins/jig/.claude-plugin/plugin.json`, `plugins/jig/skills/version/SKILL.md`, `plugins/jig/skills/commit/SKILL.md`, `.claude-plugin/marketplace.json`, `README.md`
   - model: sonnet (mechanical; the layout, the eight sites, and the counts specify it fully)
2. [ ] docs(jig): state what jig admits and how to migrate, **done when:** `plugins/jig/README.md` opens with the four-clause admission rule, one reason per clause, its ambient clause naming the full [D13 (ambient-list)](#d13) set, then a `version` section and a `commit` section carrying the old READMEs' content with every invocation written `/jig:version` or `/jig:commit` ([D14 (namespaced-names)](#d14)) and every script path reading `scripts/version/bump.mjs` or `scripts/commit/commit.sh`, then the migration note ([D10 (migration-one-sitting)](#d10)); the [C7 (grep-clean)](#c7) and [C9 (namespaced-only)](#c9) greps over the repo return nothing; `bash scripts/check.sh` stays green
   - seam: `plugins/jig/README.md`
   - model: opus (the rule and its reasons outlive the build and must read cold)
3. [ ] test(jig): enforce the admission rule with a node test, **done when:** `plugins/jig/__tests__/admission.test.mjs` passes on the tree as it stands and, run against scratch copies of the plugin under `os.tmpdir()` with one violation injected each ([D9 (rule-is-tested)](#d9)), fails when any `skills/*/SKILL.md` lacks `disable-model-invocation: true` in its frontmatter, when `hooks/`, `agents/`, `bin/`, `monitors/`, `.mcp.json`, or `.lsp.json` exists under the plugin root, and when `plugin.json` declares `hooks`, `mcpServers`, or `lspServers` ([D13 (ambient-list)](#d13)); `claude plugin validate plugins/jig` still passes with the test in place; `bash scripts/check.sh` ends `3 plugins validated, 10 test files`
   - seam: `plugins/jig/__tests__/admission.test.mjs`
   - model: sonnet (the checks are enumerated; the scratch-copy pattern is already in `commit.test.mjs`)

## Build order

*(Empty: document order. `plumbbob order` writes this line if a refine ever has to land a
step out of sequence.)*

## Build ranges

One `/plumbbob:run` lands all three steps and stops once, for the two things only Rob can
do: the live `--plugin-dir` check and the push.

1. `/plumbbob:build 1-3`, **stop:** run the manual check under `claude --plugin-dir plugins/jig` (`/jig:version` with no args reaches the engine's usage output; `/jig:commit` runs its script with no permission prompt), then finish, push, and swap the installs
   - model: opus
   - note: a permission prompt from `/jig:commit` means a path in `skills/commit/SKILL.md` missed its segment; fix it on step 1's seam before finishing

## Open questions

- <a id="q1"></a>**Q1 (name-check)**: Does step 1 wait until `jig` is confirmed free in the work marketplace?, *resolved:* 2026-11-01, yes, wait for the check; see [D11 (name-check-first)](#d11)
  - *plain:* Claude Code resolves plugin names across marketplaces, so a `jig` in the work marketplace would answer to the same `/jig:` namespace, which is why the first candidate, `dx`, was dropped. The work marketplace is not on this machine; the official marketplace and this one were checked on 2026-11-01 and are clear.
  - *lean:* Yes, wait: the check takes a minute and happens before `/plumbbob:run`. If the name is taken, `/plumbbob:refine` renames the bundle before anything lands.
- <a id="q2"></a>**Q2 (start-version)**: Does jig's `plugin.json` start at 0.1.0, or carry 0.2.0 over from `version`?, *resolved:* 2026-11-01, carry 0.2.0 over; see [D12 (carry-version)](#d12)
  - *plain:* The name is new, so no installed copy sees either number as an update, and this repo's `.claude/version.json` targets only `metadata.version`, so no `/version` run rewrites the plugin's own version; whatever this build sets is bumped by hand from then on. Only the number itself is at stake.
  - *lean:* 0.1.0, since a new name starts its own count. The next release's changelog line can record the lineage (`jig` 0.1.0, from `version` 0.2.0 and `commit-with-til` 0.1.2).
- <a id="q3"></a>**Q3 (ambient-list)**: Should the ambient clause, in the README and in the test, also refuse `agents/` and LSP servers (`lspServers` in `plugin.json`, or a `.lsp.json`), which the rule's reasoning covers but its wording does not name?, *resolved:* 2026-11-01, yes, both; see [D13 (ambient-list)](#d13)
  - *plain:* The rule refuses hooks, MCP servers, monitors, and `bin/` because each costs every session something or runs outside the user's turn, and a plugin's `agents/` and LSP servers do the same: agent descriptions ride every session's Agent tool listing (the per-turn tax the user-invoked clause exists to avoid), and an LSP server is a background process like an MCP server. As written, [D9 (rule-is-tested)](#d9) passes a jig that grows either one, and the official marketplace ships both kinds today, so the gap is real rather than theoretical.
  - *lean:* Yes, add both to the test's ambient list and name them in the README clause, so the clause covers every component Claude Code loads outside a user's turn: hooks, MCP servers, LSP servers, agents, monitors, and a `bin/`.
- <a id="q4"></a>**Q4 (bare-names)**: Do bare `/version` and `/commit` still resolve once the skills live under `jig`, and what in the plan checks it?, *resolved:* 2026-11-01, no bare names: `/jig:version` and `/jig:commit` everywhere, with editor autocomplete; see [D14 (namespaced-names)](#d14)
  - *plain:* [D8 (admission-rule)](#d8) has the README say they do, and both SKILL.md files tell the user to type bare `/version init`, `/version --repair-skew`, `/version patch`, and `/commit` in seven places. Bare `/version` works today, but the plugin and its skill share that name, so nothing shows whether it resolves by an unambiguous-name shortcut or by that coincidence, and the stop's manual check names only `/jig:version` and `/jig:commit`.
  - *lean:* Keep the note and the SKILL prose, and add the bare forms to the stop's manual check. If they fail there, step 2 drops the note and a fix on step 1's seam prefixes the seven mentions with `/jig:`.
- <a id="q5"></a>**Q5 (root-readme-step)**: Should the root README's install block and plugin table change in step 1 rather than step 2, so no commit's docs name a plugin its marketplace no longer lists?, *resolved:* 2026-11-01, yes, in step 1; see [D15 (root-readme-in-step-1)](#d15)
  - *plain:* Step 1 drops the `version` and `commit-with-til` entries, and until step 2 lands the root README still says to install both; pushed whole nobody sees it, bisected step 1 is a commit with docs behind its manifest. The move is two install lines and two table rows, and the plugin README rewrite stays the heart of step 2 either way.
  - *lean:* Yes, move those four lines into step 1 and keep step 2 for the plugin README; the carried plugin README stays stale for one commit, which [D7 (readme-carry)](#d7) already accepts.
- <a id="q6"></a>**Q6 (single-skill-wording)**: Should step 2 also retire the root README's "small single-skill utilities" wording, which jig and `ast-grep-rules` both contradict?, *resolved:* 2026-11-01, yes, folded into step 1 with the rest of the root README edit; see [D15 (root-readme-in-step-1)](#d15)
  - *plain:* The phrase appears twice, in the intro and under "Adding a plugin", and step 2 already edits that file; left alone, the README describes a bundle built to grow as a single-skill utility.
  - *lean:* Yes, "small utilities" in both places, in the same step 2 edit.
- <a id="q7"></a>**Q7 (test-hygiene)**: Should [D9 (rule-is-tested)](#d9) pin that the scratch copies live under `os.tmpdir()` and are removed, and that `disable-model-invocation` is read from the frontmatter block only?, *resolved:* 2026-11-01, yes to both; folded into [D9 (rule-is-tested)](#d9)
  - *plain:* A scratch copy written inside `plugins/jig/` would be found by `check.sh`'s test discovery and could be left behind by a failing run, and a whole-file grep would pass a SKILL.md that mentions the key in its body but not its frontmatter.
  - *lean:* Yes to both; `commit.test.mjs` already builds its repos with `mkdtempSync(tmpdir())` and removes them, so the new test follows it.
