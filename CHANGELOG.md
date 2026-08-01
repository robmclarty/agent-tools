# Changelog

All notable changes to this marketplace catalog are documented here.

This project uses [Semantic Versioning](https://semver.org/). The version tracks
the catalog itself — each listed plugin is versioned independently in its own
repository or npm package.

## 0.4.0

- Add `ast-grep-rules` plugin — adaptive structural lint for TypeScript, hosted under `plugins/ast-grep-rules`. Five skills (`/init`, `/audit`, `/rule`, `/lesson`, `/mine`) sit on four zero-dependency scripts that resolve the per-repo contract, own the rules inventory and scan modes, scaffold rule + test-fixture pairs, and install worked examples
- `/audit` is the headline path: diff the conventions a repo's docs state against the rule ids it actually enforces, and report the gaps
- A `PostToolUse` friction gate notices edits that take work back and offers `/lesson`; `/mine` reads the log back and routes each entry to wherever it can be enforced. The gate is a deterministic script rather than a prompt hook, so the trigger fires the same way every time
- Ship a technique cookbook of worked rules and tests under `examples/`, replacing the earlier opt-in starter tiers
- Add `scripts/check.sh` — the repo's single check command, running marketplace validation and `node --test` over the whole tree in one pass
- Add `scripts/scratch-repo.sh` — a throwaway-repo harness for exercising plugin skills end to end
- Extend `validate-marketplace.sh` and CI to verify that remote plugin sources carry a plugin manifest

## 0.3.0

- Remove the deprecated `trellis` plugin (superseded by ridgeline, which is a standalone CLI rather than a Claude Code plugin)
- Add per-plugin READMEs for `version` and `commit-with-til`

## 0.2.0

- Add `version` plugin — a portable, config-driven `/version` release skill hosted in this repo under `plugins/version`
- Add `commit-with-til` plugin — conventional commits with TIL extraction for code-diary, hosted under `plugins/commit-with-til`
- Support hosting single-skill plugins directly in the catalog repo via relative-path (`./plugins/<name>`) sources, in addition to npm and github
- Extend `validate-marketplace.sh` to accept relative-path sources and check local plugin layout; widen the CI path filter to `plugins/**`

## 0.1.2

- Rename the catalog repo to `agent-tools` and update the README install command; name is deliberately agent-agnostic for future multi-agent support
- Add a sunrise banner image to the README

## 0.1.1

- Correct `plumbbob` source from github to npm (it ships a compiled CLI)
- Add MIT `LICENSE` for the catalog repo
- Add `scripts/validate-marketplace.sh` and a GitHub Actions workflow validating manifest structure and source reachability

## 0.1.0

- Initial marketplace catalog with `plumbbob` (npm) and `trellis` (github) plugins
- Add `/version` skill to bump the catalog version and update this changelog
