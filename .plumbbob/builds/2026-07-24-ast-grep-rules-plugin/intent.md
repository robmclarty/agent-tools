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
- **Explicitly NOT doing:** Replacing oxlint. **Shipping a curated rule library, or any
  bundled rule an adopter is expected to adopt** — what ships is a cookbook of worked
  examples teaching what ast-grep can express (D23, D14). Auto-enforcing any rule without
  human review. Any language but TypeScript. Migrating the source repos off their bespoke
  skills (a fleet task, not this build).

## Field evidence

*(Gathered 2026-07-24 against four repos, then re-checked under `/pb-refine`. This is
what revised the spec — it answers all four of the spec's open questions empirically,
and one finding reversed the plan's central mechanism. **Re-based 2026-07-30** against
the whole portfolio; read §Portfolio re-survey first, because it supersedes every claim
below about which rules to bundle.)*

### Portfolio re-survey (2026-07-30)

**The four-repo survey was the wrong corpus for rule sourcing, and it is now known why.**
20 repos on this machine carry an `sgconfig.yml`, holding **130 rules** between them.
The plan looked at four of them — gantry, foundry, trailhead, ridgeline-mk2 — and those
four are the *oldest* in the active set: all last touched 2026-04-18/19, all dormant.
foundry in particular is a precursor to **fascicle**, which is under daily development.
Thirteen repos have been updated since May 2026 and none of them was read.

**Six of the seven bundled rules appear in zero live repos.** Against the thirteen
repos updated since May, the shipped tier membership scores:

| Bundled rule | Live repos carrying it |
|---|---|
| `no-default-export` | **12 / 13** |
| `no-untyped-json-parse` | 0 |
| `no-cross-package-relative-import` | 0 |
| `no-console-in-packages` | 0 |
| `no-class-declaration` | 0 |
| `no-this-keyword` | 0 |
| `no-extends-inheritance` | 0 |

**What the live cohort actually enforces**, by how many of the thirteen carry it:
`no-class` 12, `no-default-export` 12, `require-js-extension` 7,
`no-deep-sibling-import` 7, `no-logic-in-barrel` 5, `no-this` **2**. Sixty-four distinct
rule ids in all — the long tail is per-repo architecture, as the spec's non-goals predict.

**The real byte-identical starter pack is `no-class`, and it is one rule, not three.**
`no-class` is byte-identical in **8 of the 12** repos that carry it — a far stronger
consensus than anything in the April corpus, where the plan settled for three matching
files out of seven. And it is one rule doing the work the April cohort split across
`no-class-declaration` + `no-this-keyword` + `no-extends-inheritance`: the live
formulation is `any: [class_declaration, abstract_class_declaration]` with the message
*"Prefer functional/procedural style over classes. Use modules and closures instead."*
`no-this` survives in exactly two repos (volley, paceline). The preference is
functional-over-OOP; policing `this` was a April-cohort elaboration that did not spread.

**`checkride` is the distilled starter pack, empirically.** Updated 2026-07-30, it holds
exactly five rules — `no-class`, `no-default-export`, `require-js-extension`,
`no-deep-sibling-import`, `no-logic-in-barrel` — and they are exactly the five most
common rules across the whole live cohort. A fresh repo's whole ruleset *is* the answer
to "what should a starter tier contain." Hence D14 (revised).

**The fixture discipline was dropped, not adopted.** `testConfigs` appears in **6 of 6**
of the April-cohort sgconfigs and in **0 of 13** since. This is direct counter-evidence
to D3, and it is recorded rather than smoothed over — see D3 for why the decision stands
anyway.

**The rule idiom changed.** Live rules use `language: typescript` (lowercase), carry **no
`note:` block at all** — the `message:` is a block scalar holding the whole explanation
plus a pointer to a real docs file — and scope with `files: src/**/*.ts` rather than a
long `ignores` list. They run 8–20 lines where foundry's run 40. **None of the live rules
documents a suppression form anywhere**, which is what leaves foundry's `bf33067` still
the only place in the corpus that gets the syntax right (D22).

### The 2026-07-24 four-repo survey

