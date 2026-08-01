# Report — ast-grep-rules plugin

**Build:** 2026-07-24-ast-grep-rules-plugin · 18 steps · 2026-07-25 → 2026-08-01
**Status:** done. 18/18 checkpointed, check green, 0 parked, 0 open questions.

*The `## Log` in `build-log.md` is the timeline — every step's landing, and the live-fire
findings verbatim. This is the synthesis: why the build looks the way it does, what
changed its mind, and what it leaves behind.*

## What shipped

`plugins/ast-grep-rules/` — 72 files, ~6.3k lines, registered in the root marketplace.

- **Five skills.** `/init` configures any repo and bootstraps `sgconfig.yml` when absent
  (D20). `/audit` diffs stated conventions against enforced rule ids — the headline
  mechanism (D17). `/rule` scaffolds a rule *plus* fixture *plus* snapshot and refuses to
  finish red (D3). `/lesson` records friction; `/mine` classifies it into five buckets and
  routes what ast-grep structurally cannot express (D18).
- **One `PostToolUse` prompt hook** as the friction trigger (D8), with `continueOnBlock:
  true` so a fire *offers* rather than ending the turn.
- **Four scripts** over one scan core (D21): `config.mjs` resolves per-repo variance from
  `.claude/ast-grep.json` + the repo's own `sgconfig.yml`; `scan.mjs` serves both
  `--conventions` and `--lessons` from the same "what is already enforced" inventory;
  `scaffold-rule.mjs` and `install-starter.mjs`.
- **A cookbook of six worked examples**, each teaching a distinct ast-grep *capability* —
  `kind:`, `pattern:` with metavariables, `constraints:` + regex, a composite
  `all:`/`not:`, relational `inside:`/`has:` with `stopBy: end`, and `files:` scoping.
  Every one ships a passing fixture and recorded snapshot.
- **104 tests across 6 files**, plus `scripts/check.sh` (step 1) running marketplace
  validation and the suite together.

## Decisions and why

The build's shape came from one founding measurement and three reversals.

**The founding measurement (and the mechanism swap).** Four repos carried a
record→mine→promote loop, and it stalled: 15 lesson entries, *all* dated 2026-04-18/19,
nothing in the three months since, and zero rules ever mined. But six rules *were*
authored — and all six trace to a different move nobody had packaged: read a written
convention, check whether a rule enforces it, add it if not. **6 for 6 versus 0 for 6.**
So `/audit` became the headline (D17) and the lesson loop shipped as the long-tail feeder
with both stall causes fixed — a hook to trigger recording (D8), and a miner that
classifies rather than gating itself out of existence (D18). The original miner required
≥10 entries *and* ≥3 per cluster, which is why it never ran once in four repos; step 16
demonstrated the replacement running honestly at **n=1**.

**Reversal 1 — the corpus was wrong.** The plan surveyed four repos. A mid-build re-survey
found 20 repos carrying `sgconfig.yml` and 130 rules, and the four studied were the
*oldest* in the set — all dormant since April, one of them a precursor to a repo under
daily development. Thirteen repos updated since May 2026 had never been read. Six of the
seven rules the plan meant to bundle appear in **zero** live repos.

**Reversal 2 — bundling rules at all was the category error.** D14 was revised twice: two
tiers → one `essentials` tier → **a cookbook of capabilities**. The second version had
better evidence and made the same mistake, still shipping one person's taste as everyone's
floor. That produced **D23**, now the governing constraint on everything bundled: this
plugin is for anyone's workflow, not its author's. Bundled content may teach *form* and
must never ship *policy*. The test — *a reader who disagrees with its policy should still
get value from it* — is what the six examples are built to pass, and step 16 confirmed it
held under fire: six citations, **zero installs**, verified by `cmp` against all six.

**Reversal 3 — the plan's own instruction was wrong.** Step 8's live fire refused the
SKILL's guidance that "return types" route to oxlint, arguing a *missing annotation* is
plain syntax rather than resolved type information. Checked directly against ast-grep
0.45.0: the agent was right. D18's split is now *written down* (a written `any`, an `as`
cast, a missing annotation) versus *resolved* (nullability, inferred `any`) — a weaker
model following the original text would have routed a genuinely enforceable convention to
a linter the repo does not have, which is the exact silent loss the decision exists to
prevent.

**One decision kept against its own counter-evidence.** D3 requires a fixture per rule.
`testConfigs` appears in 6 of 6 April-cohort sgconfigs and **0 of 13** since — live
practice abandoned the discipline. That is recorded rather than smoothed over, read as a
discipline needing a tool to carry it. The honest risk is stated in `intent.md`: if the
tool ships and fixtures still do not get written, D3 was aspiration, not a finding.

## What the live fires paid for

Every skill was driven headlessly against a throwaway repo before its step landed, and
each run was verified against the tree — `git status`, a plain no-flag `ast-grep test`,
`cmp` — never from the agent's own report. That caught things review would not have:

- **Snapshots are not optional on the pinned ast-grep.** Planning probed 0.42.1 and made
  the `-U` pass an opt-in extra; on 0.45.0 a fixture with `invalid:` cases *fails* until
  its snapshot exists. `/rule` records three files, not two.
- **A miscount became an invented bug.** A `/mine` run counted 13 items where the scan
  emitted 14, then concluded the scan had a bug and recommended filing it. The fix was an
  honesty rule (sum the buckets; a mismatch is always a miscount) plus, later, the
  `candidates: <n>` field that removes the arithmetic.
