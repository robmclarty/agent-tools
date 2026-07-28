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

**Current step:** 2 — spike(hooks): verify prompt-hook and paths-frontmatter support
**Heavy check:** checkride (set a "check" key in .plumbbob/settings.json to override)

## Steps

*(Mirror of intent.md's Steps, with live status — CLI-maintained, not hand-edited.
`build`/`checkpoint`/`revert` re-render this from intent.md, and set the Current step
line above. Only ONE step is in flight; a step is done only after a checkpoint —
check green + checkpoint taken, via `/pb-verify` or `/pb-build`.)*

- ☑ 1. chore(check): add a repo check command over validation and script tests
- ☐ 2. spike(hooks): verify prompt-hook and paths-frontmatter support
- ☐ 3. feat: add plugin manifest, config resolver, and marketplace entry
- ☐ 4. feat: add the shared rules-inventory and scan core
- ☐ 5. feat: add the scratch-repo test harness
- ☐ 6. feat: add /init to generate config and bootstrap sgconfig
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
