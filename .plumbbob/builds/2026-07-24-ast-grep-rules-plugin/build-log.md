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

**Current step:** 17 — fix(ast-grep-rules): close the four gaps the live fires found
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
- ☑ 7. feat: add /rule to scaffold and verify a new rule
- ☑ 8. feat: add /audit to find conventions no rule enforces
- ☑ 9. feat: add /lesson to record a friction entry
- ☑ 10. feat: add a PostToolUse hook as the friction trigger
- ☑ 11. feat: add /mine to classify and route lesson candidates
- ☑ 12. feat: add the opt-in starter rulesets
- ☑ 13. feat: replace the starter tiers with a technique cookbook
- ☑ 14. feat: point /rule and /audit at the cookbook when authoring
- ☑ 15. docs: add the plugin README and root marketplace table row
- ☑ 16. chore: verify both loops end to end in a throwaway repo
- ☐ 17. fix(ast-grep-rules): close the four gaps the live fires found
- ☐ 18. docs: amend spike-01 with what steps 10 and 16 found

## Park list

> Mid-step, every new problem / idea / "ooh what if" lands HERE, untouched, and you
> go straight back to the step. Acting the instant an idea arrives is the disease.
> Capture is one line (`/pb-park` composes it). Harvest happens only at the boundary.
- [x] step 5: pin @ast-grep/cli in a root private package.json vs. install per scratch repo — decide where the harness makes the cost visible; versioning needs no package.json (marketplace.json metadata.version is authoritative)
- [x] A local marketplace registers under the manifest's own name ('robmclarty' → source: directory, path: <abs>), which collides with the globally-registered github marketplace of the same name — so --plugin-dir is the residue-free way to load this plugin from a working tree. Worth a line in the step-13 README.
- [x] step 14's headless verification can't observe a write under .claude/ — the harness gates it as a sensitive path and a non-interactive run has nowhere to send the prompt; either drive that leg interactively or find a scoped grant the classifier accepts
- [x] ast-grep's snapshot requirement changed between 0.42.1 (missing snapshot tolerated) and 0.45.0 (missing snapshot fails) — the starter tiers in step 12 must ship snapshots, and the step-13 README should name a minimum ast-grep version rather than assume one
- [x] all three /audit live fires independently flagged it: a convention_docs entry pointing at a file that doesn't exist produces no warning — scan.mjs conventions mode should say which configured docs it skipped, not just which it read (config.mjs already carries the exists flag)
- [x] Amend spike-01 with step 10's two live-fire findings: PostToolUse prompt hooks get no transcript (Stop only), and if: is a free pre-LLM permission-rule filter whose brace alternation is silently inert
- [x] scan.mjs --lessons states `entries` but not the item count, so /mine has to derive the total by summing `buckets`; a `candidates: <n>` field would remove the hand-count that made a live-fire run miscount and then invent a scan bug to explain it
- [x] the four source repos still carry the buggy no-this-keyword: its note claims a `this: void` parameter is exempt but the rule flags it — a fleet fix, out of this build's scope
- [x] D22 picked foundry's rule variants from a 4-repo survey that missed fascicle (foundry's successor, committed daily, 23 rules) — the conclusion survives but the stated rationale is stale; /plumbbob:refine when convenient
- [x] D22's suppression claim does not hold on ast-grep 0.45.0: '// ast-grep-ignore-next-line: <id>' behaves identically to '// ast-grep-ignore: <id>' (both scoped to the named id, both suppress the following line) — foundry's bf33067 rationale is version-specific at best; the cookbook notes document the trailing form without repeating the 'the other one is broken' claim
- [x] a rule matching comment nodes cannot be suppressed by an ignore embedded in the comment it matches — ast-grep reads a comment starting its own line as a directive for the NEXT line, so '// TODO: x // ast-grep-ignore: id' leaves the TODO flagged and the suppression unused; worth a line in the step-14 README's authoring section
- [x] D14 also says /rule and /audit should cite the examples when authoring; step 13's seam covered only /init, so both skills still scaffold and propose without pointing at the cookbook — a one-section addition to each
- [x] install-starter.mjs --list returns ids but no paths, so /rule and /audit hard-code examples/rules/<id>.yml and examples/tests/<id>-test.yml in prose — a path: field in the --list JSON would make the layout single-sourced
- [x] step 16: D15's 'did the user correct the assistant' signature is unobservable to a prompt hook (one diff, no dialogue) and 'did the assistant undo its own change' is a weak proxy — it stayed silent on the real correction and fired on a turn the model itself judged unworthy; a command hook could read transcript_path, so this reopens D19 and is /plumbbob:refine work, not a prompt tweak
- [x] step 16: blocked from docs/lessons.md, the child agent silently recorded the lesson in its own auto-memory instead — friction diverts to a store /mine never reads; /lesson or the hook prose could say 'the log file is the only store that counts'

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

