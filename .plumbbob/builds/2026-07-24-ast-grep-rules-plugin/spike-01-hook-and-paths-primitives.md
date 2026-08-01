<!--
spike-report.md — the durable receipt for a spike (a fork the plan couldn't settle
on paper). One per spike, numbered and named `spike-NN-<slug>.md`, riding the build
folder into the PR beside intent.md / report.md. Fill it while the experiment is live
— the worktrees and their learnings are torn down at `spike done`, but this stays.

Two ways a spike is born, both landing here:
  - `/pb-spike <slug>` — an explicit mid-build fork with throwaway worktrees.
  - a planned step titled `spike: …` — the increment IS the experiment.
Record the Verdict before you close the spike (or check off the step).
-->

# Spike — hook-and-paths-primitives

**Via:** step 2
**Opened:** 2026-07-25
**Amended:** 2026-07-31 by step 18 — steps 10 and 16 kept firing these primitives and
learned three more things about them, recorded under **Amendments** below. The findings
and verdict above are left as written: they are the record of what step 2 knew when it
decided.
**Environment:** Claude Code `2.1.220` (arm64 darwin), throwaway plugin `spikeplug`
loaded per-session with `--plugin-dir`, driven headless by `claude -p` against a
scratch project in `/tmp/pb-spike-2/proj`.

## Question

Two primitives the plan leans on are unattested locally (zero `type: "prompt"` hooks and
zero `paths:` frontmatter keys across ~270 cached SKILL.md files). D8 makes a prompt hook
half of D1's stall fix, and D12 gates `/lesson` on `paths:`. Either could be a documented
key that nothing honors — so: does `PostToolUse` accept `type: "prompt"`, what reaches the
user versus the model, and does `paths:` actually gate skill activation? A "no" on the
first adopts D19's `type: "command"` fallback.

## Options tried

- **Read the shipped schema out of the binary.** The CLI is a compiled Mach-O with the JS
  embedded, so the zod schemas and their `.describe()` text are readable directly — the
  authoritative contract rather than prose docs.
- **Live-fired the prompt hook from a plugin's `hooks/hooks.json`** (`{"hooks":{"PostToolUse":[…]}}`,
  the same shape and path plumbbob already uses), driving real `Edit` calls with
  `--output-format stream-json --verbose --include-hook-events` and `--debug-file`.
- **Live-fired the same hook via `--settings`** to isolate whether the plugin vehicle was
  the blocker.
- **A/B'd `paths:`** across four skills: plugin-delivered gated vs. ungated, and
  project-level (`.claude/skills/`) gated vs. ungated, comparing the `init` event's skill
  inventory and then attempting real invocation.

**One false negative worth recording:** counting `hook_started` events said our hook never
registered — plugin, `--settings`, and a no-hook control all showed exactly 3
`PostToolUse:Edit` hooks. **Prompt hooks do not emit `hook_started`/`hook_response` stream
events at all.** The count was measuring only the three `type: "command"` hooks already in
the environment. `--debug-file` is what exposed the truth; the event stream alone would
have produced a confidently wrong "not viable" verdict.

## Findings

### 1. `type: "prompt"` on `PostToolUse` — works, from a plugin's `hooks/hooks.json`

Schema (from the binary), all fields confirmed present:

```
type: "prompt"          prompt: string     // "$ARGUMENTS placeholder for hook input JSON"
if?                     timeout?: number   // seconds
model?: string          // "If not specified, uses the default small fast model"
continueOnBlock?: bool  statusMessage?: string   // spinner text while the hook runs
once?: bool
```

Loading and firing, from `debug5.log`:

```
Read hooks.json for plugin spikeplug (enabled=true): /tmp/pb-spike-2/spikeplug/hooks/hooks.json
Loading hooks from plugin: spikeplug
Hooks: Processing prompt hook with prompt: …
Hooks: Prompt hook condition was not met: SPIKE_REASON_MARKER_7788
```

**Verdict protocol.** The hook LLM returns `{"ok": bool, "reason": "…"}`. `ok:false` logs
*"condition was not met"*; `ok:true` logs *"condition was met"*.

**`$ARGUMENTS` carries everything D15 needs.** Substituted with the full hook-input JSON:
`hook_event_name`, `tool_name`, `cwd`, `permission_mode`, `transcript_path`, `tool_use_id`,
plus `tool_input` (`old_string`/`new_string`) and `tool_response` — including a
`structuredPatch` with the actual +/- lines. The correction/undo signature D15 wants is
legible from the payload alone.

