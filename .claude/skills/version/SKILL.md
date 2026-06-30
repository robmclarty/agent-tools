---
name: version
description: Bump the marketplace catalog version (major, minor, or patch) and add a changelog entry. Use when preparing a release, bumping the marketplace version, or the user says "/version".
allowed-tools: Read Edit Bash(git:*)
---

Bump the marketplace catalog version using semver. Accepts one argument: `major`, `minor`, or `patch`.

This version tracks the catalog itself (the list of plugins), not the individual
plugins — each plugin is versioned independently in its own repo or npm package.

## Semver rules

Given a version `MAJOR.MINOR.PATCH`:

- `patch` → increment PATCH, e.g. 0.4.6 → 0.4.7
- `minor` → increment MINOR, reset PATCH, e.g. 0.4.6 → 0.5.0
- `major` → increment MAJOR, reset MINOR and PATCH, e.g. 0.4.6 → 1.0.0

## Files to update

1. `.claude-plugin/marketplace.json` — the `metadata.version` field
2. `CHANGELOG.md` — new version section inserted at the top

## Steps

1. If no argument is provided, ask the user which bump type they want (major, minor, or patch).
2. Read `.claude-plugin/marketplace.json` to get the current `metadata.version`.
3. Compute the new version according to the semver rules above.
4. Tell the user: "Bumping version from X.Y.Z to A.B.C"
5. Update the `metadata.version` field in `.claude-plugin/marketplace.json` using the Edit tool.
6. Run `git log --format='%s%n%n%b' <last-bump-hash>..HEAD` where `<last-bump-hash>` is the most recent version-bump commit (find it with `git log --oneline -E --grep='^v[0-9]+\.[0-9]+\.[0-9]+' -1`). If no such commit exists, use all commits from the beginning of history. Use the commit subjects and body descriptions as context to write a concise bullet-point list of significant changes for the new version entry.
7. Read `CHANGELOG.md` and insert a new version section immediately after the `# Changelog` heading (before the first existing `##` entry) using the Edit tool:

   ```markdown
   ## A.B.C

   - Summary of change 1
   - Summary of change 2
   ```

8. Report the updated version.
9. Stage the changed files and commit with the message: `vA.B.C`
