# Design: commit-with-til as a plugin + hosting plugins in this repo

_2026-07-19. Plan for porting `~/.claude/skills/commit-with-til` into a marketplace
plugin, and the `plugins/` restructure that also houses the `/version` plugin
([version-plugin-design.md](version-plugin-design.md))._

## Decision: own plugin, hosted in this repo

commit-with-til should be its own plugin — not folded into plumbbob or trellis. Those
have coherent philosophies and namespaces, and commit-with-til's coupling to code-diary's
TIL extraction format makes it a different kind of tool. Separate plugins also give
install granularity: `/version` belongs everywhere; commit-with-til only where code-diary
is in play.

"Own plugin" doesn't require "own repo." The marketplace currently points at external
sources (plumbbob via npm, trellis via GitHub), but `marketplace.json` also supports
relative-path sources for plugins hosted inside the marketplace repo itself. For small
single-skill utilities, a `plugins/` directory here avoids repo-per-micro-plugin
overhead. If a plugin later grows its own docs/tests/release cadence, promote it to its
own repo like trellis — only the marketplace entry's `source` changes.

## Repo restructure

```
agent-tools/
  .claude-plugin/marketplace.json      # + two entries with relative-path sources
  plugins/
    commit-with-til/
      .claude-plugin/plugin.json
      skills/commit/SKILL.md
      scripts/commit.sh
    version/
      ...                              # see version-plugin-design.md
```

Marketplace entries:

```json
{ "name": "commit-with-til", "source": "./plugins/commit-with-til", ... },
{ "name": "version",         "source": "./plugins/version", ... }
```

## Port details (from inspecting the current skill)

The current skill at `~/.claude/skills/commit-with-til/` is a SKILL.md + a deterministic
`scripts/commit.sh` (never-stage filter, stages survivors, commits from a stdin heredoc).
Three changes for the plugin port:

1. **Path rewiring.** The SKILL.md hardcodes
   `~/.claude/skills/commit-with-til/scripts/commit.sh` in both the workflow steps and
   `allowed-tools`. Both become `${CLAUDE_PLUGIN_ROOT}/scripts/commit.sh`, which Claude
   Code substitutes with the installed plugin's path.
2. **Drop `state/`.** `state/msg.txt` is leftover from the retired write-to-scratch-file
   design (the SKILL.md itself documents its replacement by the single-quoted stdin
   heredoc). Plugin installs shouldn't carry mutable state anyway.
3. **Avoid a duplicate `/commit`.** After installing the plugin version, delete
   `~/.claude/skills/commit-with-til` so only one `/commit` entry exists.

Everything else ports unchanged — the skill's design is already plugin-shaped:
preloaded git context via `` ```! `` blocks, one Bash tool call, the deterministic
never-stage guard in the script, and the documented heredoc-quoting rationale.

## Design DNA worth noting

commit-with-til and the gen-3 version skills share the same architecture, which is the
house style the marketplace's plugins should keep:

- **LLM composes prose; a script owns mechanics.** The commit message / changelog
  section is model judgment; staging, filtering, semver math, and committing are
  deterministic script work.
- **Single-quoted stdin heredoc** for passing prose to scripts — zero escaping issues
  with apostrophes, backticks, `$`.
- **One tool call** for the mechanical step; narrow `allowed-tools` patterns matched to
  exactly the commands the skill runs.
- **Typed, loud failure** (script prints reasons; skill relays and stops — no silent
  workarounds, no retries without the user).
