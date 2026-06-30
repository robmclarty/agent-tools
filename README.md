# robmclarty/agent-tools

A Claude Code plugin marketplace for [Rob McLarty](https://robmclarty.com)'s tools.
It's a catalog only — each plugin lives in (and is versioned by) its own
repository or npm package; this repo just lists them.

It's a Claude Code marketplace today; the name is deliberately agent-agnostic so
the catalog can grow to cover tools for other agents later.

## Install

Add the marketplace once, then install whichever plugins you want:

```shell
/plugin marketplace add robmclarty/agent-tools
/plugin install plumbbob@robmclarty
/plugin install trellis@robmclarty
```

## Plugins

| Plugin | Source | Description |
|--------|--------|-------------|
| `plumbbob` | npm (`plumbbob`) | Attention-first build process — driver skills + a CLI that keep you the decider; guidance, not enforcement. |
| `trellis` | github (`robmclarty/trellis`) | A spec-driven development toolkit that takes features from problem framing through implementation using structured, composable skills. |

The marketplace `name` is `robmclarty`, so plugins install as `<plugin>@robmclarty`
regardless of this repository's name.

## Adding a plugin

Each entry in [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json)
points at its own source:

- **npm** — for packages that need a build/bin (e.g. plumbbob ships a compiled CLI).
  `{ "source": "npm", "package": "<name>" }`
- **github** — for pure-skill plugins with no build step. Cloned verbatim, versioned
  by commit. `{ "source": "github", "repo": "owner/repo" }`

The referenced package or repo must itself be a valid plugin
(a `.claude-plugin/plugin.json` plus `skills/`). The plugin's `name` — not this
marketplace's name — sets its command namespace (e.g. `/plumbbob:plan`).