*(Still the right corpus for the **lesson loop** — those four are the only repos that
ever carried the bespoke `post-friction-lesson` / `mine-ast-grep-rules` /
`propose-ast-grep-rule` skills, so the stall evidence below stands unchanged. Its claims
about **which rules to bundle** are superseded by the re-survey above.)*

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
  verification that survives the conversation. **Held 2026-07-30 against direct
  counter-evidence:** `testConfigs` is in 6 of 6 April-cohort sgconfigs and 0 of 13
  since, so live practice has abandoned this entirely. That is read as a discipline
  needing a tool to carry it rather than a discipline that was wrong — which is this
  plugin's whole thesis, and the one thing it can supply that a hand-rolled rules dir
  cannot. The honest risk is stated rather than hidden: if the tool ships and fixtures
  still do not get written, D3 was aspiration, not a finding.
- D4 (scaffold-capability-flag): rule scaffolding prefers the repo's configured
  `scaffold_command`, else the plugin writes the YAML itself — *because* gantry's
  improvement generalizes as a capability flag, not a fork.
- D5 (opt-in-bundled-content): nothing bundled is ever written without an explicit
  request naming it, and there is no default — *because* defaulting anything on would
  make this the rule library the spec's non-goals refuse. **Still binding after the
  2026-07-30 reframe**, and now the weaker of two guards: D23 means the bundled content
  carries no policy to opt into in the first place.
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
- D13 (generalize-the-better-variant): where repos disagree, generalize from the better
  variant — gantry's 97-line `propose`, ridgeline's broadened `lesson` triggers —
  *because* the majority version is only a majority by copy-paste. **Amended
  2026-07-30:** "better" means *more recent*, not *better argued*, whenever the two
  conflict. The four-repo majority was four copies of one April snapshot; the live
  cohort is thirteen repos that kept editing. For skill text the four remain the only
  source (they are the only repos that carried the skills); for rule text the live
  cohort wins outright.
- D14 (cookbook-not-tier): **revised twice on 2026-07-30; this is the standing version.**
  What ships is a **cookbook of worked examples**, not a ruleset. Roughly six rules, each
  chosen to demonstrate a distinct *ast-grep capability* rather than a policy: `kind:`
  matching, `pattern:` with metavariables, `constraints:` + regex, a composite
  `all:`/`regex:`/`not:`, a relational `inside:`/`has:` with `stopBy: end`, and `files:`
  scoping. Each ships a passing fixture, states **what it demonstrates**, and names **the
  preference it encodes** so it cannot be mistaken for a default — *because* what blocks
  an adopter is not the absence of a ruleset, it is not knowing what ast-grep can
  express (D23).

  Framed *adapt, don't adopt*: `/rule` and `/audit` cite the examples when authoring, and
  the install offer becomes "want one of these as a starting point?" rather than "adopt
  this tier."

  Two superseded versions, kept because the reasoning is the record:
  - *v1:* two tiers, `hygiene` and `functional-style`, from seven rules shared across the
    four April repos. Six of those seven appear in **zero** live repos — sound reasoning
    on a dead corpus.
  - *v2:* one tier, `essentials`, holding checkride's five. Better evidence, same category
    error: it still shipped one person's taste as everyone's floor.
  - The `this` finding survives both and constrains the examples. The April cohort split
    the functional/procedural claim across `no-class-declaration`, `no-this-keyword` and
    `no-extends-inheritance`; the live cohort states it once as `no-class`,
    byte-identical in 8 of 12, with `no-this` in 2 of 13. So where an example needs a
    ban-a-construct shape it uses the single-rule form — as an *illustration of `kind:`
    matching*, labelled as a style choice the reader need not share.

