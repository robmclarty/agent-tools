# Report: jig packaging fold

## What shipped

The `version` and `commit-with-til` plugins are one plugin, `jig`, under `plugins/jig/`. One range of three steps landed on 2026-11-01, each green on its first check, in nine minutes of build time.

- **The fold** (step 1, 97fe3bd). Both plugins moved with `git mv`: `bump.mjs`, `commit.sh`, both test files, and the config template as 100% renames, each `__tests__/` beside its script, and `git log --follow` reaches pre-move history for the scripts and both SKILL.md files. The two SKILL.md files gained their `version/` and `commit/` path segments at all eight script-path sites, `allowed-tools` included, and their eight bare `/version` and `/commit` mentions read `/jig:version` and `/jig:commit`. One manifest at 0.2.0 with the merged keywords, one marketplace entry in place of two, and a root README that installs `jig@robmclarty` and describes the local plugins as "small utilities". The old directories are gone.
- **The README** (step 2, aea8a0a). `plugins/jig/README.md` opens with the four-clause admission rule, one reason per clause, then carries the two old READMEs as a `version` section and a `commit` section with every invocation namespaced and every script path segmented, and closes with the one-sitting migration note.
- **The test** (step 3, 3700ad9). `plugins/jig/__tests__/admission.test.mjs` enforces the rule's two checkable clauses with two exported free functions over a plugin root, and proves each of thirteen failures against a scratch copy under `os.tmpdir()` with one violation injected, removed afterward.

The check ends `3 plugins validated, 10 test files`, from `4 plugins validated, 9 test files` at the baseline, with `scripts/check.sh` and `scripts/validate-marketplace.sh` untouched. `claude plugin validate plugins/jig` and `claude plugin validate .` both pass. Nothing in `bump.mjs` or `commit.sh` changed, `CHANGELOG.md` and the marketplace's `metadata.version` are as they were, and every repo's `.claude/version.json` still works unchanged.

## Decisions and why

- **D1 (jig-bundle)**: one plugin named `jig`, because the two skills already lean on each other, user-only skills cost a session nothing per turn so the bundle can grow, and `jig` is free in every marketplace this machine resolves (the first candidate, `dx`, collided with the work marketplace).
- **D8 (admission-rule)** and **D13 (ambient-list)**: jig admits a skill that is user-invoked only, per-repo, script-backed, and ambient-free, with ambient meaning hooks, MCP servers, LSP servers, agents, monitors, and `bin/`. The bundle is named for the rule, not for the two skills it starts with, and the rule is what tells the next candidate whether it belongs.
- **D9 (rule-is-tested)**: the two clauses that are file shapes are enforced by a test that proves each failure against a scratch copy, because a "fails when" asserted only in a comment can pass vacuously, a scratch copy inside the plugin would be found by `check.sh`, and a whole-file grep would pass a key mentioned only in prose. Per-repo and script-backed stay prose, being judgments about design.
- **D3 (pure-renames)** and **C1 (no-engine-change)**: the scripts, tests, and template move byte-identical, because neither script resolves a path from its own location and each test finds its script by a relative URL, so `git diff -M` can prove the move changed nothing they do. The v2 engine work is a separate build.
- **D4 (segment-everywhere)**: every script path in both SKILL.md files carries its new segment, because an `allowed-tools` grant that no longer matches the command turns every run into a permission prompt.
- **D14 (namespaced-names)**: the skills are written `/jig:version` and `/jig:commit` everywhere, with no bare-name note, because bare `/version` never resolved and editor autocomplete makes the namespaced form the convenient one.
- **D5 (marketplace-with-move)** and **D15 (root-readme-in-step-1)**: the marketplace swap and the root README edit land in the fold's own commit, because the validator fails the moment an entry points at a directory that is gone, and no commit should carry docs behind its manifest.
- **D7 (readme-carry)**: the version README is the one carried by `git mv`, so step 1 left it stale for one commit and step 2 rewrote it, because two files cannot share one name and the larger file's history is the one worth following.
- **D10 (migration-one-sitting)**: the migration note says to uninstall the two old plugins, install `jig@robmclarty`, change no repo config, and do it in one sitting, because the old entries left the marketplace in this build, so a half-done swap leaves a skill with no source.
- **D12 (carry-version)**: jig starts at 0.2.0, carried from `version`, because the release engine is the bundle's substance and the same code under a new name continues its count.
- **D11 (name-check-first)**: step 1 waited until `jig` was confirmed free in the work marketplace on 2026-11-01, because a collision found after the fold would mean a second rename across every repointed path.