> **Narrowed by step 16 — see amendment 6.** Only the *undo* half is. The payload carries
> `transcript_path`, but a prompt hook has no tools to open it and no transcript prepended
> (amendment 4), so *"did the user just correct the assistant"* is not legible from this
> payload or any other.

### 2. What reaches the model versus the user

| verdict | `continueOnBlock` | model sees | turn |
|---|---|---|---|
| `ok:true` | — | **nothing** — final message: `NO FEEDBACK RECEIVED` | continues |
| `ok:false` | absent (default `false`) | reason recorded as a transcript attachment | **ends** |
| `ok:false` | `true` | reason delivered as hook feedback, quoted back verbatim | continues |

On the default path the reason lands in the transcript as
`{"type":"hook_stopped_continuation","message":"<reason>","hookName":"PostToolUse:Edit","toolUseID":…}`
and **never appears in the `stream-json` output**. With `continueOnBlock: true` it appears
in the stream and the model quotes it back.

**Wart, load-bearing for step 10.** The feedback the model receives echoes the hook's own
prompt twice before the reason:

```
"<the entire hook prompt>": [<the entire hook prompt>]: SPIKE_REASON_MARKER_7788
```

So the hook's prompt text is itself model-visible. It must be written to read sensibly when
quoted back — an internal-sounding gate instruction will surface as noise mid-conversation.

**Silence on pass is free**, which is exactly what step 10's "three ordinary edits produce
none" needs: an `ok:true` verdict delivered literally nothing to the model.

**User-facing surface:** `statusMessage` is the spinner text while the hook runs (schema:
*"Custom status message to display in spinner while hook runs"*), and the block reason is
recorded in the transcript. *Limit of this spike:* every fire was headless, so I confirmed
what reaches the **model** and the **transcript** by observation, but did not visually
confirm interactive rendering of the spinner or the attachment.

### 3. `paths:` — real, honored for project skills, **inert for plugin skills**

Schema text: *"Glob patterns this skill applies to. The skill only loads when the model
touches matching files."* `paths` is in the frontmatter allow-list alongside `hooks`,
`context`, `agent`, `when_to_use`.

A/B with `paths: ["**/*.ts"]`, reading the `init` event's skill inventory with no `.ts`
file touched:

| skill | delivery | `paths:` | listed | invocable with no `.ts` touched |
|---|---|---|---|---|
| `projplain` | project | no | **yes** | — (control) |
| `projgated` | project | yes | **no** | — |
| `spikeplug:ungated` | plugin | no | yes | — (control) |
| `spikeplug:gatedts` | plugin | **yes** | **yes** | **yes** — returned its body marker |

`projgated` reappeared and ran once the model actually edited `hello.ts`, returning
`SPIKE_PROJ_BODY_GAMMA` — so the gate works, and it is dynamic within a session. But the
plugin-delivered `gatedts`, carrying identical frontmatter, stayed listed and fully
invocable in a session explicitly forbidden from reading or editing any file. It is dropped
on the plugin skill-loading path.

## Verdict

**Verdict:** **partial — the primitive D8 depends on is viable; the one D12 depends on is not, through our delivery vehicle.**

`type: "prompt"` on `PostToolUse` works from a plugin's `hooks/hooks.json`, gets a rich
enough payload for D15's gate, and is silent when it passes. **D19's fallback is
discharged, not adopted** — D8 stands as written, with `continueOnBlock: true` required to
make it an *offer* that lets the turn continue rather than a stop.

`paths:` exists and genuinely gates — but only for project-level skills. For a plugin
skill it is silently ignored, and this plugin ships its skills as a plugin (D11). D12's
premise ("costs nothing when it works and nothing is lost when it doesn't") holds, but its
condition is not met.

## What this decides

- **D8 (prompt-hook-trigger): confirmed, built as specified**, plus one addition the spike
  forced — `continueOnBlock: true`, without which a fired hook *ends the turn* instead of
  offering. Step 10 builds the prompt-hook shape.
- **D19 (hook-fallback): discharged.** The `type: "command"` fallback is not needed and
  should not be built. *(Still discharged after step 16 — see amendment 6, which bounds
  what the working primitive can observe without disputing that it works.)*
- **D12 (glob-gated-lesson): drop the `paths:` key.** It is inert for plugin skills, so
  step 9 should omit it rather than carry frontmatter implying gating that does not happen.
  Discovery for `/lesson` rests on `description:` (D16) and the hook trigger (D8).
- **Step 10 constraint (new):** the hook's prompt is quoted back to the model verbatim, so
  it must be authored as user-legible text, not an internal gate instruction.

## Amendments