- D23 (general-purpose-not-personal): **the governing constraint on everything bundled,
  added 2026-07-30.** This plugin is for anyone's workflow, not its author's. Bundled
  content may teach *form* — how to express a structural claim, how to fixture it, how to
  suppress it — and must never ship *policy* the adopter is expected to accept. The live
  corpus is inspiration and evidence, never a payload: read to learn what a well-formed
  rule looks like, not copied so adopters inherit someone's taste in classes and default
  exports. *Because* the value the spec claims is that rules are mined from **this**
  project's friction and **this** project's stated conventions — shipping a preference
  set contradicts the product's own argument. Test for any bundled file: a reader who
  disagrees with its policy should still get value from it.
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
- D22 (ship-corrected-variants): **re-based 2026-07-30.** The tier ships the **live
  cohort's** variants, taking `checkride`'s text as the reference where a rule drifts —
  *because* `no-class` is byte-identical in 8 of 12 live repos and checkride is the most
  recently edited copy, where foundry is a dormant precursor to fascicle whose text
  nothing has carried forward.

  The suppression finding survives the re-base and is now the tier's own contribution
  rather than a copied variant: foundry's `bf33067` is still the **only** place in the
  whole 130-rule corpus that documents the working trailing `// ast-grep-ignore:
  <rule-id>` form. None of the live rules mentions suppression at all. So the bundled
  rules add that line themselves — it is knowledge the portfolio has and keeps losing,
  which is exactly what a bundled rule is for.

  Two idiom shifts come with the re-base: `language: typescript` lowercase, and the
  explanation living in a block-scalar `message:` rather than a separate `note:`.

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
- C6 (source-repos-read-only): every other repo on this machine is read-only source
  material. This build never writes to any of them, and nothing in it depends on another
  repo being present to run. **Widened 2026-07-30** from the original four (gantry,
  foundry, trailhead, ridgeline-mk2) — the rule evidence now comes from the whole
  20-repo, 130-rule corpus, with `checkride`, `fascicle` and `plumbbob` as the live
  references and the original four kept only as the lesson-loop corpus.
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

11. [x] feat: add /mine to classify and route lesson candidates — **done when:** run against the step-4 fixture corpus it reports all five buckets, declines the entry with no AST form, routes both `needs-type-info` entries toward oxlint type-aware rather than dropping them, and hands the single promotable one to `/rule`
    - seam: `plugins/ast-grep-rules/skills/mine/SKILL.md`
    - model: sonnet — the deterministic work already happened in step 4

12. [x] feat: add the opt-in starter rulesets — **done when:** each tier installs independently, every bundled rule ships a fixture, `ast-grep test` passes on both tiers in a harness repo, and declining both leaves zero rule files written
    - seam: `plugins/ast-grep-rules/starter-rules/hygiene/`, `plugins/ast-grep-rules/starter-rules/functional-style/`, `plugins/ast-grep-rules/skills/init/SKILL.md`
    - model: sonnet — mechanical; the tiers are fixed by D14 and the variants by D22
    - note: landed against the **superseded** D14/D22, on the 2026-07-30 re-survey. The installer, its suite and the `/init` offer are sound and survive untouched; the seven rules it bundled came from a dead corpus and are replaced by step 13.

13. [x] feat: replace the starter tiers with a technique cookbook — **done when:** `examples/` holds ~6 worked rules covering `kind:`, `pattern:`+metavariables, `constraints:`+regex, composite `all:`/`regex:`/`not:`, relational `inside:`/`has:` with `stopBy: end`, and `files:` scoping; each carries a fixture and recorded snapshot, a **demonstrates:** line and an **encodes:** line naming the preference it embodies; `ast-grep test` passes on the set in a harness repo; both tier directories are gone; the offer in `/init` reads *adapt, don't adopt* and installs only an example the user names; and a reader who rejects every policy in the set can still learn each technique from it (D23)
    - seam: `plugins/ast-grep-rules/examples/`, `plugins/ast-grep-rules/scripts/install-starter.mjs`, `plugins/ast-grep-rules/scripts/__tests__/install-starter.test.mjs`, `plugins/ast-grep-rules/skills/init/SKILL.md`
    - model: opus — the technique coverage is the design work, and D23 has to be enforced by something a test can check rather than by good intentions; the regex-composite and relational examples are also where a `valid:` case is most likely to be wrong

14. [x] feat: point /rule and /audit at the cookbook when authoring — **done when:** both `skills/rule/SKILL.md` and `skills/audit/SKILL.md` carry the catalogue in preflight (`install-starter.mjs --list`, which already returns each example's `demonstrates` and `uses`) plus a section mapping the shape of a claim to the example that demonstrates the technique for it; in a harness repo, `/audit` naming an unenforced convention says which technique would express it and cites the example, and `/rule` scaffolding a ban-a-construct id points at the `kind:` example before writing YAML; and every citation is by reference — read the file under `examples/` — never by install, so a run that cites three examples still writes zero rule files
    - seam: `plugins/ast-grep-rules/skills/rule/SKILL.md`, `plugins/ast-grep-rules/skills/audit/SKILL.md`
    - model: sonnet — the catalogue step 13 built already carries the technique-to-example mapping; both skills' hard parts are written, and this adds a lookup, not a mechanism

15. [x] docs: add the plugin README and root marketplace table row — **done when:** `bash scripts/check.sh` is green; the per-plugin README documents both mechanisms in D17's order (`/audit` as the headline, the lesson loop as the long-tail feeder), presents `examples/` as six worked techniques you adapt rather than a ruleset you adopt — naming no recommended subset — and carries an authoring section holding the three findings this build paid for: the `@ast-grep/cli` version it is tested against and why a missing snapshot is now fatal where it once was tolerated, `--plugin-dir` as the residue-free way to load the plugin from a working tree (a local marketplace registers under the manifest's own name and collides with the same-named registered one), and the fact that a rule matching comment nodes cannot be suppressed by an ignore embedded in the comment it matches; and the root README table carries its row
    - seam: `plugins/ast-grep-rules/README.md`, `README.md`
    - model: sonnet — patterned on `plugins/version/README.md`; the three findings are transcription from the park list, not derivation

