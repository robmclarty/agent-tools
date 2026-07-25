# `check` — a reader for checkride's results

_Spec seed, 2026-07-24. Candidate 1 of 10 from [`../../plugin-roadmap-survey.md`](../../plugin-roadmap-survey.md)._

## Scope

**This plugin runs nothing and defines nothing. It reads checkride's output.**

[checkride](https://github.com/robmclarty/checkride) is the engine: it selects and runs the
checks, writes `.check/`, owns the schema, owns the exit codes, owns the gate hook, and owns
the failure digest. All of that is a published contract with contract tests behind it
([`docs/contract.md`](https://github.com/robmclarty/checkride/blob/main/docs/contract.md)).

This plugin is a consumer of that contract and nothing more. Anything it needs that
checkride does not already promise is a checkride feature request, not a thing to build
here.

## What checkride already provides

Established by reading `docs/contract.md`, `schema/checkride.summary.schema.json`, and the
source on 2026-07-24 (checkride 0.3.x).

**`.check/summary.json`** — the aggregate index, versioned by `schema_version` (currently
`1`), published as a JSON Schema that ships in the npm package, and governed by an
additive-only discipline: under a given `schema_version`, fields are added, never renamed,
removed, or retyped.

```jsonc
{
  "schema_version": 1,
  "timestamp": "...",              // ISO 8601
  "ok": true,                      // every check passed (skipped counts as ok) — can be vacuous
  "checks_run": 17,                // checks that ACTUALLY executed
  "total_duration_ms": 19480,
  "checks": [                      // one per selected slot, deterministic order
    {
      "name": "lint",              // slot name, or a custom check's key
      "adapter": "oxlint",         // or null when the slot resolved to nothing
      "description": "...",
      "ok": true,
      "exit_code": 0,              // -1 for spawn failure or timeout; null when skipped
      "duration_ms": 586,
      "output_file": "lint.json",  // the raw file, or null
      "skipped": true,             // present only when the check did not execute
      "reason": "...",             // why it sat out
      "baselined": 3               // present only when a committed baseline masked findings
    }
  ]
}
```

**Exit codes are a promise:** `0` pass · `1` at least one check failed (the work is not
done) · `2` the harness itself broke or was misused. A consumer may safely branch on the
1-vs-2 split.

**Vacuous green is detectable.** `ok: true` with `checks_run: 0` means nothing was verified.
`--strict` turns that into exit 2.

**Array order is deterministic** — group sequence (`first`s, numeric waves ascending,
`single`s, `last`s), then catalogue position, independent of finish order. There is no need
to invent a blocking order; the pipeline order is already in the array.

**Raw output stays authoritative.** `.check/<slot>.json` when the tool emits JSON, else
`<slot>.stdout.txt` / `<slot>.stderr.txt` — the tool's own bytes, never normalized. The
summary is an index; the raw file is the truth. Stated as the product's thesis and
explicitly will not change.

**Artifacts are crash-consistent** — atomic temp-file-then-rename. Parse without guarding
against torn JSON.

**`.check/digest.md`** — `--digest` writes a token-bounded Markdown excerpt of the *failing*
slots (default ~10 findings per slot, 8 KB ceiling, roughly two thousand tokens), each
section pointing back at its raw file. Written only when a check failed; a green `--digest`
run removes any stale digest, so **the file's existence always means "this run had
failures."**

**`checkride agent-setup`** already writes the AGENTS.md stanza and an idempotent Claude
Code `Stop` hook (`pm run check || { echo 'checkride: the gate is red …' >&2; exit 2; }`)
into `.claude/settings.json`.

**Slots:** types, format, lint, struct, dead, dupes, health, test, docs, links, spell,
mutation, security, publint, attw — plus config-defined custom checks. Opt-in slots: format,
dupes, health, mutation, security, publint, attw.

**Flags:** `--only` `--skip` `--include` `--all` `--changed` `--bail` `--json` `--digest`
`--strict` `--concurrency`.

## What is therefore explicitly NOT in this plugin

Everything below was in the first draft of this spec and is deleted, because checkride owns
it:

- ~~A `gate.mjs` engine that runs checks and emits its own JSON contract~~ — checkride is
  the engine; it already emits the contract.
- ~~A `blocking_order` field~~ — the `checks` array is already in deterministic pipeline
  order, and `order` waves are a documented contract surface.
- ~~A `Stop` gate hook~~ — `checkride agent-setup` writes it.
- ~~`PostToolUse` → `updatedToolOutput` compression of raw tool logs~~ — `--digest` is
  exactly this, already built, already token-budgeted, and better placed (it runs once per
  check run, not per tool call).
- ~~A `.claude/check.json` config with `command` / `artifact_dir` / `order` / `stale_policy`~~
  — `checkride.config.json` exists and is not this plugin's business. A reader does not need
  a config to read.
- ~~`/check init`~~ — `checkride init` exists.
- ~~Normalizing tool output~~ — the explicit anti-goal of the design being consumed.

## What is left, and whether it justifies a plugin

Three things, in descending confidence.

### 1. Replacing a copied AGENTS.md stanza with an installed skill

This is the strongest argument, and it is the same argument that produced `version` and
`commit-with-til`.

The consumption procedure — *run check, read `summary.json`, read the failing slot's raw
JSON, fix the root cause, re-run* — currently ships as a prose stanza in `AGENTS.md`, copied
into each repo by `checkride init`. Sampled 9 checkride repos: **6 carry the stanza** — and
it is a copied artifact, which means it is a drift family in waiting (see
[`../drift/spec.md`](../drift/spec.md)). A plugin makes it one installed skill, updated
centrally, in every repo at once.

### 2. Triage the contract's edge cases, which the prose stanza does not mention

The AGENTS.md stanza says "read `summary.json` to find which check failed." The contract has
sharper corners than that, and each is a wrong answer waiting to happen:

- **Vacuous green** — `ok: true`, `checks_run: 0`. The stanza would call this done. It means
  nothing ran.
- **Exit 2 vs exit 1** — a malformed config or an unknown slot in `--only` is a broken
  harness, not a red build. Treating it as "checks failed" sends the agent fixing code that
  is fine. (Note the contract's own warning: a typo like `--only lints` must never quietly
  disable the gate.)
- **`baselined: N`** — findings are grandfathered by a committed baseline. Those are real
  findings that are being deliberately ignored, and a triage read should surface the count
  rather than report clean.
- **`skipped` + `reason`** — a slot that sat out because a tool was not detected reads as
  green. Whether that is acceptable is a judgment call the agent should make explicitly.
- **`exit_code: -1`** — spawn failure or timeout, recorded as failed. Different fix from a
  genuine diagnostic.

### 3. Root-cause ordering across simultaneous failures

The array order gives pipeline sequence, not causality. When `types` and `test` both fail,
the type error is almost certainly the cause and the test failures are noise. Deciding that,
and saying so — *"fixing this one thing probably clears the other four; I am not reading
them yet"* — is model judgment, and it is the part that cannot be a script.

Note that `--bail` already covers much of this mechanically (fully sequential, stops at
first failure), and `AGENTS.md` already recommends it for the iteration loop. The plugin's
add is on a **full** run, where everything failed at once and the question is where to start.

## Shape

Small. One skill, no engine, no config.

```
skills/check/SKILL.md
```

Preflight runs the check and reads the artifacts, in contract order:

1. Run the gate. Branch on exit code first — `2` means stop and report a broken harness.
2. Read `.check/summary.json`. Verify `schema_version === 1`; if it has been bumped, say so
   and stop rather than guessing at a changed shape.
3. Check for vacuous green before anything else.
4. If `.check/digest.md` exists, read it — its presence means failures, and it is already
   the token-bounded index of them.
5. Read raw files only for the slots being triaged, following `output_file`.

Then reason: root cause, minimal fix, what is deliberately not being looked at yet, and what
is masked by a baseline.

## Open questions

1. **What command should preflight run?** The repo's `check` script is the definition of
   done and may carry deliberate `--only` / `--skip` customization — but it may not pass
   `--digest` or `--strict`. Running `checkride --digest --strict` directly is explicit but
   bypasses the repo's own selection. Leaning toward the repo's script plus a fallback to
   raw files when no digest is present; worth deciding deliberately.
2. **Pin policy.** checkride is pre-1.0 and its contract says consumers should pin exactly
   (`"checkride": "0.3.0"`, no caret) and upgrade deliberately. A plugin read against schema
   version 1 is safe by the additive-only rule, but the plugin should still assert
   `schema_version` and fail loudly rather than silently misread a future shape.
3. **Is the value large enough to be its own plugin?** Honest framing: checkride does the
   hard part. If this collapses to "one skill that reads five files carefully," that may be
   right-sized — `commit-with-til` is one skill and one script. But it is also a candidate
   to ship *inside* checkride as a bundled plugin, since checkride is already an npm package
   and npm is a supported marketplace source. **That may be the better home.** Decide before
   building.
4. **Does [`../qa/spec.md`](../qa/spec.md) belong here?** `.check/mutation.json`,
   `.check/dead.json`, `.check/health.json`, and `.check/dupes.json` already exist in the
   artifact set. A deeper read of those is arguably a second skill in this plugin rather
   than a tenth plugin.

## Scope boundary: the non-checkride repos

~16 repos depend on checkride (fascicle, lodestar ×2, paceline, plumbbob, tiny-kit,
runciter, rob-ot, volley, the five nurselog services, minga-agents, minga-kb-brain).

**Three repos hand-roll their own `scripts/check.mjs`** — `fascicle/code/weft`,
`ridgeline/code/ridgeline`, and `ts-check-scaffold/code/ts-check-scaffold` — and do not emit
checkride's schema. They are **out of scope**. Supporting them would mean either normalizing
across two contracts (against the whole design thesis) or adding the config this spec just
deleted. The right move for those three is migration to checkride, tracked separately.

`bigbigcannon/code/bbc` is a fourth non-checkride case: it has a hand-written `Stop` hook
running `check.sh` that borrows checkride's phrasing (*"big big cannon: the gate is red"*)
without the schema behind it.

## Adjacent finding: the gate is built but not deployed

`checkride agent-setup` writes the `Stop` hook, and across 9 sampled checkride repos **zero**
have it in `.claude/settings.json` — while 6 have the AGENTS.md stanza. The enforcement half
of the agent contract exists as a shipped command and has essentially never been run.

That is a **deployment** problem, not a plugin-building problem, and it belongs to
[`../fleet/spec.md`](../fleet/spec.md): `fleet run checkride agent-setup` across the 16
repos. Worth doing before building anything here, since it is one command and it changes
whether a red gate can be ignored.