Three reads were made in the build and recorded at the range's stop. D6 (one-description)'s quoted text names the skills bare; the shared description carries it with the two names namespaced per D14 and C9 (namespaced-only), and nothing else changed. D10 names the plugins to uninstall as `version@robmclarty` and `commit-with-til@robmclarty`, which C7 (grep-clean) forbids outside the changelog; the note names them by bare plugin name, which the CLI accepts. And step 1's seam was rewritten from `**` globs to `dir/` grants of the same meaning before `plumbbob build` would enter it; no step, decision, or done-when changed.

## Parked & harvested

| Park | Why it matters | Settled |
| --- | --- | --- |
| **P1**: [Add a jig plugin icon](build-log.md#L36) | clears the only validator warning, and the first save is the one that sets the listing icon | tangent: a listing icon is a plugin-directory concern, not the fold's, and the validator's verdict is unchanged without it |
| **P2**: [README points at admission test](build-log.md#L37) | tells the next contributor the rule is enforced, not only stated | tangent: a one-line pointer from the README to the test is a docs nicety the next docs edit can carry |
| **P3**: [Engine still says bare /version](build-log.md#L38) | the config error tells a jig user to type a command that does not resolve | tangent: the fix is an engine string change, which this build's C1 (no-engine-change) forbids and the separate v2 engine build already owns |

## Final status

Done. All three steps landed and the one range's stop was recorded with its three parks settled as tangents. The range's verdict was out of plumb on one bent constraint: C9 (namespaced-only) asks that no bare `/version` survive under `plugins/jig/`, and three lines do, two in `bump.mjs` and one in the template's comment, in files C1 (no-engine-change) and D3 (pure-renames) freeze byte-identical. Every document is namespaced and the C7 (grep-clean) grep is clean over the repo.

Left for the human, as the plan reserved them: the manual check under `claude --plugin-dir plugins/jig` (`/jig:version` with no args reaches the engine's usage output; `/jig:commit` runs its script with no permission prompt), the push, and the install swap in one sitting per the README's Migrating section. `~/.claude/settings.json` still enables the two old plugins until that swap.

## Deferred tangents

- **Add a jig plugin icon** (P1): a square PNG at `.claude-plugin/icon.png`, 512 to 2048 px, clears the validator's ICON_MISSING warning for the plugin directory listing. The first save in the developer portal is the one that sets it.
- **README points at admission test** (P2): one line in the admission-rule section of `plugins/jig/README.md` naming `__tests__/admission.test.mjs` as what enforces the user-invoked and ambient-free clauses. A docs edit for the next time that file opens.
- **Engine still says bare /version** (P3): `bump.mjs` line 3 and line 177, and the template's line 1, name bare `/version`; the config error is the user-facing one. Belongs to the v2 engine build, where the string can change without breaking the fold's byte-identical guarantee.

## Checkpoints

- baseline 4e29ebbad2bc901de5d6c916898f315ef26d233a
- plan 3d5222f4df510e45e0b2ce8e72206d1beb720997
- step 1 97fe3bd829ec4c2049e3b46e416d14d53746fd07
- step 2 aea8a0aa9b6dcf9131d1e80d4df167d61957522f
- step 3 3700ad96f3dde6ec0bb5aa46bf793225bf6cabfc

## Stats

| step | red checks | drift warnings | reverts | wall-clock |
| ---- | ---------- | -------------- | ------- | ---------- |
| 1 | 0 | 0 | 0 | 4m |
| 2 | 0 | 0 | 0 | 4m |
| 3 | 0 | 0 | 0 | 1m |
| **total** | 0 | 0 | 0 | 8m |
