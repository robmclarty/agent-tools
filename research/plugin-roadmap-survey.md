# Survey: what to build next in this marketplace

_2026-07-24. Four parallel research streams — a plugin-ecosystem inventory, solo-developer
pain points, the current Claude Code plugin capability surface, and a full sweep of the
~60 local repos — run as groundwork for choosing the third and fourth plugins in this
catalog. Ten candidates came out of it; each has a spec seed under
[`plugin-candidates/`](plugin-candidates/)._

## Summary

Two candidates lead clearly:

- **`check`** — ~16 repos run checkride, which publishes a versioned, contract-tested
  `.check/summary.json` schema. The engine, the gate hook, and a token-bounded failure
  digest are all already built. What is missing is a *reader*: the consumption procedure
  ships as a prose stanza copied into each repo's `AGENTS.md`, which is a drift family in
  waiting. This is the lowest-risk build because the hard part is done — but see the spec,
  where the honest question is whether it should ship inside checkride rather than here.
- **`fleet`** — portfolio-level status and fan-out across many repos is the clearest
  unserved need found anywhere in the ecosystem research, and it is the vehicle that
  would finish the stalled 31-repo `/version` migration.

The catalog's two existing plugins turn out to sit in the *emptiest* categories in the
market. Of 2,542 Anthropic-vetted plugins, versioning/release-management has **4** entries
and commit-message tooling has **5**. That is the opposite of the intuition that these are
commodity problems, and it argues for continuing to pick unglamorous, deterministic,
config-driven tools over anything in the crowded middle.

## Method

Four agents, run in parallel on 2026-07-24:

1. **Ecosystem inventory** — fetched all five first-party `marketplace.json` files
   directly, scraped live install counts from `claude.com/plugins`, pulled star counts
   from the GitHub API, and keyword-clustered the vetted community pool.
2. **Pain points** — Hacker News, GitHub issues on `anthropics/claude-code`, working-dev
   blogs, one arXiv paper, and Reddit via mirror.
3. **Capability surface** — the official docs at `code.claude.com/docs/en/` (moved from
   `docs.claude.com/en/docs/claude-code/*`, which now 301s), cross-checked against the
   local CLI at v2.1.219.
4. **Local sweep** — every `.claude/skills/*/SKILL.md`, `.claude/settings*.json`, and
   `package.json` under `~/Projects/`.

Caveats are recorded at the end. Read them before treating any number here as settled.

## Ecosystem: the saturation map

Five first-party catalogs exist, not one: official (273 plugins), community (2,269),
knowledge-work (93), the demo set bundled in `anthropics/claude-code` (13), and
`anthropics/skills` (3). Saturation counts below are over a combined official + vetted
community pool of **N=2,542**.

### Saturated — stay out

| Category | Count | Note |
|---|---|---|
| Agent orchestration / multi-agent | 209 (9.2%) | Largest single cluster; 86 plugin names contain "agent" |
| Language / framework knowledge packs | 194 (8.6%) | React/Next/Django/Rails/Laravel/Vue/Flutter/Spring |
| Performance / "optimizer" agents | 193 (8.5%) | Mostly generic, no distinguishing capability |
| Security scanning | 188 (8.3%) | Plus every SAST vendor and Anthropic's own `security-guidance` (231K installs) |
| Token / cost optimization | 165 (7.3%) | A wave following caveman's success |
| Memory / context management | 164 (7.2%) | claude-mem, Remember, GoodMem, memoriant, + 160 more |
| Observability / monitoring | 159 (7.0%) | Datadog, Grafana ×3, Honeycomb, SigNoz, Sentry, PagerDuty |
| Planning / spec-driven workflow | 152 (6.7%) | Superpowers' shadow — 965K installs, everyone cloned the chain |
| Database / SQL | 132 (5.8%) | |
| Code review | 97 (4.0%) | Plus first-party Code Review at 422K installs |

### Thin — defensible

Onboarding/comprehension 24 · API/OpenAPI 19 · data/ML pipelines 19 · dependency and
supply-chain hygiene 17 · changelog/release notes 16 · incident response 16 · code
search 13 · compliance 12 · embedded 11 · flaky-test detection 10 · cost/FinOps 10 ·
monorepo tooling 10 · DB schema migration 6.

### Nearly empty — the real white space

