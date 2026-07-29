<!--
build-log.md — your live ledger for execution. Append constantly; reorganize at
step boundaries. The antidote to "my plan got lost in the noise."

  Steps     : where you are. One step in flight at a time. CLI-maintained: `build`,
              `checkpoint`, and `revert` keep this mirror and the Current step line
              in sync with intent.md — you never hand-edit them.
  Park list : where ideas go so you do not chase them. CAPTURE, never act inline.
  Harvest   : the boundary ritual that keeps you on one branch.
  Log       : the build's history. `plumbbob checkpoint` appends a line per step as it
              lands; feeds the /pb-finish report, which rides the branch into the PR.
-->

# Build log — ast-grep-rules plugin

**Current step:** 7 — feat: add /rule to scaffold and verify a new rule
**Heavy check:** checkride (set a "check" key in .plumbbob/settings.json to override)

## Steps

*(Mirror of intent.md's Steps, with live status — CLI-maintained, not hand-edited.
`build`/`checkpoint`/`revert` re-render this from intent.md, and set the Current step
line above. Only ONE step is in flight; a step is done only after a checkpoint —
check green + checkpoint taken, via `/pb-verify` or `/pb-build`.)*

- ☑ 1. chore(check): add a repo check command over validation and script tests
- ☑ 2. spike(hooks): verify prompt-hook and paths-frontmatter support
- ☑ 3. feat: add plugin manifest, config resolver, and marketplace entry
- ☑ 4. feat: add the shared rules-inventory and scan core
- ☑ 5. feat: add the scratch-repo test harness
- ☑ 6. feat: add /init to generate config and bootstrap sgconfig
- ☐ 7. feat: add /rule to scaffold and verify a new rule
- ☐ 8. feat: add /audit to find conventions no rule enforces
- ☐ 9. feat: add /lesson to record a friction entry
- ☐ 10. feat: add a PostToolUse hook as the friction trigger
- ☐ 11. feat: add /mine to classify and route lesson candidates
- ☐ 12. feat: add the opt-in starter rulesets
- ☐ 13. docs: add the plugin README and root marketplace table row
- ☐ 14. chore: verify both loops end to end in a throwaway repo

## Park list

> Mid-step, every new problem / idea / "ooh what if" lands HERE, untouched, and you
> go straight back to the step. Acting the instant an idea arrives is the disease.
> Capture is one line (`/pb-park` composes it). Harvest happens only at the boundary.
- [ ] step 5: pin @ast-grep/cli in a root private package.json vs. install per scratch repo — decide where the harness makes the cost visible; versioning needs no package.json (marketplace.json metadata.version is authoritative)
- [ ] A local marketplace registers under the manifest's own name ('robmclarty' → source: directory, path: <abs>), which collides with the globally-registered github marketplace of the same name — so --plugin-dir is the residue-free way to load this plugin from a working tree. Worth a line in the step-13 README.
- [ ] step 14's headless verification can't observe a write under .claude/ — the harness gates it as a sensitive path and a non-interactive run has nowhere to send the prompt; either drive that leg interactively or find a scoped grant the classifier accepts
- [ ] ast-grep's snapshot requirement changed between 0.42.1 (missing snapshot tolerated) and 0.45.0 (missing snapshot fails) — the starter tiers in step 12 must ship snapshots, and the step-13 README should name a minimum ast-grep version rather than assume one

## Harvest  *(run `/pb-harvest` at each step boundary, after green)*

Classify each parked item as exactly ONE. Naming it before acting is what keeps you
from sprawling across branches.

| Class            | Meaning                                   | Action                          |
|------------------|-------------------------------------------|---------------------------------|
| **blocker**      | Plan was wrong/incomplete; can't proceed  | `/pb-revert`, fold into intent  |
| **tangent**      | A different path, not clearly better      | Defer or kill. Default here.    |
| **pivot signal** | Evidence the whole approach is wrong      | Stop. Replan deliberately.      |

> Reality check: almost everything that *feels* like a pivot is a tangent. Require a
> failed assumption, not a shinier idea, before you pivot.

Harvest results this boundary:

- (none yet)

## Log