16. [ ] chore: verify both loops end to end in a throwaway repo — **done when:** in a harness repo, `/audit` → `/rule` promotes one stated convention to a rule with a passing fixture, **and** hook → `/lesson` → `/mine` → `/rule` promotes one induced friction event; both transcripts land in the build log and the scratch dir is removed
    - seam: `.plumbbob/builds/2026-07-24-ast-grep-rules-plugin/build-log.md`
    - model: opus — the whole finding is that this stalls in practice; a from-scratch repo is also the truest test, since it is what a new user has (C7)

## Open questions

*(All eight resolved 2026-07-24 — the substance moved into Decisions; see §Verdicts.)*

- Q1 (starter-pack-tiers): one set or named tiers? — *resolved:* 2026-07-24, two tiers → D14; **reopened and re-resolved 2026-07-30:** neither — a technique cookbook, no bundled policy at all (D14 v3, D23)
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
- 2026-07-30 — **rule corpus: four repos vs. the whole portfolio → the portfolio** (D14,
  D22, D13, C6 revised; §Portfolio re-survey added). The four surveyed repos turned out
  to be the four *oldest* in the active set — all dormant since 2026-04-18/19, with
  foundry a precursor to fascicle. Twenty repos carry ast-grep and 130 rules; thirteen
  have been edited since May and none was read. Six of the seven rules step 12 bundled
  appear in **zero** live repos. Prompted by Rob, who flagged foundry as stale.
- 2026-07-30 — **tier shape: two tiers vs. checkride's five → checkride's five** (D14).
  `checkride`, updated the same day, carries exactly five rules and they are exactly the
  five most common across the live cohort — a fresh repo's whole ruleset is already the
  starter pack, so the tier needs no taxonomy invented for it. Cost: the
  defensible-to-a-stranger / house-style split that justified two tiers is dropped.
- 2026-07-30 — **`this`: policed vs. not → not** (D14). Live data and stated preference
  agree: `no-class` is in 12 of 13 repos and byte-identical in 8 of 12, while `no-this`
  is in 2 of 13. The April cohort's three-rule split of the functional/procedural claim
  is one rule now. The preference is functional-over-OOP, not a rule about a keyword.
- 2026-07-30 — **bundled content: a ruleset vs. a cookbook → cookbook** (D14 v3, D23 and
  the Frame's non-goals). Rob: *"I don't want this plugin to simply copy what is in these
  repos, only be inspired by them... not everyone wants no-class, that's just my own
  personal preference. This plugin needs to be general-purpose and flexible."* Both
  earlier tier designs failed the same test in different ways — v1 shipped a dead corpus's
  taste, v2 shipped a live corpus's taste, and taste was never the thing to ship. What an
  adopter is actually missing is knowledge of what ast-grep can express, so the bundle
  teaches capability and labels every policy it touches as optional. Checked while
  deciding: the rest of the plugin is already preference-neutral — `/audit` reads the
  adopter's own docs, `/rule` scaffolds from a blank red template, every path comes from
  the adopter's `sgconfig.yml` — so the fix is contained to one directory.
- 2026-07-30 — **D3 under counter-evidence: hold vs. soften → hold.** `testConfigs` is
  in 6 of 6 April sgconfigs and 0 of 13 since — the fixture discipline was abandoned, not
  spread. Held anyway, on the reading that it is a discipline needing a tool to carry it,
  which is the plugin's thesis. Recorded in D3 as a stated risk rather than smoothed away.

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