Commit messages **5** · versioning/release **4** · i18n **5** · accessibility **2 by
name** · Kubernetes-specific **1** · multi-model/cross-agent review **~3**.

The commit and versioning findings are counter-intuitive and worth stating plainly:
everyone assumes these are commodity. They are not. First-party `commit-commands` owns
commits outright at 167K installs with no real competition; versioning has the same
dynamic *without* a first-party incumbent.

### Distribution reality

Installs are brutally power-law. Across the official top 100 (~8.42M installs): top 1 =
12.8%, top 5 = 38.5%, top 10 = 56.1%, top 20 = **76.2%**. Median at rank 50 is 25,336;
rank 100 is 3,548. Roughly 54,000 indexed plugins compete for the residual quarter.

The practical read: build for yourself first. Anything past rank ~20 is a rounding error
in the market, so external adoption is a bonus, never the justification.

## Local: what the repos actually say

46 `.claude/` directories, **93 project `SKILL.md` files**, **0** project commands, **0**
project subagents anywhere on the machine.

### The stack is homogeneous, which is what makes config-driven plugins cheap

vitest in ~48 `package.json` (the only test runner in anything modern) · oxlint in ~24 ·
**25 `sgconfig.yml` files** and `@ast-grep/cli` in ~20 · pnpm in 14, npm in ~20 · stryker
in 6 · fastify + drizzle + zod in 4 server-flavored repos · GitHub Actions in 6 · **zero**
Python, Rust, Go, or Ruby.

Script-name frequency across all `package.json`: `test` 71, `build` 41, `dev` 37,
`lint` 27, `test:watch` 25, `typecheck` 23, **`check` 23**, `lint:fallow` 12,
`check:json` 9, `lint:knip` 8, `lint:md` 7.

### The `.check/` contract is the biggest unexploited asset

`.check/` exists in **18 repos**, each holding per-tool raw JSON plus `summary.json`.
**~16 of them run checkride**, which owns the contract: a `schema_version`-ed
`summary.json` with a published JSON Schema, an additive-only field discipline, promised
exit codes (0 pass / 1 red / 2 broken harness), deterministic array ordering,
crash-consistent atomic writes, a token-bounded `--digest`, and an `agent-setup` command
that installs the `Stop` gate. All of it is backed by contract tests. checkride's stance:
*"because the consumer of the output is an LLM, checkride never normalizes diagnostics into
a common format. Each tool writes its own raw JSON to `.check/`."*

Three repos — `weft`, `ridgeline`, `ts-check-scaffold` — hand-roll their own
`scripts/check.mjs` and do **not** emit this schema. (Ridgeline's `build-check` skill reads
its own script's output, not checkride's.) They are migration candidates, not consumers.

So the gap is narrower than "nothing consumes it": the *procedure* for consuming it ships
as a prose stanza in `AGENTS.md`, present in 6 of 9 sampled repos. What is missing is
tooling — and the fact that the stanza is a copied artifact is itself the drift problem.
See [`plugin-candidates/check/`](plugin-candidates/check/spec.md).

### Convention drift is measurable and already costly

31 bespoke `/version` skills remain on disk against **2** repos carrying
`.claude/version.json` — the migration planned in [`version-plugin-design.md`](version-plugin-design.md)
is ~6% done.

The `foundry` / `gantry` / `trailhead` / `ridgeline-mk2` cluster shares a scaffold lineage
and has drifted four ways. `mine-ast-grep-rules` is byte-identical across all four (77
lines, zero drift), but `propose-ast-grep-rule` is identical in three while **gantry holds
a strictly better version** that replaced the hand-written YAML skeleton with a
`pnpm scaffold:ast-grep-rule <kebab-id>` call. That improvement has been stranded in one
dormant repo since April. `add-package` has 4 distinct hashes whose diffs are purely
cosmetic (test placement wording, tsconfig base path) — exactly the variance a config
absorbs.

Duplicated deterministic scripts awaiting the same treatment: `bump-version.mjs` ×4,
`check.mjs` ×3 (weft, ridgeline, ts-check-scaffold), `check-links.mjs` ×3.

### Two structural gaps

**Zero subagents exist** — `~/.claude/agents/` and every project `.claude/agents/` are
empty.

