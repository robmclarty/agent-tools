# ast-grep-rules plugin

**Phase:** decided — ready to build
**Size:** medium
**Scope:** ast-grep-rules

*Source: [`research/plugin-candidates/ast-grep-rules/spec.md`](../../../research/plugin-candidates/ast-grep-rules/spec.md) — candidate 4 of 10 from
[`research/plugin-roadmap-survey.md`](../../../research/plugin-roadmap-survey.md). Full spec text preserved in
[§Source](#source); the empirical findings that revised it are in [§Field evidence](#field-evidence).*

## Frame

- **Problem:** Four repos carry a loop meant to turn the agent's own mistakes into
  machine-checked conventions: record friction → mine recurring patterns → promote to an
  enforced `ast-grep` rule. It is trapped in four repos, three dormant, **and it
  stalled.** 15 lesson entries across all four, every one dated 2026-04-18/19, nothing
  in the three months since. Zero rules were ever mined. Worse, the mechanism that
  *did* produce rules is a different one nobody packaged: all six rules authored after
  the initial scaffold came from **auditing written conventions against enforced
  rules** — 6 for 6, versus 0 for 6 from mining lessons.
- **Smallest thing that solves it:** One marketplace plugin, `plugins/ast-grep-rules/`,
  built around the mechanism that actually works — `/audit`, which diffs the
  conventions your docs state against the rule ids you actually enforce. The lesson
  loop ships alongside it as the long-tail feeder, with both stall causes fixed: a
  hook to trigger recording, and a miner that classifies rather than gates itself out
  of existence. Per-repo variance lives in `.claude/ast-grep.json`, with paths derived
  from the repo's own `sgconfig.yml`.
- **Done looks like:** `/init` configures any repo, bootstrapping `sgconfig.yml` when
  absent. `/audit` names conventions no rule enforces. `/rule` scaffolds a rule **plus
  a `*-test.yml` fixture** and refuses to finish until `ast-grep test` passes. `/lesson`
  and the hook capture friction; `/mine` classifies it and routes what ast-grep cannot
  express. `scripts/check.sh` is green, the marketplace validates, and both loops have
  been driven end to end in a throwaway repo built from nothing.
- **Explicitly NOT doing:** Replacing oxlint. A curated rule library beyond the two
  explicitly opt-in starter tiers. Auto-enforcing any rule without human review. Any
  language but TypeScript. Migrating the four source repos off their bespoke skills
  (a fleet task, not this build).

## Field evidence

*(Gathered 2026-07-24 against the four live repos, then re-checked under `/pb-refine`.
This is what revised the spec — it answers all four of the spec's open questions
empirically, and one finding reversed the plan's central mechanism.)*

**The loop stalled (spec OQ1, answered).** Lesson entries: gantry 3, foundry 4,
trailhead 1, ridgeline-mk2 7 — **15 total, all within 2026-04-18/19**, none since. The
mine skill's own `mine-rules:` PR convention appears in no history anywhere. Reading:
`post-friction-lesson` fired a handful of times in one two-day burst,
`mine-ast-grep-rules` never ran at all.

**Every rule that exists came from a convention audit, not from mining.** Six rules
were authored after the initial scaffold, and all six trace to the same move — read a
written convention, check whether a rule enforces it, add the rule if not:

- ridgeline's three (`mastra-imports-only-in-runtime`, `no-commonjs`, `no-simple-git`):
  its own lesson entry says it audited `constraints.md`/`spec.md`/`taste.md` against the
  seven existing rules and found three enforceable boundaries not wired into `check`.
- foundry's three: `no-throw-in-step` cites `CLAUDE.md#result-discipline-load-bearing`;
  `no-implements-keyword` is "belt-and-suspenders for `no-class-declaration`", derived
  from an existing *rule*; `no-require` enforces a stated ESM-only convention.

**Zero came from `docs/lessons.md`.** The spec lists `conventions_path` as a config key
and the first draft of this plan used it nowhere — automating the 0-for-6 mechanism and
omitting the 6-for-6 one. Hence D17.

**Cause 1 — no trigger, confirmed in-corpus.** ridgeline's own entry documents the
failure: *"the `post-friction-lesson` skill didn't fire because none of its 'When to
use' bullets covered 'you made a wrong call and reverted it in the same session'."*

**Cause 2 — the miner gated itself out of existence.** `mine-ast-grep-rules` says
*"When NOT to use: the lessons file is short (<10 entries total)"* and requires ≥3
lessons per cluster. The largest corpus is 7 entries. Neither gate was ever reachable.

**The checkbox signal is thin and mostly self-answering.** Across all four corpora there
are 11 real `- [ ] rule:` lines (excluding the fenced template line each file carries):
7 explicit "none" or self-negating, 1 already `[x]` consumed, 1 that proposes a rule
then talks itself out of it, 1 that proposes a *check-script* rule rather than an AST
rule, and **exactly 1 genuinely promotable ast-grep candidate** (foundry's `^…$`-anchored
fence regexes). Two entries independently conclude "needs type info" — which ast-grep
structurally cannot do. The author is already performing the expressibility judgment.
Hence D18.

**The store is already machine-parseable (spec OQ2, answered).** All 15 entries conform
to a rigid template — `## YYYY-MM-DD` / `### Lesson: <title>` / `**What happened:**` /
`**What fixed it:**` / `**Potential next step:**` with `- [ ] rule:` checkboxes /
`**Related:**`. Prose is what actually gets written, and it parses.

**The "byte-identical starter pack" is smaller and dirtier than it looked (spec OQ3).**
Seven rule files are shared by filename across all four repos, but only **three** are
byte-identical in all four: `no-class-declaration`, `no-extends-inheritance`,
`no-this-keyword`. The rest drift — `no-untyped-json-parse` into three variants,
`no-cross-package-relative-import` into two, with `no-console-in-packages` and
`no-default-export` each carrying one outlier.

**That drift is corrective, and it hides a live bug.** foundry's commit `bf33067`
updated `no-default-export` and `no-untyped-json-parse` "to document the correct
suppression syntax (trailing `// ast-grep-ignore: <rule-id>`, not the older
`ast-grep-ignore-next-line` form)." Repos still on the old variants document a
suppression syntax **that does not work**. Hence D22. The same commit backfilled
snapshot fixtures for the pre-existing rules so the whole corpus is covered by
`ast-grep test`.

**`sgconfig.yml` already owns the path mapping.** 25+ files on the machine, and
`ruleDirs` genuinely varies: `rules`, `tools/ast-grep/rules`, `config/ast-grep/rules`,
`./rules`. It also carries `utilDirs` and `testConfigs: [{testDir, snapshotDir}]`.

**Rule tests exist, unevenly.** ridgeline has 10 `tools/ast-grep/tests/<id>-test.yml`
fixtures with `valid:`/`invalid:` arrays and `__snapshots__`; gantry's tests dir is
**empty** and its scaffolder emits no fixture. The discipline to generalize lives in
ridgeline; the scaffolder to generalize lives in gantry.

**Both primitives the spec recommends are unattested locally.** Every hook in every
cached plugin is `type: "command"` — **zero** `type: "prompt"` anywhere, so there is no
working example to copy and no confirmation of what a prompt hook can surface to a user.
`paths:` appears in **zero** of ~270 SKILL.md frontmatters (the keys in real use are
`description`, `name`, `allowed-tools`, `disable-model-invocation`, `argument-hint`,
`model`, `metadata`, `version`, `retrieval`, `enabled`, `validate`). Hence step 2 and D19.

**Substrate reach.** `@ast-grep/cli` in 24 repos; the `ast-grep` MCP server configured
in 8 (`uvx --from git+https://github.com/ast-grep/ast-grep-mcp ast-grep-server`).
`ast-grep` is **not** on `PATH` — a per-repo devDependency reached via `pnpm exec`.

**Skill drift to reconcile.** `mine-ast-grep-rules` is byte-identical ×4 (77 lines).
`post-friction-lesson` is identical in three; ridgeline's differs, and its diff is the
*better* one (broadened triggers, per the entry quoted above).
`propose-ast-grep-rule` is 111 lines in three, and gantry holds a better 97-line version
that calls `pnpm scaffold:ast-grep-rule <kebab-id>` instead of hand-writing YAML.

## Architecture sketch

```
   docs/conventions.md ─┐
   CLAUDE.md            ├──► /audit ──────┐        D17: 6-for-6 — the headline
   spec/constraints docs ┘                │
                                          ├──► /rule ──► <rules_dir>/<id>.yml
   ┌─ PostToolUse hook ─┐                 │             <tests_dir>/<id>-test.yml
   │ correction? undo?  │  D15, D19       │                      │
   └─────────┬──────────┘                 │                      ▼
             │ offers, never writes (C3)  │            `ast-grep test` must pass (D3)
             ▼                            │
   /lesson ──► docs/lessons.md ──► /mine ─┘        D18: classify, don't gate
                                    │
                       ┌────────────┴────────────┐
                       ▼                         ▼
             promotable → /rule        needs-type-info → oxlint type-aware
                                       wrong-mechanism → the check script
                                       declined-none / already-consumed → drop

   scripts/scan.mjs  — one core, two modes (D21)
     --conventions : stated conventions ✕ rule ids present  → /audit
     --lessons     : checkbox classification                → /mine
     both share the rules_dir inventory

   config: .claude/ast-grep.json ──reads──► sgconfig.yml (ruleDirs/testConfigs) (D2)
           /init bootstraps sgconfig when absent (D20)
           scripts/config.mjs resolves both into one JSON contract
```

## Decisions

- D1 (fix-the-stall): v1 ships the trigger and a working miner, not just a port of three
  skills — *because* the corpus proves the port alone stalls: 15 entries in one two-day
  burst, zero rules ever mined.
- D2 (sgconfig-derived-paths): `rules_dir`, `utils_dir`, `tests_dir` and `snapshot_dir`
  are read from the repo's `sgconfig.yml`, never duplicated in `.claude/ast-grep.json` —
  *because* ast-grep already owns that mapping and duplicating a varying path invites skew.
- D3 (fixture-required): a rule is not done until `<tests_dir>/<id>-test.yml` exists with
  `valid:`/`invalid:` cases and `ast-grep test` passes — *because* it is the only
  verification that survives the conversation.
- D4 (scaffold-capability-flag): rule scaffolding prefers the repo's configured
  `scaffold_command`, else the plugin writes the YAML itself — *because* gantry's
  improvement generalizes as a capability flag, not a fork.
- D5 (opt-in-starter-pack): bundled rules are always explicitly opt-in, never default —
  *because* defaulting them on would make this the rule library the spec's non-goals refuse.
- D6 (mining-is-inventory): `scan.mjs` does inventory and classification, not similarity
  clustering — *because* the template parses and the checkbox already carries the signal,
  while clustering across a 7-entry corpus is noise.
- D7 (prose-store-stays): `docs/lessons.md` stays append-only prose in the established
  template — *because* prose is what actually gets written, and it already parses.
- D8 (prompt-hook-trigger): the friction trigger is a `PostToolUse` hook of
  `type: "prompt"` — *because* an LLM gate needs no script, no deps and no cross-platform
  shell, and the corpus documents the skill failing to self-fire. **Confirmed by step 2**,
  with one addition the spike forced: `continueOnBlock: true`, without which a fired hook
  ends the turn instead of offering. Its prompt is echoed to the model verbatim, so it is
  authored as user-legible prose.
- D9 (ast-grep-via-config): every ast-grep invocation goes through a configured
  `ast_grep_command`, default `pnpm exec ast-grep` — *because* the binary is a per-repo
  devDependency, not on `PATH`.
- D10 (typescript-only): TypeScript-only for v1, stated as a deliberate limit — *because*
  the whole portfolio is TS (zero Python, Rust, Go, Ruby).
- D11 (local-path-plugin): hosted here as `plugins/ast-grep-rules/` with a relative-path
  source — *because* it needs no build step, and promotion later changes only `source`.
- D12 (glob-gated-lesson): **retired by step 2** — `/lesson` ships *without* `paths:`.
  The key is real and does gate project-level skills, but is silently ignored for
  plugin-delivered skills, which is how this plugin ships (D11) — *because* carrying
  frontmatter that implies gating which never happens is worse than omitting it. Discovery
  rests on `description:` (D16) and the hook trigger (D8).
- D13 (generalize-the-better-variant): where the four repos disagree, generalize from the
  better variant — gantry's 97-line `propose`, ridgeline's broadened `lesson` triggers —
  *because* the majority version is only a majority by copy-paste.
- D14 (starter-tiers): the starter pack ships as two separately-offered tiers, neither
  default — `hygiene` (`no-untyped-json-parse`, `no-cross-package-relative-import`,
  `no-console-in-packages`) and `functional-style` (`no-class-declaration`,
  `no-this-keyword`, `no-extends-inheritance`, `no-default-export`) — *because* the seven
  shared rules are two different kinds of claim and only one is defensible to a stranger.
- D15 (hook-precision): the hook matches `Edit|Write` on source paths and its gate asks
  one narrow question — did the user just correct the assistant, or did the assistant just
  undo its own recent change — offering, never writing, tuned against a real session in
  step 14 — *because* an eager hook gets dismissed, which is worse than silence since it
  also costs tokens.
- D16 (short-commands): skills are `init`, `audit`, `lesson`, `mine`, `rule` under plugin
  `ast-grep-rules`, with discovery riding the `description:` field — *because*
  `/ast-grep-rules:post-friction-lesson` is 34 characters for the thing that most needs
  to be frictionless.
- D17 (audit-is-the-headline): `/audit` — diff the conventions stated in
  `conventions_path`, `CLAUDE.md` and any named spec docs against the ids present in
  `rules_dir` — is the plugin's headline mechanism; the lesson loop is the long-tail
  feeder — *because* 6 of 6 rules ever authored came from convention audits and 0 from
  mining lessons.
- D18 (classify-not-threshold): the miner classifies every checkbox into `promotable` /
  `declined-none` / `needs-type-info` / `wrong-mechanism` / `already-consumed`, routing
  `needs-type-info` toward oxlint type-aware — *because* the real yield is 1 promotable in
  11, and two entries independently hit ast-grep's type-blindness.
- D19 (hook-fallback): **discharged by step 2, not adopted.** `type: "prompt"` fires
  correctly from a plugin's `hooks/hooks.json`, so the `type: "command"` fallback is not
  built — *because* the primitive D1's stall fix rests on is now attested by live fire.
- D20 (sgconfig-bootstrap): `/init` offers to write a minimal `sgconfig.yml`
  (`ruleDirs: [rules]` plus a `testConfigs` entry) when none exists — *because* refusing
  every non-ast-grep repo caps reach at 25 and breaks greenfield, including our own harness.
- D21 (one-scan-core): `scripts/scan.mjs` owns the rules-dir inventory and serves both
  `--conventions` and `--lessons` modes — *because* both mechanisms need the same "what is
  already enforced" answer.
- D22 (ship-corrected-variants): where the shared rules drift, the starter tiers ship
  foundry's variants — *because* foundry's `bf33067` fixed the suppression syntax to
  trailing `// ast-grep-ignore: <rule-id>`, and the `ast-grep-ignore-next-line` form the
  other repos document does not work.

## Constraints

- C1 (no-new-deps): zero runtime dependencies; plain Node scripts, as `bump.mjs` and
  `commit.sh` already are — *the repo has no `package.json` at all.*
- C2 (marketplace-contract): the plugin must carry `.claude-plugin/plugin.json` plus
  `skills/`, be registered in `.claude-plugin/marketplace.json`, and pass
  `scripts/validate-marketplace.sh` — that script is the CI gate.
- C3 (no-writes-without-review): nothing auto-enforces a rule; the hook offers, the
  skills propose, the human approves.
- C4 (ast-grep-not-global): never assume `ast-grep` on `PATH` — always the configured
  command (D9).
- C5 (repo-docs-parity): a new plugin needs a per-plugin README, a root README table row,
  and a marketplace entry — the convention set by commit `759980c`.
- C6 (four-repos-read-only): gantry, foundry, trailhead and ridgeline-mk2 are read-only
  source material. This build never writes to them, and nothing in it depends on another
  repo being present to run.
- C7 (hermetic-tests): every check runs from fixtures inside this repo or a scratch repo
  the harness builds — *because* a test that reads a sibling project passes on this
  machine and nowhere else, and CI has no siblings at all.
- C8 (no-vendored-internals): fixtures are hand-authored to reproduce the template
  *shapes*, not copies of the real corpora — *because* this repo is public and those
  entries carry project-internal detail that has no business being published here.

## Steps

1. [x] chore(check): add a repo check command over validation and script tests — **done when:** `bash scripts/check.sh` exits 0 on the current tree, reports 3 plugins validated and 0 test files, `.plumbbob/settings.json` names it as `check`, and CI runs it
   - seam: `scripts/check.sh`, `.plumbbob/settings.json`, `.github/workflows/validate.yml`
   - model: sonnet — mechanical; wraps an existing script and globs for `node --test` files

2. [x] spike(hooks): verify prompt-hook and paths-frontmatter support — **done when:** the build log records, for each, whether it works and what its contract is: does `PostToolUse` accept `type: "prompt"`, what reaches the user versus the model, and does `paths:` gate skill activation — each confirmed by a live fire from a throwaway plugin install, not from docs alone; D19's fallback is explicitly discharged or adopted
   - seam: `.plumbbob/builds/2026-07-24-ast-grep-rules-plugin/build-log.md`
   - model: opus — unattested territory, and the fallback shape is a design call D8/D12 depend on

3. [x] feat: add plugin manifest, config resolver, and marketplace entry — **done when:** `bash scripts/check.sh` prints `ok ast-grep-rules -> ./plugins/ast-grep-rules` (so registration covers every later step), and `node --test` proves `config.mjs` resolves three fixture sgconfig layouts — `tools/ast-grep/rules` with `testConfigs`, a bare `ruleDirs: [rules]` with no tests dir, `config/ast-grep/rules` — plus the missing-file error path
   - seam: `plugins/ast-grep-rules/.claude-plugin/plugin.json`, `plugins/ast-grep-rules/scripts/config.mjs`, `plugins/ast-grep-rules/scripts/__tests__/`, `plugins/ast-grep-rules/templates/ast-grep.example.jsonc`, `.claude-plugin/marketplace.json`
   - model: opus — the config contract every later step reads, plus a dependency-free `sgconfig.yml` subset parser (D2, C1)

4. [x] feat: add the shared rules-inventory and scan core — **done when:** `node --test` proves `scan.mjs --lessons` sorts a fixture corpus reproducing the real 11-checkbox mix into D18's five buckets with exactly one `promotable` and two `needs-type-info`, ignores the fenced template line, and that `scan.mjs --conventions` flags a stated convention with no matching rule id while staying silent on one already enforced
   - seam: `plugins/ast-grep-rules/scripts/scan.mjs`, `plugins/ast-grep-rules/scripts/__tests__/`
   - model: opus — one core serving both mechanisms (D21), and the classifier is the fix for stall cause 2

5. [x] feat: add the scratch-repo test harness — **done when:** `bash scripts/scratch-repo.sh <dir>` builds a throwaway repo (git init, `@ast-grep/cli`, minimal sgconfig, two `.ts` files, seeded `docs/lessons.md`) where `ast-grep test` runs clean against zero rules and the plugin resolves from this working tree; running it twice leaves no residue
   - seam: `scripts/scratch-repo.sh`
   - model: sonnet — mechanical shell; every later step's checkable surface depends on it (C7)

6. [x] feat: add /init to generate config and bootstrap sgconfig — **done when:** in a harness repo stripped of its sgconfig, `/init` offers and writes both `sgconfig.yml` and `.claude/ast-grep.json`, `config.mjs` reads them back, and a second run reports already-configured instead of overwriting
   - seam: `plugins/ast-grep-rules/skills/init/SKILL.md`
   - model: sonnet — patterned on `/version init`, plus the D20 bootstrap offer

7. [x] feat: add /rule to scaffold and verify a new rule — **done when:** in a harness repo it produces both `<id>.yml` and `<id>-test.yml` and `ast-grep test` passes; the same run with `scaffold_command` unset writes the YAML directly and reaches the same state; the emitted `note:` documents the trailing `// ast-grep-ignore: <id>` form
   - seam: `plugins/ast-grep-rules/skills/rule/SKILL.md`, `plugins/ast-grep-rules/scripts/scaffold-rule.mjs`
   - model: opus — the fixture-plus-verification contract (D3), the capability flag (D4), and D22's correction

8. [x] feat: add /audit to find conventions no rule enforces — **done when:** in a harness repo seeded with a conventions doc stating three enforceable conventions of which one already has a rule, `/audit` reports exactly the two unenforced, cites where each is stated, and hands them to `/rule`
   - seam: `plugins/ast-grep-rules/skills/audit/SKILL.md`
   - model: opus — the headline mechanism (D17); judging what counts as a stated, structurally-enforceable convention is the real work

9. [x] feat: add /lesson to record a friction entry — **done when:** invoking it appends a template-conforming entry at `lessons_path` that `scan.mjs --lessons` parses back with the right title and bucket
   - seam: `plugins/ast-grep-rules/skills/lesson/SKILL.md`
   - model: sonnet — a port; carry ridgeline's broadened triggers (D13) and `paths:` only if step 2 confirmed it (D12)

10. [x] feat: add a PostToolUse hook as the friction trigger — **done when:** in a harness repo, built to whichever shape step 2 confirmed (D8 or D19), a deliberate correction turn produces the offer and three ordinary edits in a row produce none
    - seam: `plugins/ast-grep-rules/hooks/hooks.json`
    - model: opus — trigger precision is the whole value; too eager and it trains the user to dismiss it (D15)

11. [ ] feat: add /mine to classify and route lesson candidates — **done when:** run against the step-4 fixture corpus it reports all five buckets, declines the entry with no AST form, routes both `needs-type-info` entries toward oxlint type-aware rather than dropping them, and hands the single promotable one to `/rule`
    - seam: `plugins/ast-grep-rules/skills/mine/SKILL.md`
    - model: sonnet — the deterministic work already happened in step 4

12. [ ] feat: add the opt-in starter rulesets — **done when:** each tier installs independently, every bundled rule ships a fixture, `ast-grep test` passes on both tiers in a harness repo, and declining both leaves zero rule files written
    - seam: `plugins/ast-grep-rules/starter-rules/hygiene/`, `plugins/ast-grep-rules/starter-rules/functional-style/`, `plugins/ast-grep-rules/skills/init/SKILL.md`
    - model: sonnet — mechanical; the tiers are fixed by D14 and the variants by D22

13. [ ] docs: add the plugin README and root marketplace table row — **done when:** `bash scripts/check.sh` is green, the per-plugin README documents both mechanisms and both tiers, and the root README table carries its row
    - seam: `plugins/ast-grep-rules/README.md`, `README.md`
    - model: sonnet — patterned on `plugins/version/README.md`

14. [ ] chore: verify both loops end to end in a throwaway repo — **done when:** in a harness repo, `/audit` → `/rule` promotes one stated convention to a rule with a passing fixture, **and** hook → `/lesson` → `/mine` → `/rule` promotes one induced friction event; both transcripts land in the build log and the scratch dir is removed
    - seam: `.plumbbob/builds/2026-07-24-ast-grep-rules-plugin/build-log.md`
    - model: opus — the whole finding is that this stalls in practice; a from-scratch repo is also the truest test, since it is what a new user has (C7)

## Open questions

*(All eight resolved 2026-07-24 — the substance moved into Decisions; see §Verdicts.)*

- Q1 (starter-pack-tiers): one set or named tiers? — *resolved:* 2026-07-24, two tiers → D14
- Q2 (hook-trigger-precision): what does the hook watch for? — *resolved:* 2026-07-24, narrow two-signature gate → D15
- Q3 (command-surface): what are the skills called? — *resolved:* 2026-07-24, short names → D16
- Q4 (conventions-audit-is-the-real-mechanism): audit or mine as headline? — *resolved:* 2026-07-24, audit leads → D17
- Q5 (checkbox-yield): what is the threshold calibrated against? — *resolved:* 2026-07-24, classify into five buckets → D18
- Q6 (capability-spike): do prompt hooks and `paths:` exist? — *resolved:* 2026-07-24, spike it as step 2 → D19
- Q7 (verification-scaffolding): what gates steps 4–9, and where does the scratch repo come from? — *resolved:* 2026-07-24, register early + a committed harness → steps 3 and 5
- Q8 (greenfield-bootstrap): what does `/init` do without an sgconfig? — *resolved:* 2026-07-24, offer to create one → D20

## Verdicts

- 2026-07-24 — v1 scope: port-only vs. fix-the-stall → chose **fix both causes** because
  the corpus shows the port alone already stalled once.
- 2026-07-24 — bundled rules: none vs. opt-in vs. hygiene-only → chose **opt-in**, then
  refined to **two named tiers** (D14) once the "8 byte-identical rules" claim turned out
  to be 7 files of which only 3 actually match.
- 2026-07-24 — rule done-when: MCP-verified vs. fixture-required → chose **fixture
  required** (D3), generalizing ridgeline's discipline over gantry's empty tests dir.
- 2026-07-24 — verification target: live sibling repo vs. temp scratch → chose **temp
  scratch**, added C6/C7/C8. The first draft used ridgeline-mk2 as the test bed, which
  meant writing to an unrelated live project and needing a constraint exception to allow
  it. A from-scratch repo is also the truer test.
- 2026-07-24 — **headline mechanism: mine-lessons vs. audit-conventions → chose audit**
  (D17). `/pb-refine` traced all six post-scaffold rules to convention audits and none to
  lesson mining. The first draft automated the 0-for-6 mechanism and omitted the 6-for-6
  one; `/audit` is now step 8 and the lesson loop is the long-tail feeder.
- 2026-07-24 — miner design: recurrence threshold vs. classifier → chose **classifier**
  (D18), because the real corpus yields 1 promotable candidate in 11 checkboxes and two
  entries hit ast-grep's type-blindness, which a threshold would silently drop.
- 2026-07-24 — unattested primitives → **spike before building** (step 2, D19). Zero
  `type: "prompt"` hooks and zero `paths:` frontmatter keys exist locally, and D8 is half
  of D1's stall fix.
- 2026-07-25 — **step 2 spike, partial verdict** (`spike-01-hook-and-paths-primitives.md`):
  prompt hooks **work** from a plugin's `hooks/hooks.json` — D8 confirmed (plus
  `continueOnBlock: true`), D19 discharged. `paths:` **works for project skills but is inert
  for plugin skills** — D12 retired, step 9 drops the key. Live-fired against Claude Code
  2.1.220 with a throwaway plugin, not read from docs.
- 2026-07-24 — repairs applied: the shared-rule count corrected from 8 byte-identical to
  7 files with 3 matching; the drift recorded as *corrective*, with foundry's
  `// ast-grep-ignore: <rule-id>` suppression fix now binding on the starter tiers (D22).

## Source

*Verbatim spec text, preserved so this plan stands without it.*

> # `ast-grep-rules` — the adaptive structural-lint loop
>
> _Spec seed, 2026-07-24. Candidate 4 of 10 from `../../plugin-roadmap-survey.md`._
>
> ## Problem
>
> Four repos carry a three-skill loop that turns recurring friction into enforced structural
> lint rules:
>
> 1. **`post-friction-lesson`** — after a correction, append the lesson to `docs/lessons.md`.
> 2. **`mine-ast-grep-rules`** — cluster accumulated lessons, find the ones that recur.
> 3. **`propose-ast-grep-rule`** — promote a cluster to a real `tools/ast-grep/rules/*.yml`.
>
> It is a genuinely good mechanism: the agent's mistakes become machine-enforced conventions
> instead of prose nobody rereads. It is trapped in four repos, three of which are dormant.
>
> ## Why this one
>
> **Lowest design risk in the set.** `mine-ast-grep-rules` is byte-identical across all four
> repos — 77 lines, zero drift. `post-friction-lesson` is identical in three. There is almost
> nothing to reconcile.
>
> **Reach far exceeds the four.** `@ast-grep/cli` appears in ~20 repos and there are **25
> `sgconfig.yml` files** on the machine. The loop is deployed in 4; the substrate is in 25.
>
> **Market:** structural lint is essentially unrepresented. The saturated categories are
> security scanning (188) and generic "optimizer" agents (193); adaptive, project-specific
> structural rules mined from your own correction history is not a thing anyone ships.
>
> It also carries a live drift case worth fixing on the way in: `propose-ast-grep-rule` is
> 111 lines in three repos, but **gantry has a better 97-line version** that replaced the
> hand-written YAML skeleton with `pnpm scaffold:ast-grep-rule <kebab-id>`. Generalize from
> gantry, not from the majority.
>
> ## Shape
>
> ```
> skills/post-friction-lesson/SKILL.md
> skills/mine-lessons/SKILL.md
> skills/propose-rule/SKILL.md
> scripts/mine.mjs                    # clustering — deterministic, not model work
> templates/ast-grep.example.jsonc
> ```
>
> The clustering step is currently model work and probably should not be. Grouping lesson
> entries by similarity, counting recurrences, and ranking by frequency × recency is
> mechanical. Let the script emit candidate clusters with evidence; let the model judge which
> clusters are actually expressible as an AST pattern — that part is real judgment, since
> plenty of good lessons ("this API is confusing") have no structural form.
>
> ### Config — `.claude/ast-grep.json`
>
> The variance across the four repos is genuinely tiny:
>
> - `lessons_path` — `docs/lessons.md`
> - `conventions_path` — `docs/conventions.md` (present in 5 repos)
> - `rules_dir` — `tools/ast-grep/rules/` vs `rules/`
> - `scaffold_command` — `pnpm scaffold:ast-grep-rule` if available, else write YAML directly
>   (this is the gantry improvement; make it a capability flag, not a fork)
> - `sgconfig` — path to `sgconfig.yml`
>
> ## Primitives worth using
>
> - **`paths:` glob-gated skill activation.** `post-friction-lesson` should be available when
>   editing source, not when editing docs. Costs nothing when irrelevant.
> - **`PostToolUse` hook** as the friction trigger. Today the lesson gets recorded only if
>   you remember to invoke the skill — and the research is blunt that self-authored skills
>   rarely fire unprompted: *"It's very rare that it will pick a skill unprompted... It's just
>   silent failure."* A hook that notices a correction pattern and offers to record it closes
>   the loop that currently depends on discipline.
> - **`type: "prompt"` hook** for that detection — an LLM gate with no script, no
>   dependencies, and no cross-platform shell problems. The ecosystem uses `type: "command"`
>   almost exclusively; this is a good first use of the alternative.
>
> ## Open questions
>
> 1. **Is the loop actually working in the four repos, or did it stall?** Check the git
>    history of `docs/lessons.md` and `tools/ast-grep/rules/` — how many rules were actually
>    promoted, and when? If the answer is "two rules in April," the mechanism needs rethinking
>    before it gets packaged, and the honest finding is that the loop is aspirational.
> 2. Is `docs/lessons.md` the right store? It is append-only prose in 4 repos. A structured
>    format would make mining deterministic, but prose is what actually gets written.
> 3. Should rules be shareable across repos, or are they inherently project-specific? Some
>    ("never use `git -C` in a skill's Bash block") are universal. That points at a bundled
>    starter ruleset plus per-repo mined rules.
> 4. ast-grep is TypeScript-shaped here. Fine — the whole portfolio is TS. Worth stating as a
>    deliberate scope limit rather than pretending otherwise.
>
> ## Non-goals for v1
>
> Replacing oxlint. A rule *library* — the value is that rules are mined from this specific
> project's friction, not curated from someone else's best practices. Auto-enforcing newly
> mined rules without review.
>
> ## Prior art to mine
>
> `gantry/code/gantry/.claude/skills/propose-ast-grep-rule/SKILL.md` (the better variant —
> generalize from this one), `foundry/code/foundry/.claude/skills/mine-ast-grep-rules/SKILL.md`
> (byte-identical across four, so any copy works), and the `docs/lessons.md` +
> `docs/conventions.md` files in the four repos as the corpus this must actually handle.