*(The build's history, oldest first. `plumbbob checkpoint` appends a dated line here
every time a step lands — via `/pb-build` or `/pb-verify` — so this
fills in as you go, not at the end. Add your own decision/event lines too: this is what
you point at to say "I did that — the LLM helped, but those were my calls."
`/pb-finish` reads this for the report; `plumbbob finish` commits it with the build
folder, so it rides the branch into the PR.)*
- 2026-07-25 — step 1 checkpointed · 2e4c5e510 — chore(check): add a repo check command over validation and script tests (5m)
- 2026-07-25 — step 2 spike findings — full report in `spike-01-hook-and-paths-primitives.md`.
  Live-fired against Claude Code 2.1.220 with a throwaway `spikeplug` plugin (`--plugin-dir`)
  driving real `Edit` calls headlessly; schema read from the shipped binary.
  - **`PostToolUse` + `type: "prompt"` — WORKS from a plugin's `hooks/hooks.json`.** Debug
    confirms `Loading hooks from plugin: spikeplug` → `Processing prompt hook` →
    `Prompt hook condition was not met: SPIKE_REASON_MARKER_7788`. Contract:
    `{prompt, if?, timeout?, model?, continueOnBlock?, statusMessage?, once?}`; the hook LLM
    answers `{"ok": bool, "reason": "…"}`. `$ARGUMENTS` expands to the full hook-input JSON
    including `tool_input` and a `tool_response.structuredPatch` — enough signal for D15.
  - **Model vs. user.** `ok:true` sends the model *nothing* (verified: `NO FEEDBACK RECEIVED`)
    — so silence on ordinary edits is free. `ok:false` with `continueOnBlock` unset **ends the
    turn**, recording the reason as a `hook_stopped_continuation` transcript attachment that
    never reaches the `stream-json` output; with `continueOnBlock: true` the turn continues and
    the reason is fed to the model. **The hook's own prompt text is echoed back to the model
    verbatim (twice) ahead of the reason** — step 10 must author it as user-legible prose.
    Headless-only limit: interactive rendering of `statusMessage`/the attachment was not
    visually confirmed.
  - **`paths:` — real, but INERT for plugin skills.** A/B on identical frontmatter: the
    project-level `projgated` was absent from the skill inventory until a `.ts` file was
    touched (control `projplain` listed throughout), while plugin-delivered `spikeplug:gatedts`
    stayed listed *and* was fully invocable in a session forbidden from touching any file.
  - **D19 discharged, not adopted** (the `type: "command"` fallback is not needed); **D8
    confirmed** with `continueOnBlock: true` added; **D12's condition fails** → step 9 drops
    the `paths:` key.
  - Method note: prompt hooks emit **no** `hook_started`/`hook_response` stream events, so
    counting hook events reads as "never registered". `--debug-file` is the reliable
    instrument; the event stream alone yields a false negative.
- 2026-07-28 — step 2 checkpointed · bf1b287d5 — spike(hooks): verify prompt-hook and paths-frontmatter support (5206m)
- 2026-07-28 — step 3 checkpointed · ba57605f9 — feat: add plugin manifest, config resolver, and marketplace entry (1 drift, 22m)
- 2026-07-28 — step 4 checkpointed · 9daee109b — feat: add the shared rules-inventory and scan core (62m)
- 2026-07-28 — step 5 checkpointed · 2f0c74471 — feat: add the scratch-repo test harness (11m)
- 2026-07-28 — step 6 live fire — `/ast-grep-rules:init` driven headlessly against a scratch
  repo (`scripts/scratch-repo.sh`, `claude --plugin-dir`), four runs, one per branch.
  - **All three preflight branches fire correctly.** `error_type: "config"` (both files
    stripped) → configure + bootstrap, proposing both files; `error_type: "sgconfig"`
    (sgconfig only stripped) → bootstrap, writing only `sgconfig.yml`; `mode: "config"` →
    the report-only branch.
  - **The bootstrap round-trips byte-for-byte.** After the sgconfig-only run,
    `git status --porcelain` in the scratch repo was **empty** — `/init` reproduced the
    exact `sgconfig.yml` that `scratch-repo.sh` commits. The resolver then returned
    `mode: "config"` with `rules`/`tests`/`tests/__snapshots__` and zero warnings, and
    `pnpm exec ast-grep test` was green against zero rules: the bootstrapped sgconfig is
    one ast-grep actually accepts, not just one our parser accepts.
  - **The second run writes nothing.** `shasum` of both config files identical before and
    after; `git status` still empty. It reported the resolved contract and stopped.
  - **C3's approval gate is real.** Run 1 with no pre-granted approval proposed both files,
    printed a per-key table of what each value was inferred from, and *ended the turn
    asking* — it did not write.
  - **The config write is only observable interactively — and it was.** Headless runs could
    never land `.claude/ast-grep.json`: the permission layer gates anything under `.claude/`
    as a sensitive path, and a non-interactive run has nowhere to send the prompt
    (`--allowedTools 'Write'`, a `--settings` grant and a project `settings.local.json` all
    failed; `--dangerously-skip-permissions` and the broad `--settings` grant were
    classifier-blocked). Driven interactively from a stripped scratch repo it lands clean:
    `/init` took the configure+bootstrap branch, put the approval through an
    `AskUserQuestion` ("Write these two files?"), wrote **both** files on approval, re-ran
    the resolver to `mode: "config"` with zero warnings, and ran `pnpm exec ast-grep test`
    green. Afterwards `git status --porcelain` was **empty** — both files byte-identical to
    what `scratch-repo.sh` commits, so the whole strip → `/init` → resolve cycle round-trips.
    The headless limitation is parked for step 14.
  - **One defect the live fire caught and fixed.** The first run wrote
    `"convention_docs": []` because the scratch repo has no `CLAUDE.md` — an explicit
    override that switches the default off, so a repo that grows a `CLAUDE.md` later would
    silently never be audited against it. Detection now always lists `CLAUDE.md` whether or
    not it exists; the resolver reports an absent entry as `exists: false` and moves on.
