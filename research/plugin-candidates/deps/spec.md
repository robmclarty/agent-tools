# `deps` — dependency and vulnerability triage at fleet scale

_Spec seed, 2026-07-24. Candidate 8 of 10 from [`../../plugin-roadmap-survey.md`](../../plugin-roadmap-survey.md)._

## Problem

Sixty repos, no team, and agents that are measurably worse than humans at this specific job.

A 2026 arXiv study of agent-authored dependency PRs (`arxiv.org/html/2601.00205v1`) found:

- Agents select known-vulnerable versions **more** often than humans — **2.46% vs 1.64%**.
- Their vulnerable selections are far **more disruptive to remediate** — **36.8% require
  major-version upgrades vs 12.9%**.
- Net effect measured across the corpus: agent-driven dependency work produced a **net
  increase of 98 vulnerabilities**; human-authored work produced a **net reduction of 1,316**.

For a solo developer running Dependabot plus agent auto-merge across many small repos, that
is a live exposure with nobody in the loop to catch it.

## Why this one

Dependency and supply-chain hygiene is a thin category (17 of 2,542) — and notably, there is
no plugin that is Renovate- or Dependabot-native. The saturated neighbour is *security
scanning* (188 plugins, plus every SAST vendor), which is a different job: those scan **your**
code for injection and XSS. This is about what you pull in, which versions the agent chose,
and whether the upgrade is safe to take.

It pairs naturally with [`../fleet/spec.md`](../fleet/spec.md) — the fan-out mechanics are
shared, and "which of my 60 repos has a critical advisory" is a `fleet status` column.

## Shape

```
bin/deps                        # scan + classify across repos
skills/deps/SKILL.md            # triage and upgrade-plan reasoning
hooks/hooks.json                # PreToolUse guard on dependency edits
templates/deps.example.jsonc
```

### Two modes

**Audit** — across configured repos: outdated packages, open advisories, lockfile drift,
duplicate/conflicting versions across the portfolio, and packages that are unmaintained
rather than merely out of date. Emit a JSON contract; the skill produces a *ranked upgrade
plan*, not a list. Ranking is the product: a critical advisory in a devDependency of a
dormant repo outranks nothing.

**Guard** — a `PreToolUse` hook on `Bash(npm install *)` / `Bash(pnpm add *)` and on edits
to `package.json`. Before a dependency lands, check the chosen version against advisories.
This is the direct countermeasure to the arXiv finding, and it is the more valuable half:
audit finds problems after they exist; the guard stops the agent picking a vulnerable
version in the first place.

The guard can use **`PreToolUse` → `updatedInput`** to rewrite the version rather than block
outright — pin to the nearest safe version and say so. That is a mutation hook, which almost
nothing in the ecosystem uses.

### Config — `.claude/deps.json`

- `manager` — pnpm / npm (per repo; 14 and ~20 respectively)
- `advisory_source` — `npm audit`, OSV, or both
- `severity_floor` — what is worth surfacing
- `allow` — accepted-risk entries with a reason and an expiry date, so exceptions do not
  silently become permanent
- `guard` — whether the `PreToolUse` hook is active, and block vs rewrite vs warn

## Open questions

1. **How much does `npm audit` / `pnpm audit` already give you for free?** If the answer is
   "most of it," the plugin's whole value is the *cross-repo* view and the *guard* — which is
   fine, but it reshapes the build substantially. Answer this first.
2. Advisory data needs network access and caching. `${CLAUDE_PLUGIN_DATA}` survives plugin
   updates and is the right home; a `SessionStart` refresh is the documented pattern.
3. Is the guard too slow to sit in a `PreToolUse` path? A cached advisory database makes it
   a local lookup, but the cache has to be warm.
4. Does this overlap with `checkride`? `.check/security.json` already exists in the
   checkride artifact set — so part of the audit story may already run. **Check what
   `security.json` actually contains before designing around a gap that may not exist.**
5. Auto-merge policy is out of scope but adjacent: the arXiv finding is really about
   unattended merging, and the strongest mitigation might be "stop auto-merging" rather than
   any tool.

## Non-goals for v1

SAST / scanning your own code (188 plugins already, plus first-party `security-guidance` at
231K installs). License compliance. Actually performing upgrades unattended — propose the
plan, let the human take it. SBOM generation.

## Prior art to mine

`checkride`'s `.check/security.json` (find out what it already covers), and the `lint:knip`
/ `lint:fallow` scripts in 8 and 12 repos respectively — dead-dependency detection that
overlaps the "what can I remove" half of this. Removal is often the better answer than
upgrading, and no plugin in the thin category does it.
