---
name: version
description: Bump the project version via the config-driven bump engine, summarize every commit since the last release into a CHANGELOG section, and commit/tag/push per the repo's .claude/version.json. Also supports `init` to generate that config (migrating any existing bespoke version skill) and `--repair-skew` to realign version files without bumping. Use when cutting a release.
argument-hint: "[major|minor|patch | --repair-skew | init]"
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Glob, Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/bump.mjs*), Bash(git log*), Bash(git diff*), Bash(git describe*), Bash(git status*), Bash(git add *), Bash(git commit *), Bash(git tag *), Bash(git push origin *), Bash(git ls-remote*), Bash(git restore *), Bash(node -e *), Bash(date *), Bash(cat *)
---

# version

Bump the project version, prepend a changelog section summarizing every commit since
the last release, and commit — in any repo, driven by that repo's `.claude/version.json`.
The deterministic work — dirty-tree check, target resolution, semver math, every version
rewrite, previous-release detection — happens in the plugin's `bump.mjs` engine *before
this skill begins reasoning*. The skill itself only summarizes commits, drafts prose,
and runs git. All repo-to-repo variance (which files hold versions, release-marker
convention, changelog format, verify command, push behavior) lives in the config, which
the engine echoes back as `settings` — never hardcode any of it.

## Arguments

`$ARGUMENTS` — one of:

- `major`, `minor`, or `patch` — standard bump.
- `--repair-skew` — force-align every configured version file to the authoritative
  file's current version. No bump, no changelog, no commit; changes are left in the
  working tree for review. One-shot recovery when version drift is discovered.
- `init` — no writes by the engine; it emits a detection report and this skill drafts
  `.claude/version.json` from it.

No default; fail fast on anything else.

## Preflight context

- Engine result: !`node ${CLAUDE_PLUGIN_ROOT}/scripts/bump.mjs $ARGUMENTS`

The engine runs *first*, before the skill reasons about anything. By the time you read
this, one of these is true on disk:

- `mode: "bump"` — every configured version file has been rewritten to the new version.
- `mode: "repair-skew"` — non-authoritative files realigned to the current version.
- `mode: "init"` — nothing written; the JSON is a repo detection report.
- `mode: "error"` — nothing written; the JSON says why.

On a successful bump the JSON carries everything you need: `new` is the authoritative
version (**never recompute it**), `since` is the SHA of the previous release (the left
boundary for the changelog commit range; `null` means initial release), `files[]` lists
every rewrite with per-file `old`/`changed`/`skewed`, `changelog` says whether the
changelog `exists` and whether its first `##` entry is an Unreleased section to promote
(`unreleased`: its `line`, `heading`, and `has_entries`, or null), and `settings` is the repo config
with defaults applied — marker convention, changelog style, verify command, publish
behavior, and `notes` (path to a repo-local `.claude/version.md`, or null).

## Conventions

- **Run git commands directly, plain verbs.** The working directory is the repo root.
  Never use `git -C <path>` — it doesn't match the `Bash(git log*)`-style permission
  patterns and triggers a prompt for every command.
- **Use Read or Glob for file checks**, not `ls`.
- **Commit messages come from `settings.marker.commit`** with `{version}` replaced by
  the JSON's `new`. These are version-only strings (`v1.2.3`, `chore: release 1.2.3`)
  with nothing shell-hostile, so an inline `git commit -m "..."` is safe.

## Steps — bump

1. **Parse the engine JSON from preflight.** Branch on `mode`: `error` → "Steps —
   error"; `repair-skew` → "Steps — repair-skew"; `init` → "Steps — init"; `bump` →
   continue.