**The `Stop` gate is built but undeployed.** `checkride agent-setup` writes an idempotent
`Stop` hook that runs the gate and exits 2 on red — and across 9 sampled checkride repos,
**zero** have it in `.claude/settings.json`, while 6 carry the AGENTS.md stanza. The only
`Stop` gate on the machine is `bigbigcannon/code/bbc`'s, which is hand-written against
`check.sh` and borrows checkride's phrasing without the schema behind it. Deploying the
real one is one command per repo — a `fleet` task, not a build task.

## Capability surface: what is under-exploited

Verified against the docs and CLI v2.1.219 on 2026-07-24. Plugins can bundle thirteen
component types; hooks span **30 lifecycle events** and **five hook types**.

Highest-leverage primitives that almost nobody is building on:

1. **Plugin monitors** (`monitors/monitors.json`, under `experimental.monitors`) — the
   only *push* primitive a plugin can ship. Everything else waits for Claude to decide to
   act. A monitor streams stdout into the session at zero token cost until something
   happens, and `"when": "on-skill-invoke:<skill>"` lets it attach lazily. Most "watch my
   build / poll CI" plugins today burn a full model turn per poll via `/loop`.
2. **Non-`command` hook types** — `prompt` (an LLM gate with no script and no
   cross-platform shell problems), `mcp_tool` (a hook that calls the plugin's own bundled
   MCP server), `agent` (a tool-using verifier, experimental), and `http`. The docs lead
   with `command` in every example and the ecosystem stopped there. `asyncRewake` is the
   sleeper: run in the background, wake Claude on exit 2 with stderr as a system reminder.
3. **Mutation hooks** — `PreToolUse.updatedInput` rewrites a command before it runs;
   `PostToolUse.updatedToolOutput` **replaces what Claude sees as the tool result**
   (compress a 4,000-line vitest log to 20 lines of failures *before* it enters context);
   `PermissionRequest.decision.permissionRules` writes forward-looking permission rules
   from a hook; `MessageDisplay.displayContent` (v2.1.214, days old) rewrites on-screen
   rendering only.
4. **`${CLAUDE_PLUGIN_DATA}`** — a per-plugin directory that survives updates and is
   deleted only on uninstall. With the documented `SessionStart` install recipe it lifts
   the "no dependencies, pure shell or `npx`" constraint that shapes most plugin design.
5. **`bin/` executables on the Bash `PATH`** — ship a real CLI callable as a bare command,
   no `${CLAUDE_PLUGIN_ROOT}` gymnastics, no permission-rule path matching.
6. **`paths:` glob-gated skills**, **`skills:` preload on subagents** (injects full skill
   content at startup, not just the description), and **`memory: user|project|local` on
   subagents** for cross-session learning — one frontmatter line each, no visible adoption.

Three constraints worth writing down because they bite plugin authors:

- **Third-party marketplaces default to auto-update OFF.** Official Anthropic ones default
  ON. Most people who install from this catalog will sit on whatever version they first
  got. The `renames` field (added June 2026) migrates existing users if anything is ever
  restructured.
- **Plugin `settings.json` supports only `agent` and `subagentStatusLine`.** Everything
  else is silently ignored.
- **A plugin-root `CLAUDE.md` is not loaded.** Ship instructions as a skill.

## Solo-developer pain: what is still open

Already solved — don't rebuild: per-project persistent memory (shipped ~Feb 2026);
retrospective cost reporting (`ccusage`); AI code review (mature, cheap self-hosted,
saturated); multi-repo *read* access (`--add-dir` is good enough); plugin distribution.

Still open, ranked by fit to a one-person many-repo shop:

1. **Memory/convention scoping to a *subset* of repos.** There is no scope between global
   and one git root. Issue #39195, open since 26 Mar 2026; the request keeps being refiled
   and folded rather than shipped.
2. **Drift detection on deployed skill/CLAUDE.md copies.** The only solution found is a
   paid native desktop app launched July 2026 by a solo dev who hit the same wall.
3. **Portfolio / fleet view across N repos.** Nothing exists. Every thread asking for it
   gets answered with "kanban board" or, literally, "spinning plates on color-coded rods."
