# Survey: the `/version` skill family across repos

_2026-07-19. Inventory and analysis of every bespoke `/version` skill on this machine,
done as groundwork for a single portable `/version` plugin hosted in this marketplace._

## Summary

Twelve `/version` skills exist across the project repos. They fall into three clear
generations, and the newest generation (script-backed, "gen 3") already embodies the
architecture a portable plugin needs: deterministic mechanics in a script, LLM judgment
only for changelog prose. The repo-to-repo variance across all twelve reduces to five
dimensions — which is what makes a single config-driven plugin feasible.

## Inventory

### Gen 1 — prompt-only (~40 lines, LLM does everything)

The model does semver arithmetic and file edits by hand with Read/Edit. Nearly identical
to each other; diffing them shows the only deltas are (a) which file holds the version,
(b) the release commit message format, (c) the grep pattern for finding the last release.

| Repo | Skill | Notes |
|---|---|---|
| storium | `.claude/skills/version/SKILL.md` | package.json; commit `vA.B.C`; finds last release with `git log --grep='v'` — matches almost any commit (known flaky) |
| mem-bridge | `.claude/skills/version/SKILL.md` | same, but commit `chore: bump version to A.B.C` |
| ts-ai-template | `.claude/skills/version/SKILL.md` | byte-identical to storium's |
| trellis / trellis-exec | `code/*/.claude/skills/version/SKILL.md` | multi-file: version synced across manifest files |
| ridgeline: hallpass, dictator-speech | `.claude/skills/version/SKILL.md` | minimal variants |
| agent-tools (this repo) | `.claude/skills/version/SKILL.md` | targets `.claude-plugin/marketplace.json` `metadata.version`; commit `vA.B.C` |

### Gen 2 — prompt + deterministic one-liners