2. **Sanity-check the rewrite.** If `changed_count` is 0, the engine claimed success
   but rewrote nothing — stop and tell the user; don't commit. If `skew_healed` is
   non-empty, the listed files were out of step and have been force-aligned as part of
   this bump — include that fact in the final report (it's a heads-up, not an error).

3. **Fetch the commit range** using `since`:
   - SHA: `git log <since>..HEAD --no-merges --pretty=format:'%h %s'`
   - `null`: `git log --no-merges --pretty=format:'%h %s'` (initial release)

   If the range is empty, stop: nothing to release. The bump already happened on disk,
   so tell the user to `git restore` the files in `files[]` if they agree there's
   nothing to ship.

4. **Read the repo notes if present.** If `settings.notes` is non-null, Read that file —
   it holds repo-specific workflow guidance (CI publish gates, why verify is skipped,
   etc.) that the config can't express. Fold it into the remaining steps, especially
   verify and publish.

5. **Draft the changelog section** in the format `settings.changelog.style` selects,
   using the JSON's `new` for the version and `date +%Y-%m-%d` for the date.

   **If `changelog.unreleased` is non-null and `has_entries` is true, promote it rather
   than drafting.** The repo writes its entries as it goes, so they are the release
   notes: the section is the Unreleased body as written, under the release heading below
   in place of `changelog.unreleased.heading`. Don't rewrite, reorder, or reword existing
   entries. Compare the commit range against them, and add an entry only for a commit
   whose change no entry covers, in the subsection that fits (often `Internal` for
   tooling or docs), matching the existing entries' voice. If every commit is covered,
   add nothing. If `has_entries` is false, draft from commits as below and the drafted
   section takes the empty Unreleased section's place.

   The release heading and subsections, by style:

   - `sections`:

     ```markdown
     ## vX.Y.Z — YYYY-MM-DD

     ### Added
     ### Changed
     ### Fixed
     ### Internal
     ```

   - `keep-a-changelog`:

     ```markdown
     ## [X.Y.Z] - YYYY-MM-DD

     ### Added
     ### Changed
     ### Fixed
     ### Removed
     ```

     If `settings.changelog.linkRef` is set, also add a link reference line
     `[X.Y.Z]: <linkRef with {version} replaced>` directly above the previous
     version's link reference at the bottom of the file.

   - `flat`:

     ```markdown
     ## X.Y.Z

     - bullets
     ```

   Rules for the prose, regardless of style: group by impact, not by commit — collapse
   commits that together land one feature into one bullet; omit any section with no
   entries; one line per bullet; write for a reader who didn't follow the work
   ("Fixed flaky cache eviction under concurrent writes" beats "fixed bug in cache");
   reference commit hashes only when a line is genuinely ambiguous without one. If
   `since` was `null`, title it as an initial release and summarize the notable
   capabilities as they stand instead of listing all of history.

   **Print the drafted (or promoted) section back to the user** as a fenced `markdown` code block —
   the entire block, verbatim, exactly as it will be added to the changelog. This is
   their one chance to read the prose in isolation before it's committed. Continue
   automatically after printing (no wait for confirmation); if the user wants changes,
   they'll interrupt.

6. **Update the changelog** at `settings.changelog.path`. `changelog.exists` says
   whether the file existed before this step; the rollback in step 7 needs that fact.
   If `changelog.unreleased` is non-null, replace that section in place: its heading
   line becomes the release heading, and the body becomes the promoted (or drafted)
   section. For `keep-a-changelog`, put a fresh empty `## [Unreleased]` heading back
   above the new release heading, which is that format's convention; the other styles
   don't keep an empty one. Otherwise, if the file exists, insert the new section above
   the first existing `##` entry, keeping a single `# Changelog` heading (and any
   preamble) at the top; leave older entries untouched even if they use a different
   style. If it doesn't exist, create it as `# Changelog` + blank line + the new section.

7. **Verify before staging** — only if `settings.verify` is non-null. Run it exactly as
   given. A `(version strings + changelog prose)` diff can only fail narrow checks like
   markdown lint or spelling, which is why the config names one command instead of the
   full test pipeline. If it exits 0, continue. If it fails, the release must not
   happen — roll the tree back so the user can fix and re-invoke cleanly:

   - `git restore` every path in `files[].rel`.
   - The changelog: `git restore` it if it existed before step 6, `rm` it if step 6
     created it.
   - Show the failing output and stop. No retry; the user decides.

8. **Stage exactly the released files, nothing else:** every `files[].rel` plus
   `settings.changelog.path`. Then confirm via `git status --short` that nothing
   unexpected is staged — a release commit is not the place to sneak other changes in.
   If anything else appears, stop and hand it back to the user.

9. **Commit** with `settings.marker.commit`, `{version}` → the JSON's `new`, used
   literally. No extra prefix, no body — this exact message is the marker the engine
   greps for to find "the last release" on the next bump.

10. **Tag, if `settings.marker.tag` is true.** Annotated, name and message both
    `v<new>`:

    ```bash
    git tag -a vX.Y.Z -m "vX.Y.Z"
    ```

    If the tag already exists → stop and tell the user; never force-overwrite.

11. **Push, per `settings.publish`.** If both `pushTag` and `pushBranch` are false,
    skip. If `confirm` is true, first tell the user exactly what the push triggers
    (use the notes from step 4 — e.g. a tag push that starts a CI npm publish) and ask
    before proceeding; if they decline, stop here with the commit/tag local. Then:

    - `pushBranch`: `git push origin HEAD`
    - `pushTag`: `git push origin vX.Y.Z` (tag-only push also sends the commit it
      points to)

    If a push fails (network, auth): the local commit and tag exist — report the
    error, suggest re-running the push, and do not delete anything.

12. **Report.** Old version, new version (both from the JSON), commit SHA, tag name (if
    any), number of commits summarized, any skew that was healed (from step 2), and
    push/publish status including any manual follow-up the notes describe (e.g. a CI
    approval step).

## Steps — repair-skew

The engine already realigned every version file to the authoritative current version
and left the changes uncommitted. Report per-file: which were skewed (`files[].skewed`,
with their `old`), which were rewritten (`changed`). If `changed_count` is 0, report
that nothing was out of step. Do **not** commit — the changes are for the user to
review. Suggest they inspect with `git diff` and commit however they see fit.

## Steps — init

The engine emitted a detection report (`existing`, `candidates`, `markers`). Your job:
draft `.claude/version.json`, get it approved, write it.

1. **Already configured?** If `existing.config` is `"valid"`, this repo is set up —
   Read `.claude/version.json`, show it, ask what they want changed, and stop. If
   `"invalid"`, show the parse problem and propose a corrected file.

2. **Migrate the bespoke skill first.** If `existing.bespoke_skill` is non-null, Read
   it — it encodes this repo's established conventions. Extract: which files it bumps,
   the release commit message format, legacy marker patterns worth keeping (so the
   changelog range survives the migration), the changelog style, any verify command,
   and tag/push/CI behavior. These take precedence over generic inference.

3. **Otherwise infer from the detection report:**
   - `targets`: first entry = the authoritative version file. Prefer `package_json`;
     `plugin_json` becomes a secondary force-written target; `marketplace_json` →
     `.claude-plugin/marketplace.json` with key `metadata.version`;
     `version_constants` → regex targets (build the `match` literal from the reported
     line, replacing the version with `{semver}`). `package_manifests`/`version_ts` →
     `discover` glob rules rather than static entries.
   - `marker`: `markers.last_v_commit` → `"v{version}"`; `last_chore_release` →
     `"chore: release {version}"`; a different *older* convention (e.g.
     `last_chore_bump`) → add it to `legacy`. `last_v_tag` present → `"tag": true`,
     and `"tagAuthoritative": true` when tags (not commit messages) are what mark
     releases — e.g. a tag-triggered publish workflow.
   - `changelog.style` from `existing.changelog.first_release_heading` (the first `##`
     heading that isn't an Unreleased section): `## [` → `keep-a-changelog`; `## v`
     with a date → `sections`; bare `## X.Y.Z` → `flat`. If
     `existing.changelog.unreleased` is true, the repo writes entries as it goes, and
     bumps will promote that section; say so when you propose the config.
   - `verify`: only name a command you've confirmed exists (check package.json
     scripts); otherwise `null`.
   - `publish`: pushes require `markers.has_remote`; set `"confirm": true` whenever a
     push triggers external machinery (CI publish). Default everything to false when
     unsure — quieter is safer.

4. **Propose, then write.** Show the drafted JSON (and, if there's workflow prose that
   can't be declarative — CI approval gates, a reasoned "no verify needed" — a drafted
   `.claude/version.md`). On approval, Write them. This is the one interactive step in
   the plugin: config generation is judgment, so the user signs off.

5. **Wrap up.** If a bespoke skill was migrated, recommend deleting its directory so
   `/version` resolves to this plugin alone — offer to do it. If `verify` is set,
   suggest allowlisting that command in the repo's `.claude/settings.json` to avoid a
   permission prompt on each release. Suggest a dry read of the config via
   `/version --repair-skew` (harmless when nothing is skewed) or going straight to the
   first real `/version patch`.

## Steps — error

The engine made no changes. Branch on `error_type`:

- `dirty_tree` → a release commit must contain only the bump + changelog. Show the
  dirty files; suggest committing or stashing first; stop.
- `config` → no or invalid `.claude/version.json`. Suggest `/version init`; stop.
- `usage` → relay the message verbatim; stop.
- `runtime` → relay the message and stop. Don't speculate or retry. (A "does not
  contain a matching line" message means a file declared intent to participate but
  doesn't match its configured pattern — the tree was left untouched; the user fixes
  the file or the config.)