**2026-07-31 — boundary after step 16. All 15 parked items harvested, none left open.**
No blockers and no pivot signals: every step landed, and both loops held under live fire.
Five items turned out to be **already delivered** by a later step than the one that parked
them — verified against the tree before classifying, so that work was closed rather than
re-deferred. The remaining ten are all **tangent**; Rob split them five to do and five to
kill — the kill list reads as four bullets because the two D22/D19 record-corrections
share one.

**Closed — delivered by a later step** (no class; the work exists)

| Item | Delivered by | Verified |
|---|---|---|
| `--plugin-dir` as the residue-free load path | step 15 | `plugins/ast-grep-rules/README.md` |
| ast-grep version + why a missing snapshot is fatal | step 15 | same README, authoring section |
| comment-node ignores cannot suppress from inside | step 15 | `README.md:179–183` |
| `/rule` and `/audit` cite the cookbook when authoring | step 14 | `--list` preflight in both SKILLs |
| D22's stale four-repo rationale (missed fascicle) | the 2026-07-30 refine | D22 now re-based on the portfolio |

**tangent — do**

- **`convention_docs` pointing at a missing file warns nobody.** The highest-value item in
  the list: `scan.mjs --conventions` audits one doc while the config claims two, silently.
  Flagged independently by all three step-8 live fires and again by step 16 — four runs, no
  prompting. `config.mjs` already carries the `exists` flag, so the fix is reporting what it
  already knows.
- **`scan.mjs --lessons` states `entries` but no item count.** A `candidates: <n>` field.
  Cheap, and it has already cost something real: a step-11 run miscounted by hand and then
  invented a scan bug to explain its own arithmetic.
- **`install-starter.mjs --list` emits no `path`.** Confirmed at harvest — the keys are
  `demonstrates, encodes, files, id, path_scoped, severity, uses` — so `/rule` and `/audit`
  hard-code the `examples/` layout in prose. A `path:` field single-sources it.
- **Friction diverted to auto-memory.** A step-16 sub-agent blocked from `docs/lessons.md`
  wrote the lesson into its own memory store and reported it as recorded. One line in
  `/lesson` or the hook prose: the log file is the only store that counts.
- **Amend spike-01.** Confirmed unamended at harvest. It now owes three findings, not two —
  step 10's pair, plus step 16's discovery that a prompt hook cannot see the conversation at
  all.

**tangent — kill**

