# robmclarty/agent-tools

![Sunrise over an island silhouette across the water](sunrise.jpg)

A Claude Code plugin marketplace for [Rob McLarty](https://robmclarty.com)'s tools.
Larger plugins live in (and are versioned by) their own repository or npm
package and are only cataloged here; small single-skill utilities are hosted
directly in this repo under [`plugins/`](plugins/).

It's a Claude Code marketplace today; the name is deliberately agent-agnostic so
the catalog can grow to cover tools for other agents later.

## Install

Add the marketplace once, then install whichever plugins you want:

```shell
/plugin marketplace add robmclarty/agent-tools
/plugin install plumbbob@robmclarty
/plugin install trellis@robmclarty
/plugin install version@robmclarty
/plugin install commit-with-til@robmclarty
```

## Plugins

| Plugin | Source | Description |
|--------|--------|-------------|
| `plumbbob` | npm (`plumbbob`) | Attention-first build process — driver skills + a CLI that keep you the decider; guidance, not enforcement. |
| `trellis` | github (`robmclarty/trellis`) | A spec-driven development toolkit that takes features from problem framing through implementation using structured, composable skills. |
| `version` | this repo (`plugins/version`) | Portable `/version` release skill — a deterministic, config-driven bump engine plus one invariant workflow that adapts to any repo via `.claude/version.json`. Run `/version init` once per repo to generate the config. |
| `commit-with-til` | this repo (`plugins/commit-with-til`) | Conventional commits with TIL extraction for code-diary — a deterministic never-stage filter script plus a one-tool-call `/commit` skill. |

The marketplace `name` is `robmclarty`, so plugins install as `<plugin>@robmclarty`
regardless of this repository's name.

## Adding a plugin

Each entry in [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json)
points at its own source:

- **npm** — for packages that need a build/bin (e.g. plumbbob ships a compiled CLI).
  `{ "source": "npm", "package": "<name>" }`
- **github** — for pure-skill plugins with no build step that warrant their own repo.
  Cloned verbatim, versioned by commit. `{ "source": "github", "repo": "owner/repo" }`
- **local path** — for small single-skill utilities hosted in this repo under
  `plugins/`. `"source": "./plugins/<name>"` (a relative-path string). If one
  outgrows this repo, promote it to its own repo and only the `source` changes.

The referenced package, repo, or directory must itself be a valid plugin
(a `.claude-plugin/plugin.json` plus `skills/`). The plugin's `name` — not this
marketplace's name — sets its command namespace (e.g. `/plumbbob:plan`).
[`scripts/validate-marketplace.sh`](scripts/validate-marketplace.sh) checks the
manifest structure (and local plugin layout) in CI.