In every error case: no edits, no git operations, no retry.

## When to use this skill

- Cutting a release, even an internal one (`patch`/`minor`/`major`).
- The user asks to "bump the version", "cut a release", or "tag a new version".
- Setting up a repo: `/version init`.
- Recovering from version drift across files: `/version --repair-skew`.

## When NOT to use this skill

- Nothing has changed since the last release — step 3 finds an empty range.
- Editing an existing changelog entry or retro-tagging an old commit — different,
  manual workflows.

## Edge cases

- **No prior release** (`since: null`): summarize capabilities as an initial release,
  don't enumerate all history.
- **An Unreleased section** (`changelog.unreleased` non-null): promote it per step 5. A
  bespoke skill that drafted from commits may have hidden this habit; the engine's
  report, not the old skill's prose, says which case the repo is in.
- **A commit says `BREAKING` or `!:` but the user asked for `patch`/`minor`.** Warn and
  ask whether they meant `major` — never override silently. The bump already happened
  on disk (preflight), so switching means `git restore` of `files[].rel` and
  re-invoking `/version major`.
- **Changelog exists but has no `# Changelog` heading.** Prepend the heading plus the
  new section; leave old content untouched.
- **Merge commits in the range.** Drop them from the summary unless they introduced
  something the other commits don't cover.
- **Verify fails (step 7).** The rollback branches on whether the changelog existed
  before this run — that's why step 6 records it.
- **Mixed changelog styles.** Old entries in a different format stay as they are; only
  the new section uses the configured style.