- 2026-07-29 — step 6 checkpointed · d03665fd7 — feat: add /init to generate config and bootstrap sgconfig (1 drift, 1118m)
- 2026-07-29 — step 7 live fire — `/ast-grep-rules:rule` driven headlessly against a scratch
  repo (`scripts/scratch-repo.sh`, `claude --plugin-dir`), once per branch of D4.
  - **Snapshots are NOT optional on the pinned ast-grep, and the plan said they were.**
    Planning probed ridgeline (0.42.1) with `--snapshot-dir __nosnaps__` and got
    `test result: ok`, so the plan made the `-U` pass an opt-in extra. On **0.45.0**, the
    version `scratch-repo.sh` pins, a fixture with `invalid:` cases **fails** until its
    snapshot exists: `FAIL … .W`, exit 4, *"Test failed due to mismatching snapshots."*
    `test -U` records it and the plain no-flag `test` is then green;
    `--skip-snapshot-tests` is the escape hatch. So `/rule` now records the snapshot as
    part of reaching green (three files, not two), and the skill documents the `.M` vs
    `.W` markers because they point at completely different problems — a rule that does
    not match versus a rule with no recorded span. Caught by the plan's own
    "confirm on the pinned version" item; the contract changed at the pause, not silently.
  - **The scaffold is born red, and that is the D3 gate.** Straight after
    `scaffold-rule.mjs no-untyped-json-parse`, `ast-grep test` reports
    `[Missing] Expect rule … to report issues, but none found in: const TODO_REPLACE_ME_INVALID = 1`
    — the emitted YAML parses and loads, and the placeholder pattern deliberately matches
    no sample. An unfinished rule cannot masquerade as a green one without deleting the
    fixture outright.
  - **Both D4 branches reach the same end state.** `scaffold_command: null` → the plugin
    wrote both halves. `scaffold_command: "pnpm scaffold:ast-grep-rule"` (a stub added to
    the scratch repo, gantry-shaped: rule file only, no fixture) → the repo's scaffolder
    wrote the rule, `--fixture-only` wrote the fixture, and the returned
    `skipped: ["rules/…yml"]` is what kept the plugin from writing a second copy. The
    repo's house shape survived intact — its `severity: error` and uncommented
    `files: ["src/**/*.ts"]` are still there in the finished rule. A flag, not a fork.
  - **D22 holds in the artifact, both legs.** The trailing
    `// ast-grep-ignore: no-untyped-json-parse` form appears in the rule's `note:`;
    `ast-grep-ignore-next-line` appears nowhere under `rules/` or `tests/`.
  - **One template defect the unit test caught before the live fire.** The first `note:`
    named the broken `ast-grep-ignore-next-line` form in order to warn against it — which
    would bake that string into the note of every rule this plugin ever writes, for a model
    to retrieve fuzzily later. The warning moved to the SKILL (read once, by the author);
    the note now states only the form that works.
  - **One skill defect the live fire caught.** Leg B wrote a scratch `.agr-probe/probe.ts`
    into the repo for AST probing and could not remove it. The skill now says to probe
    against files that already exist and to put scratch samples in the fixture's own
    `valid:`/`invalid:` lists; leg A left the working tree clean.
  - Verified independently of the agent's own report each time: `git status`, the plain
    no-flag `ast-grep test`, and a `grep` for both suppression forms.