4. **Fleet operations** — apply one convention or upgrade across many repos. No primitive.
5. **Skill-listing truncation.** Past a token budget the listing silently truncates
   (*"Showing 30 of 39 skills due to token limits"*; one report cites 175 descriptions
   dropped). Open from Dec 2025 (#13343) through at least May 2026 (#60560).
6. **Capturing the *why* durably** — *"Git history is basically useless here. The reasoning
   lived in a prompt, not in the repo."* No convention has won.
7. **Agent-driven dependency upkeep**, which is measurably *worse* than the human baseline.

## The ten candidates

Ranked by fit. Each links to a spec seed.

| # | Candidate | Core bet | Local evidence | Market |
|---|---|---|---|---|
| 1 | [`check`](plugin-candidates/check/spec.md) | Read checkride's results, triage the gate | ~16 repos, contract published | Testing thin; flaky-detection 10 |
| 2 | [`fleet`](plugin-candidates/fleet/spec.md) | Portfolio status + fan-out across repos | 31 unmigrated version skills | **Empty** — nothing exists |
| 3 | [`drift`](plugin-candidates/drift/spec.md) | Detect + reconcile drifted skills | foundry family, 4-way drift | Only a paid desktop app |
| 4 | [`ast-grep-rules`](plugin-candidates/ast-grep-rules/spec.md) | The lessons→mine→propose loop | 4 repos near-identical, 25 sgconfig | Unrepresented |
| 5 | [`orient`](plugin-candidates/orient/spec.md) | Reawaken a dormant repo | foundry/gantry idle since April | Onboarding 24 |
| 6 | [`decisions`](plugin-candidates/decisions/spec.md) | Durable rationale capture | code-diary + TIL already ship | No convention has won |
| 7 | [`scaffold`](plugin-candidates/scaffold/spec.md) | New repo/package from canonical layout | `ts-check-scaffold` is the spec | Monorepo tooling 10 |
| 8 | [`deps`](plugin-candidates/deps/spec.md) | Fleet-scale dependency + vuln triage | 60 repos, no reviewer | Supply-chain 17 |
| 9 | [`qa`](plugin-candidates/qa/spec.md) | Mutation / dead-code / test quality | storium's 8 `qa-*` skills | Flaky-test 10 |
| 10 | [`catalog`](plugin-candidates/catalog/spec.md) | Skill-sprawl + context-budget audit | 93 project + 18 user skills | Adjacent to saturated |

## What not to build

Code review, memory/context management, agent orchestration, generic optimizer agents,
security scanning, planning/spec workflows, cost *reporting*. All either saturated,
owned by a first-party plugin with six-figure installs, or already solved well by
community tooling.

## Caveats

Recorded so nothing here reads as more settled than it is.

- **No cohort retention data exists publicly.** Nobody publishes install→30-day-active.
  The strongest available signal is that Anthropic shipped retention tooling — a "Not used
  recently" grouping (v2.1.187) for plugins unused ≥2 weeks across ≥10 sessions, per-plugin
  context-cost estimates in the install dialog (v2.1.143–145), and `/doctor` sweeps for
  dead plugins. That the product treats plugin rot as a first-class health problem is
  itself the evidence.
- **Reddit was hard-blocked** from the research environment; those threads were read
  through the redlib mirror. Post bodies and dates cross-checked clean against independent
  search snippets, but rendered upvote counts on that mirror are unreliable. **X/Twitter
  was unreachable** — no sources from it are cited.
- **Official marketplace size is unstable across sources** — a direct fetch said 273,
  ClaudePluginHub said 244, another aggregator said 236 on 2026-06-24. Real drift plus
  indexing lag, not an error, but no single number holds.
- **`claude.com/plugins` is client-side paginated**, so the install ranking covers the top
  100 only. Ranks 101+ are unmeasured.
- **No primary source describes anyone at 60-repo scale.** The largest concrete cases found
  were "six repos", "a dozen sessions", and "6 projects in parallel". The fleet problem may
  be unserved partly because few people have it yet — which cuts both ways for candidate 2.
- **The widely repeated "9,000+ plugins, only 50–100 production-ready" figure is an SEO-blog
  claim** with no primary source, and its numerator is stale by an order of magnitude.
- **Hook event introduction dates are mostly undated in the docs.** Only `MessageDisplay`
  (v2.1.214) could be dated precisely; the rest were inferred from adjacency and are
  flagged as such rather than asserted.