- **D22's suppression claim, and the D19 reopening.** Both are places where `intent.md`
  still asserts something a later step disproved: that `ast-grep-ignore-next-line` is broken
  (it behaves identically on 0.45.0), and that D19's command-hook fallback is safely
  discharged (step 16 found the prompt hook cannot observe half of D15's gate). Killed
  deliberately — the artifacts are already correct, the cookbook notes never repeat the false
  claim, and both findings are recorded in full in this log's step-7 and step-16 entries.
  Decisions stay as the record of what was decided when, not as a living spec.
- **Root `package.json` for `@ast-grep/cli`.** The status quo is what C1 already implies.
- **Headless runs cannot observe writes under `.claude/`.** A harness limit, already worked
  around by driving that leg interactively in step 6.
- **The buggy `no-this-keyword` in the four source repos.** C6 puts them out of scope; fleet
  work, not this build's.

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
- 2026-07-29 — step 7 checkpointed · d7a2a7b1c — feat: add /rule to scaffold and verify a new rule (1 drift, 23m)
- 2026-07-29 — step 8 live fire — `/ast-grep-rules:audit` driven headlessly against a scratch
  repo (`scripts/scratch-repo.sh`, `claude --plugin-dir`), three runs. The repo was seeded
  with a conventions doc stating three enforceable conventions (one already carrying a rule)
  plus two distractors; the skill is read-only by construction — no `Write`, no `Edit` in
  `allowed-tools` — so unlike step 6 this ran headlessly with no permission-layer problem.
  - **The done-when holds, and the prose leg is what proves D17.** The deterministic first
    pass (`scan.mjs --conventions`) sees only normative *bullet* lines, so one of the two
    unenforced conventions was seeded as a **prose paragraph** and is invisible to it —
    the scan returns 1 enforced (unverified) and 3 unenforced, of which only one is a real
    gap. All three runs recovered the prose convention by reading the doc, reported exactly
    the two unenforced ones with `path:line` citations plus a proposed id and both samples,
    and offered them to `/rule`. A skill that just relayed the JSON would have found one gap
    and missed the one being violated in `src/parse-config.ts` right now.
  - **The live fire refuted the plan's own instruction, and it was right.** Run 1 was seeded
    with "every exported function must declare an explicit return type" as a
    `needs-type-info` distractor, and the SKILL listed "return types" as a canonical example
    of what routes to oxlint. The agent refused the bucket and argued the convention is about
    whether an *annotation was written*, which is plain syntax. Checked directly against
    ast-grep 0.45.0 — `kind: function_declaration` + `not: {has: {kind: type_annotation,
    field: return_type}}` matches the unannotated function and leaves the annotated one
    alone. **The instruction was wrong.** It now splits types by *written down* (structural:
    a written `any`, an `as` cast, a missing return-type annotation) versus *resolved*
    (`needs-type-info`: what a value actually is, nullability, inferred `any`). A weaker model
    following the original text literally would have routed a genuinely enforceable
    convention to a linter the repo doesn't even have — the exact silent loss D18 exists to
    prevent. The distractor was reseeded as a true resolution case ("never `await` a value
    that is not a promise"), which runs 2 and 3 routed correctly.
  - **Step 3's "verify the `enforced` claims" is the sharpest thing in the skill.** The scan
    matched the class convention `via: "tokens"` — a guess. Every run read the rule file and
    ran it rather than trusting the match, and each one found a real hole: run 2 caught that
    `kind: class_declaration` misses `const A = class {}` (node kind `class`); after widening
    the seeded rule, run 3 caught that it still misses `abstract class Shape {}` (node kind
    `abstract_class_declaration` — a distinct kind, not a subtype). Both confirmed
    independently with `--debug-query=ast` and a scan that found 1 hit in a 2-class file.
    A token match reported as enforced is the one failure nobody sees; this is the step that
    catches it. Run 3 labelled the third item an *amendment to an existing rule*, not a
    fourth convention, so "exactly the two unenforced" still reads clean.
  - **C3 verified structurally, not by promise.** `git status --porcelain` in the scratch
    repo was **empty** after all three runs. The skill has no `Write` and no `Edit`; it finds
    work and hands it to `/rule`.
  - **One finding parked, not fixed.** All three runs independently flagged that
    `convention_docs: ["CLAUDE.md"]` pointing at a file that does not exist produces no
    warning — the scan silently audits one doc while the config claims two. Outside this
    step's seam; parked for the scan core.
- 2026-07-29 — step 8 checkpointed · 21a0156a8 — feat: add /audit to find conventions no rule enforces (30m)
- 2026-07-29 — step 9 live fire — `/ast-grep-rules:lesson` driven headlessly against a scratch
  repo (`scripts/scratch-repo.sh`, `claude --plugin-dir`), four runs covering three buckets,
  all three placement branches and the recurrence path. Every result verified against
  `scan.mjs --lessons` and `git status` independently of the agent's own report.
  - **The done-when holds in all three placement branches.** Run A (log exists, template
    only) appended below the fenced template and parsed back as `promotable`, title verbatim;
    run B (same day) reused the existing `## 2026-07-29` heading rather than adding a second
    one, inserted newest-first above run A's entry, and parsed back as `needs-type-info`
    (signal `matched "needs type"`); run C (**no log at all**) created `docs/lessons.md` with
    the header and fenced template and parsed back as `wrong-mechanism` (signal
    `matched "not an AST"`). `entries` incremented by exactly one each time and `git status`
    showed only `docs/lessons.md`, every run — no stray files.
  - **The created file round-trips the harness's own shape.** What `/lesson` writes into an
    empty repo is the same header + fenced-template document `scratch-repo.sh` seeds, so the
    scan skips the template on a file the skill authored exactly as it does on one the
    harness authored. This is the branch `/init` deliberately delegates here (detection
    step 2) so the template has one author; it now has one.
  - **Optional next-step lines don't pollute the signal.** Run A emitted a `- [ ] doc:` line
    alongside its `- [ ] rule:` line; the scan counted one candidate, not two. The corpus
    template's richness survives without the miner double-counting it.
  - **The recurrence path is additive, and it is the right shape.** Run D re-reported run C's
    friction. The skill amended the existing entry instead of appending a near-duplicate:
    `entries` stayed 1, the diff is a new `**Recurrence:**` line plus a sharpened `rule:`
    sentence, and no recorded prose was reworded or deleted. This is the one place the skill
    edits an existing entry, and it is what keeps recurrence — the strongest argument a rule
    ever gets — concentrated on one candidate rather than split into two the miner would
    surface separately.
  - **D12 is honored by omission and D13 by construction.** No `paths:` key (step 2 proved it
    inert for plugin skills). The trigger list carries ridgeline's broadened ones — a change
    reverted or reworked in the same session, a doc statement read literally against the
    wrong repo state — plus two the corpus's own stall diagnosis argues for: *the user
    corrected you*, and *the hook offered*.
  - **No git tools, deliberately.** All four source skills commit the lesson themselves; this
    one does not, and hands the `git add … && git commit -m "lesson: <title>"` line to the
    user instead. The hook (step 10) fires mid-edit, where committing would splice a commit
    into work the user is still staging.
  - Method note, and a false negative worth recording: driving the skill with an explicit
    `--allowedTools` list **silently excludes the `Skill` tool**. The first run reported the
    plugin "isn't on disk" and hand-reconstructed an entry from the log's own template —
    a plausible-looking result produced without the skill ever running. `Skill` must be in
    the list; the same trap is waiting for steps 11 and 14.
- 2026-07-29 — step 9 checkpointed · 8e238e827 — feat: add /lesson to record a friction entry (24m)
- 2026-07-29 — step 10 checkpointed · 7668b1f93 — feat: add a PostToolUse hook as the friction trigger (1 drift, 26m)
- 2026-07-29 — step 11 live fire — `/ast-grep-rules:mine` driven headlessly on **sonnet** (the
  plan's recommended model for this step) against a scratch repo seeded with the step-4 fixture
  corpus, four runs across three legs. The skill is read-only by construction — no `Write`, no
  `Edit` in `allowed-tools` — so it ran headlessly with no permission-layer problem, and `Skill`
  was in `--allowedTools` throughout (the step-9 method note's trap).
  - **The done-when holds on the unmodified corpus (leg A).** 12 entries / 11 checkboxes, and the
    run reported all five buckets with counts (1 promotable, 2 needs-type-info, 1 wrong-mechanism,
    6 declined-none, 1 already-consumed), declined all six entries with no AST form, routed **both**
    type-blind entries to oxlint type-aware *by name and with what the type-aware rule would check*
    rather than dropping them, and handed the single promotable one — the anchored-fence candidate —
    to `/rule` with a proposed id, `docs/lessons.md:36`, and both samples. It also caught the 12th
    entry carrying no `- [ ] rule:` line at all, which is invisible to the scan permanently, and
    verified the one `[x]` against `rules.ids` instead of taking it on trust.
  - **Leg A overrode nothing, so the re-judgment table was untested.** Leg B planted three traps
    the script's first pass gets wrong by construction: a stale `[x]` for a rule id not in the
    inventory, a `needs-type-info`-cued entry that is really structural (a *missing return-type
    annotation* — written, not resolved), and a no-cue entry that defaults to `promotable` but has
    no AST shape at all (a five-minute deploy budget). **All three were caught**, with a
    before/after bucket table and a named reason for each move. Leg C then made the stale tick
    *silent* — ordinary prose, nothing hinting it was false — and it was still caught, by the
    `rules.ids` cross-check alone. Leg C also hit the "two entries contradict each other" edge case
    on its own and reported both while proposing neither, which is what the skill asks for.
  - **The live fire caught a real defect, twice, and it was an honesty problem rather than a
    formatting one.** Both leg-C runs reported `items.length: 13` when the scan emits 14 — and the
    second one did not stop at a miscount: it concluded an item was present in `buckets` but
    missing from `items[]`, called it a scan bug, and recommended filing it. Checked directly:
    `jq '.items | length'` is 14 and the entry it named is right there. The cause is that
    `scan.mjs --lessons` states `entries` but **not** the item count, so the total has to come from
    counting 14 JSON objects by eye — reliable at 11 items (legs A and B were both correct), not at
    14. The skill now takes the total by summing the five `buckets` numbers, states that `buckets`
    is tallied from `items` in the same pass so the two *cannot* disagree, and says a mismatch is
    always a miscount and never a bug to report. Re-fired: 15 entries, buckets summing to 14, the
    gap of 1 named by title, and the post-re-judgment table still summing to 14. The underlying
    ergonomic fix — a `candidates: <n>` field in the scan output — is outside this seam and parked.
  - **The stall fix is in the text, not just the intent.** No threshold anywhere: not on corpus
    size, not on recurrence. Recurrence ranks a candidate (step 3) and explicitly gates nothing,
    and "the log is short" appears under **When NOT to use** only as the retired gate, named as the
    failure mode. That is the pair of gates — *"<10 entries total"* and *"≥3 lessons per cluster"* —
    that made the original miner unreachable in all four repos it shipped to.
  - **C3 verified structurally, not by promise.** `git status --porcelain` in the scratch repo was
    **empty** after every run. Ticking a checkbox stays `/rule`'s job, after its fixture is green.
  - Scratch repo removed after the last run.
- 2026-07-31 — step 11 checkpointed · a6e0f041a — feat: add /mine to classify and route lesson candidates (1968m)
- 2026-07-31 — step 12 checkpointed · 7375716e6 — feat: add the opt-in starter rulesets (1 drift, 26m)
- 2026-07-31 — step 13 checkpointed · 9eddf8eae — feat: replace the starter tiers with a technique cookbook (1 drift, 27m)
- 2026-07-30 — step 14 live fire — `/ast-grep-rules:audit` once and `/ast-grep-rules:rule` twice,
  driven headlessly against a scratch repo (`scripts/scratch-repo.sh`, `claude --plugin-dir`)
  seeded with a five-convention `docs/conventions.md` plus a `CLAUDE.md` line, spanning four of
  the six technique rows and two distractors.
  - **Both halves of the done-when hold.** Every one of `/audit`'s five `enforceable` findings
    carried a **Technique** line naming the construct and citing the example by path — the
    `kind:` claim to `no-enum-declaration`, the console-under-`src/` claim to
    `no-console-in-packages`, the TODO claim to `no-unlinked-todo`. Both `/rule` runs were
    ban-a-construct ids (`no-class-declaration`, `no-namespace-declaration`) and both cited the
    `kind:` example. The type-resolution distractor still routed to `needs-type-info` and the
    double-hedged one to `not-a-convention`, so the lookup narrowed the work list rather than
    widening it.
  - **The ordering is proved from the stream, not from the agent's own account.** Run 2 was
    captured with `--output-format stream-json`: `examples/rules/no-enum-declaration.yml` is read
    at tool calls 10 and 12, `scaffold-rule.mjs` fires at 11, and the first `Write` to
    `rules/no-namespace-declaration.yml` lands at 14. The example is open before any YAML exists.
  - **By reference, verified against the tree.** `git status --porcelain` after `/audit` was
    **empty** and the rules dir held only its `.gitkeep`, on a run citing four distinct examples.
    Each `/rule` run added exactly its own three files; `cmp` against all six bundled rules found
    no copy. `ast-grep test` green both times, 2 passed.
  - **Adapt-don't-adopt showed up unprompted, which is the point of the encodes: line.** The
    audit flagged that `no-console-in-packages`'s `files: packages/**/*.ts` must become
    `src/**/*.ts` for this repo, quoting that example's own note on why a rule governing nothing
    and a rule finding nothing print identically. Neither `/rule` run produced a `kind:` rule
    naming one spelling: run 1 covered `class_declaration` / `abstract_class_declaration` /
    `class`, run 2 found that legacy `module Json {}` is kind `module` rather than
    `internal_module` — both credited to the cautionary paragraph in the `kind:` example.
  - **One defect the live fire caught.** Run 2 opened the example with `Bash cat` on a
    `${CLAUDE_PLUGIN_ROOT}` path, which is in neither skill's `allowed-tools`; it only worked
    because the harness ran wide open. Both skills now say **Read**, and say why. The `--list`
    preflight is granted as the exact string `install-starter.mjs --list` rather than a `*`
    prefix, so neither skill can install even if it tried.
  - Scratch repo removed after the last run.
- 2026-07-31 — step 14 checkpointed · a72581857 — feat: point /rule and /audit at the cookbook when authoring (41m)
- 2026-07-31 — step 15 checkpointed · 520a12de0 — docs: add the plugin README and root marketplace table row (10m)
- 2026-07-30 — step 16 live fire — **both loops driven end to end in a repo built from
  nothing** (`scripts/scratch-repo.sh /tmp/agr-e2e`, `claude --plugin-dir`, opus), eight
  headless runs. Every claim below was checked against the tree — `git status`, a plain
  no-flag `ast-grep test` run by hand, `scan.mjs`, `cmp` — not taken from the agent's own
  report. Scratch repo removed after the last run.

  **Loop A — `/audit` → `/rule`, the headline mechanism (D17). Holds.**
  - Seeded `docs/conventions.md` with three statements: two structurally enforceable (no
    default export; `node:`-prefixed builtin imports) and one not (a PR-size budget). The
    deterministic pass found **1** of the two — `scan.mjs --conventions` returns exactly one
    `unenforced`, at line 6. `/audit` recovered the second by reading the doc, and said so
    unprompted: *"the scan found 1 candidate; I found 1 more by reading `docs/conventions.md`
    in full (the `node:` protocol bullet, whose normative cue sits on line 10 while the bullet
    starts at line 9)."* The prose leg is what makes the mechanism 6-for-6 rather than
    1-for-2, and it is still doing the work at step 16.
  - Both non-candidates routed rather than dropped: the PR-size budget to `wrong-mechanism`
    (*"a diff size is a property of a changeset, not of any AST node"*), the doc's own
    authority preamble to `not-a-convention`.
  - Every finding carried a **Technique** line citing an example by path, and the audit
    quoted `no-focused-or-skipped-test`'s own warning back at itself (the regex runs against
    node text *including* quote characters). `git status --porcelain` after the run:
    **empty**, on a run that cited three examples.
  - `/rule` then promoted `no-default-export` and it took the audit's probe seriously. The
    handoff said `pattern: export default $X` misses `export { x as default }`; `/rule`
    confirmed that on the CLI before writing anything, and **added a third alternative the
    audit had not found** — `export { default } from './other'`, which re-publishes another
    module's default as this module's own. Three files, 10 `valid:` / 8 `invalid:`,
    `ast-grep test` green with no flags on my own run.
  - Two authoring facts the run paid for, both now in that rule's `note:`: `has:` rejects a
    bare `field:` with no matcher under it (*"Rule must have one positive matcher"*), and
    anchoring on the `export_specifier` rather than the statement is what makes
    `export { a, loadConfig as default }` underline only the offending specifier — confirmed
    in the recorded snapshot span.

  **Loop B — hook → `/lesson` → `/mine` → `/rule`. Holds, with one real finding.**
  - Induced friction over four turns in one resumed session: an `as any` cast written on
    request, then corrected, then the method removed outright. Verified from
    `--debug-file`, not inferred.
  - **The hook stays silent on ordinary work.** Turn 1 (adding the method): *"Prompt hook
    condition was met: ordinary edit"* — `ok:true`, nothing reaches the model. That is the
    common path and it costs the user nothing.
  - **The hook fires on a take-back, and the offer arrives.** Turn 3 (deleting the method):
    *"Prompt hook condition was not met: toJSON() method removed with nothing put in its
    place… if this followed a correction, offer /ast-grep-rules:lesson before moving on."*
    With `continueOnBlock: true` the turn continued and the model relayed the offer to the
    user. The plumbing D8 rests on is proven end to end — fire, `continueOnBlock`, offer
    reaching a human — exactly as the step-2 spike predicted. What that spike could not test
    is whether the gate fires on the *right* edit; see the finding below.
  - **The finding: the gate cannot see the correction, and that is a limit of the primitive
    rather than a wording problem.** Turn 2 — replacing `this.config as any` with a typed
    `toJSON(): AppConfig`, one turn after the user said that cast was one they keep having to
    back out of this codebase — was judged `ordinary edit`. D15 gave the gate two signatures
    and this run tested both. *"Did the user just correct the assistant"* is **structurally
    unobservable**: a `PostToolUse` prompt hook receives one diff (`tool_input`,
    `structuredPatch`, `originalFile`) and no dialogue, which is why the hook's own prompt has
    to tell it *"you cannot see the conversation."* Turn 2 was precisely that signature and the
    gate had nothing to detect it with. *"Did the assistant just undo its own recent change"*
    **is** observable, and is what tripped on turn 3 — but it is a weak proxy, because ordinary
    iteration and real friction produce the same shape of diff. So the two verdicts were wrong
    in opposite directions: silence on the turn that carried the friction, and a fire on one
    the model itself judged unworthy of an entry (*"the friction worth recording was the
    `as any` cast"* — it was right). Tuning the prompt's wording does not reach either half.
  - **This reopens D19.** The hook payload does carry `transcript_path`, but a prompt hook has
    no tools to read it; a `type: "command"` hook could. Step 2 discharged the command fallback
    once prompt hooks were proven to fire, and that verdict was sound on what it tested —
    whether the primitive works at all was the open question then, and it does. What it could
    not test is whether a conversation-blind judge can tell friction from progress, and this is
    the first evidence that it cannot. Not repaired here: it changes D8/D15/D19 and lives in
    step 10's seam, and reversing a discharged decision belongs in `/plumbbob:refine` rather
    than in a park.
  - **Second finding, and the more interesting one.** In turn 2 the sub-agent was blocked
    from writing `docs/lessons.md`, and instead of stopping it wrote the lesson **into its
    own auto-memory** and reported that as done. Friction diverted to a store `/mine` cannot
    read is friction lost, and it looks like success in the transcript. Parked.
  - **`/lesson` records what `/mine` can read back.** On approval it appended one entry that
    `scan.mjs --lessons` parsed to `entries: 1`, bucket `promotable`, title verbatim; the
    only file touched was `docs/lessons.md`.
  - **`/mine` runs honestly at n=1 — the stall fix, demonstrated.** The original miner
    required ≥10 entries and ≥3 per cluster and therefore never ran once in four repos. This
    one produced a full five-bucket table on a one-entry log, and **overrode the scan's
    reasoning while agreeing with its answer**: the scan's `promotable` came from a default
    signal (*"no decline, type-info or mechanism cue"*), which the skill re-tested against
    D18's written-vs-resolved split before accepting — `as any` is an annotation you can
    point at, so it survives on its own merits. It also ranked the candidate on the
    recurrence *attested inside the entry* rather than on the entry count, which is the whole
    argument for classifying instead of thresholding.
  - `/rule` closed the loop: `no-as-any`, 18 `valid:` / 10 `invalid:`, green. The double-cast
    case `/mine` flagged behaves as predicted — `y as any as Widget` matches once and the
    snapshot span covers only the inner `y as any`. **The checkbox at `docs/lessons.md:45`
    is now `[x]`**, and re-running the scan proves the loop closed: the entry moved
    `promotable → already-consumed`, so `/mine` will not re-propose it.
  - **`files:` cannot be proven by a fixture, and the run said so rather than implying
    otherwise.** `ast-grep test` runs snippets with no path, so a wrong glob is a rule that
    silently governs nothing. `/rule` positive-controlled the `src/**/*.ts` scope with a
    throwaway inline rule against a file it knew matched — the cautionary paragraph in
    `no-console-in-packages` is what prompted it.

  **Across both loops.** `ast-grep test` green on the full set (`2 passed; 0 failed`) on my
  own no-flag run; `cmp` against all six bundled examples found **no copy** — six citations,
  zero installs, adapt-not-adopt holding under live fire (D23). Each rule landed as exactly
  three files (rule, fixture, snapshot), never two — D3's contract survived the one place it
  was most likely to slip, an agent under time pressure at the end of a long session.
- 2026-07-31 — step 16 checkpointed · 78813161f — chore: verify both loops end to end in a throwaway repo (535m)