- **Two false negatives from trusting the convenient instrument.** Counting hook stream
  events said the hook never registered — prompt hooks emit none. Asked directly whether
  it could see the conversation, the hook evaluator said *yes* — the debug log said
  `Querying model with 1 messages`. Both would have produced confidently wrong verdicts;
  `--debug-file` is what settled each.

Step 16 then drove **both loops end to end in a repo built from nothing**, which is the
truest test because it is what a new user has. Both held.

## Parked & harvested

15 items parked across the build, all harvested at the step-16 boundary, none left open.
No blockers and no pivot signals — every step landed.

- **5 closed as already delivered** by a later step than the one that parked them,
  verified against the tree before classifying rather than re-deferred.
- **5 tangent — do:** four became step 17 (partial-doc warnings, the `candidates` count,
  `path` in `--list`, and the "friction log is the only store that counts" prose), one
  became step 18 (amending the spike).
- **5 tangent — kill,** deliberately. Two were record-corrections to `intent.md` where a
  later step disproved an earlier claim. Killed on the principle that **decisions stay as
  the record of what was decided when, not as a living spec** — the artifacts are already
  correct and both findings are recorded in full in the build log.

## Open threads

**Whether a conversation-blind judge is the right judge (D8 / D15 / D19).** Step 2
established that `type: "prompt"` hooks fire, so D19's `type: "command"` fallback was
discharged — a verdict that still stands: step 16 proved the plumbing end to end, fire
through `continueOnBlock` to an offer reaching a human. What later steps bounded is the
primitive's *reach*. A `PostToolUse` prompt hook is handed one message and no tools, so
D15's first signature — *did the user just correct the assistant* — is **structurally
unobservable**, and the second is a weak proxy because ordinary iteration and real
friction produce the same shape of diff. Step 16's session showed both failure directions:
silence on the turn that carried the friction, a fire on one the model itself judged
unworthy.

No wording reaches either half. The payload does carry `transcript_path`, and a
`type: "command"` hook could read it. That is a decision, not a fix — it belongs to
`/plumbbob:refine`. Recorded in full as amendments 4–6 of
`spike-01-hook-and-paths-primitives.md`, each stamped with the step that found it.

**Deferred beyond this build.** `paths:` frontmatter is real but silently inert for
plugin-delivered skills (step 2) — worth reporting upstream, not workable around here. The
buggy `no-this-keyword` in the four source repos, and migrating those repos off their
bespoke skills, are both fleet tasks the constraints put out of scope.

## Left to the human

No version bump and no changelog — that is a `/version` call, deliberately not the
builder's. Nothing has been pushed; no PR opened.

## Checkpoints

- baseline d5264a1abd1d58e88d74eeced6b6f0366cd0494b
- plan cf811bd2815aacea9cba309f9bf790114118a85b
- step 1 2e4c5e510312c849b8f643a29dcb68a700ce7ec9
- step 2 bf1b287d584c95546b0971563861d4705a435da3
- step 3 ba57605f9d60fe68d66bfab4fe18fcf183ee3381
- step 4 9daee109b52ec4f456ca5fabfa8ece95d3506796
- step 5 2f0c74471200a6738e58c87e79bf81b7ed16121b
- step 6 d03665fd773937586c69c13fb96ba59c5b98945c
- step 7 d7a2a7b1c4d6bef01ed4f1f4b5df8633d71816e7
- step 8 21a0156a8bbaa4c401aea00d626c85f0fc6b448c
- step 9 8e238e8272071ccae107240780de59dea7008cf7
- step 10 7668b1f93af6524eba6a8e688c7926948a465f3c
- step 11 a6e0f041a4363873cce675196a22a58ff74a78bf
- step 12 7375716e6a0fc4e33fd1ad4d0ba604fbbd72f8f5
- step 13 9eddf8eaee48c078987db5f1f199d2c3f9311e8c
- step 14 a7258185720aa5ead5e36f4b5d22e62be070d9f0
- step 15 520a12de0b27471334d9c1a2a01ac70a7293518e
- step 16 78813161f15c5a01c06965ef3922db57f50d1125
- step 17 63299863d1e1b5dbae59ea1d2b5c2621aa7f5d27
- step 18 eb891cfa3a865e8a2312ac10369527131599c071

## Stats

| step | red checks | drift warnings | reverts | wall-clock |
|------|------------|----------------|---------|------------|
| 1 | 0 | 0 | 0 | 5m |
| 2 | 0 | 0 | 0 | 5206m |
| 3 | 0 | 1 | 0 | 22m |
| 4 | 0 | 0 | 0 | 62m |
| 5 | 0 | 0 | 0 | 11m |
| 6 | 0 | 1 | 0 | 1118m |
| 7 | 0 | 1 | 0 | 23m |
| 8 | 0 | 0 | 0 | 30m |
| 9 | 0 | 0 | 0 | 24m |
| 10 | 0 | 1 | 0 | 26m |
| 11 | 0 | 0 | 0 | 1968m |
| 12 | 0 | 1 | 0 | 26m |
| 13 | 0 | 1 | 0 | 27m |
| 14 | 0 | 0 | 0 | 41m |
| 15 | 0 | 0 | 0 | 10m |
| 16 | 0 | 0 | 0 | 535m |
| 17 | 0 | 1 | 0 | 11m |
| 18 | 0 | 0 | 0 | 4m |
| **total** | 0 | 7 | 0 | 9148m |