*A spike answers the question that was open when it ran. This one asked whether the
primitives exist; building on them asked what they can do. Three findings arrived after the
verdict above was written — two from step 10, which built the hook, and one from step 16,
which fired it against real friction. Each is stamped with the step that paid for it.*

### 4. `PostToolUse` prompt hooks receive no transcript — that is a `Stop` privilege *(step 10)*

The evaluator is handed **exactly one message**: the prompt, with the hook-input JSON
substituted for `$ARGUMENTS`. No conversation, and no tools. Only `Stop`/`SubagentStop`
prepend the transcript to a prompt hook; on `PostToolUse` the `transcript_path` in the
payload is a string the evaluator has no way to open.

Evidence, against Claude Code `2.1.220`: `--debug-file` reports `Querying model with 1
messages` on every fire. **And asking the hook does not work as an instrument** — asked
directly whether it could see the conversation, the evaluator answered *yes*. It
confabulates about its own context, so the debug log is the only reliable check. This is
the same shape of trap as the `hook_started` false negative recorded above: two of this
file's findings now rest on `--debug-file` contradicting a more convenient signal.

Consequence for the artifact: the gate is written to judge one diff and nothing else, and
the prompt says so in as many words (*"you cannot see the conversation, so do not guess at
it"*) — otherwise the evaluator invents the dialogue it thinks it has.

### 5. `if:` is a free pre-LLM filter whose brace alternation is silently inert *(step 10)*

`if?` appears in finding 1's schema block but was untested there. It takes
**permission-rule syntax** and is evaluated **before the model is spawned** — so a
non-match costs no LLM call at all. That is what upgrades finding 2's "silence on pass is
free": free of *output*, and now free of *spend* too, which matters because D15 argues an
eager trigger is worse than silence precisely because it also costs tokens.

The wart: **brace alternation is not expanded**. `Edit(**/*.{ts,tsx})` loads without
complaint and matches nothing — no validation error, no warning, just a hook that never
fires. A rule that governs nothing and a rule that finds nothing print identically here
too.

So the trigger is **four entries** — two tools (`Edit`, `Write`) × two extensions (`.ts`,
`.tsx`) — each naming exactly one tool and one glob, with the prompt string duplicated
verbatim because the primitive offers no way to share one. Four copies that must stay
byte-identical are why step 10 carries `hooks/__tests__/hooks.test.mjs` past its declared
seam: `hooks.json` takes no comments, so the drift guard and the reasoning both live in
the test file.

### 6. The gate is conversation-blind, so half of D15's signature is unreachable *(step 16)*

Amendment 4 as a behavioural fact. D15 gave the gate two signatures; step 16's live fire —
friction induced over four turns in one resumed session, verified from `--debug-file`
rather than inferred — tested both, and they are not equals.

| turn | edit | verdict | should have been |
|---|---|---|---|
| 1 | added a method | `ok:true` *"ordinary edit"* — silent | correct (the common path, free) |
| 2 | replaced `this.config as any` with a typed `toJSON(): AppConfig`, one turn after the user said that cast was one they keep backing out of this codebase | `ok:true` *"ordinary edit"* — silent | **the fire** |
| 3 | removed the method outright | `ok:false`, offer delivered | arguably silent |

*"Did the user just correct the assistant"* is **structurally unobservable**. Turn 2 was
exactly that signature and the gate had nothing to detect it with — not a wording problem,
since no wording reaches a payload that contains one diff and no dialogue.

*"Did the assistant just undo its own recent change"* **is** observable, and is what
tripped on turn 3 — but it is a weak proxy, because ordinary iteration and real friction
produce the same shape of diff. The model receiving the offer said so itself: *"the
friction worth recording was the `as any` cast"*, and it was right.

So the two verdicts were wrong in opposite directions — silence on the turn that carried
the friction, a fire on one that did not. Tuning the prompt reaches neither half.

**D19's discharge stands.** Step 2 asked whether the primitive *works*, and the answer is
still yes: the hook fires from a plugin's `hooks/hooks.json`, `continueOnBlock: true`
carries the offer to a human, and silence on ordinary edits costs nothing — step 16 proved
that plumbing end to end, exactly as this spike predicted. What steps 10 and 16 add is the
primitive's **reach**, not a reversal of its viability: a `PostToolUse` prompt hook can
judge diffs, and only diffs. That is a fact about the primitive.

What it *does* put back in play is whether a conversation-blind judge is the right judge —
a question about D8/D15, which step 2 could not have asked because whether prompt hooks fire
at all was the open question then. A `type: "command"` hook could read `transcript_path`;
whether it should is a decision, and decisions belong in `/plumbbob:refine`. This file
records.