Semver math via `node -e` or `pnpm version --no-git-tag-version`; preflight `` ```! ``
blocks load current version / last release / tree status before reasoning; repo-specific
release machinery appears.

| Repo | Distinctive features |
|---|---|
| checkride (`code/checkride`) | `node -e` for semver math ("never do the arithmetic yourself"); tag-first last-release detection via `git describe`; Keep-a-Changelog format with npm link refs; narrow verify `pnpm check --only docs,links,spell --bail` with rollback; annotated tag + tag-only push |
| volley (`code/volley`) | preflight `!` blocks; `pnpm version --no-git-tag-version`; **no tag, no push — repo has no remote**; releases marked purely by bare `vX.Y.Z` commit message; documents *why* no verify step is needed |
| ridgeline-mk2 (`code/ridgeline-mk2`) | volley-style preflight; tag-based last-release detection; notes that preflight blocks can't use `$(...)` substitution under the permission system |
| plumbbob (`code/plumbbob`) | three files (package.json + `.claude-plugin/plugin.json` + CHANGELOG); plugin.json is **force-written, never read** — self-heals skew; commit `chore: release A.B.C`; tag push triggers CI npm publish behind a required-reviewer approval gate; explicit user confirmation before the push step |

### Gen 3 — script-backed (`scripts/bump-version.mjs` + skill)

The deterministic work runs **in the skill's preflight block, before the model reasons
at all**. The script emits exactly one JSON object; the skill branches on it. By the
time the model wakes up, either the bump has happened on disk or a typed error explains
why not.

| Repo | Files | Distinctive features |
|---|---|---|
| ridgeline (`code/ridgeline`) | `scripts/bump-version.mjs`, SKILL.md (154 lines) | JSON contract `{mode, old, new, since, files, changed_count}`; dual-convention `since` detection (`vX.Y.Z` + legacy `chore: bump version to`); narrow verify (`npm run lint:markdown`) with exact rollback steps; annotated tag + tag-only push |
| fascicle (`code/fascicle`) | `scripts/bump-version.mjs`, SKILL.md | tag-first `since` detection (`git describe … --match 'v[0-9]*'` → `git rev-list`) with commit-message fallback — tag is authoritative because it triggers the publish workflow |
| weft (`code/weft`, in fascicle repo) | `scripts/bump-version.mjs`, `scripts/lib/lockstep.mjs`, SKILL.md (185 lines) | **lockstep monorepo bumping**: the set of files is *discovered, not hardcoded* — root package.json + every `packages/*/package.json` (readdir) + every `packages/*/src/version.ts` containing an `export const version = '…';` literal (packages opt in by creating the file; a file that exists but doesn't match fails loudly); skew preflight (every lockstep file must already carry the root's version); `--repair-skew` force-align recovery mode that bumps nothing and commits nothing |

## The gen-3 JSON contract

```
{ mode: 'bump',        old, new, since, files: [...], changed_count }
{ mode: 'repair-skew', old, new,        files: [...], changed_count }   // weft only
{ mode: 'error',       error_type, message }                            // dirty_tree | usage | runtime
```

`since` is the SHA of the previous release commit — the left boundary of the changelog
commit range; `null` means initial release (summarize capabilities, don't list all
history).

## Hard-won behaviors worth preserving verbatim

These are the accumulated lessons encoded in the gen-2/gen-3 skills. A portable plugin
should carry all of them:

1. **Exit 0 even on expected failure.** Ridgeline's script exits 0 for `dirty_tree`/
   `usage` errors with the JSON on stdout, because a non-zero exit makes the slash-command
   preflight swallow stdout and the skill never sees the error. (Fascicle's older copy
   still exits 1 — a bug the plugin should not inherit.) Exit 2 only for unexpected
   crashes.
2. **Dirty-tree refusal**, with the rationale spelled out: "a release commit must contain
   only the version bump + CHANGELOG; mixing in WIP is the bug we're refusing to ship."
3. **Never recompute the version in the LLM.** The JSON's `new` field is authoritative;
   the skill uses it literally in the heading, commit message, and tag.
4. **Dual-convention release-marker detection** so a repo can migrate conventions without
   breaking the changelog range (ridgeline recognizes both `vX.Y.Z` and the legacy
   `chore: bump version to X.Y.Z`).
5. **Tag-first `since` detection with commit-message fallback** (fascicle) when tags are
   the authoritative marker — correct even when the tag sits on a merge/checkpoint commit.
6. **Print the drafted changelog section verbatim** as a fenced block before touching any
   file — the user's one chance to read the prose in isolation. Continue automatically;
   the user interrupts if they want changes.
7. **Changelog prose rules:** group by impact, not by commit; collapse commits that land
   one feature into one bullet; omit empty sections; write for a reader who didn't follow
   the work ("Fixed flaky cache eviction under concurrent writes" beats "fixed bug in
   cache").
8. **Narrow verify:** only run the checks a `(version string + CHANGELOG prose)` diff can
   actually fail (markdown lint, spell, links) — the full test pipeline is wasted CPU. On
   failure, roll back with exact steps (`git restore` vs `rm` for a freshly created
   CHANGELOG — the skill notes at creation time which case applies) and stop; no retry.
9. **Stage exactly the changed files**, then confirm via `git status --short` that
   nothing unexpected is staged — "a release commit is not the place to sneak other
   changes in."
10. **Tag/push error handling:** tag already exists → stop, never force. Push fails →
    the local commit + tag exist; report, suggest re-running the push, never delete the
    tag. Push the tag ref only — branch pushes are the user's call (and pushing
    `refs/tags/vX.Y.Z` sends the commit anyway).
11. **Skew handling** (weft): preflight verifies every lockstep file already matches the
    root before bumping; `--repair-skew` force-aligns without bumping, leaving changes
    uncommitted for review. Plumbbob's cheaper variant: force-write secondary files
    without reading them, self-healing drift on every release.
12. **`BREAKING`/`!:` commit but user asked for patch/minor** → warn and ask; never
    override silently. (Gen 3 note: the bump already happened on disk in preflight, so
    switching to `major` means `git restore` + re-invoke.)
13. **Permission-system discipline:** run plain `git <verb>` (never `git -C <path>` —
    doesn't match `Bash(git log*)` patterns and prompts every time); preflight `!` blocks
    can't use `$(...)` substitution; Glob for existence checks instead of `ls`.
14. **Confirmation gates only where consequences are external** (plumbbob: pushing the
    tag triggers an npm publish pipeline, so confirm first; everything local proceeds
    without asking).

## The five variance dimensions

Everything that differs from repo to repo — the complete, empirically derived list. This
is the per-repo config schema for the portable plugin; nothing else varies:

1. **Version targets.** One JSON key (package.json `version`; this repo's
   marketplace.json `metadata.version`; plumbbob's plugin.json force-write), a
   regex/literal in source (weft's `version.ts`; a future Odin `VERSION ::` constant),
   or a discovery rule (weft's glob + opt-in pattern, so the set grows with the
   workspace).
2. **Release marker.** Bare `vX.Y.Z` commit message vs. annotated `v*` tag as
   authoritative vs. `chore: release A.B.C` commit + tag — plus legacy patterns for
   repos mid-migration. One convention drives both writing the release commit and
   finding `since`.
3. **Changelog format.** Flat `## X.Y.Z` bullets (gen 1) vs. `## vX.Y.Z — YYYY-MM-DD`
   with Added/Changed/Fixed/Internal subsections (ridgeline/volley/weft/fascicle) vs.
   Keep-a-Changelog `## [X.Y.Z] - YYYY-MM-DD` with link refs (checkride: npm version
   URLs; plumbbob: bold category labels, full-sentence bullets).
4. **Verify command.** `npm run lint:markdown` (ridgeline), `pnpm check --only
   docs,links,spell --bail` (checkride), or explicitly none with the reasoning recorded
   (volley).
5. **Publish behavior.** Nothing — no remote (volley); commit + annotated tag + tag-only
   push (ridgeline, fascicle, checkride); push branch + tag to trigger approval-gated CI
   npm publish + GitHub Release, with a user confirmation step (plumbbob).
