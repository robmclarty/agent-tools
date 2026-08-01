---
name: lesson
description: Record a friction point in this repo's friction log — something about its structure, tooling or conventions that surprised you, caused a mistake, or produced a wrong call you had to back out. Use right after you recover from confusion or reverse a decision, when the user corrects you, when the same mistake happens twice, before starting the next task, and whenever the friction hook offers. Thirty seconds, always appropriate even when no rule follows; /ast-grep-rules:mine reads these entries back.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs*), Bash(date +%F)
---

# lesson

Record one friction event, in the one shape `/ast-grep-rules:mine` can read back.

This is the cheapest adaptation mechanism in the plugin — thirty seconds, and always
worth it even when nothing structural follows. It is also the one that stalled. Across
the four repos this plugin was built from, **15 entries were written in a single two-day
burst and nothing in the three months after**, and zero rules were ever mined out of
them. Two of the three causes are fixed elsewhere: the `PostToolUse` hook offers to
record without anyone remembering to, and `/ast-grep-rules:mine` classifies instead of
gating itself out of existence. The third is here — an entry that does not parse, or
that carries no judgment, is an entry the rest of the loop cannot use.

**The load-bearing line is the `- [ ] rule:` checkbox.** Everything above it is for a
human reading the log next quarter. That one line is what the miner reads, and it is
where *you* write the judgment about whether this friction has a structural shape at all.
The corpus is clear that the author already makes that call in prose — this skill just
makes sure it lands somewhere a script can find it.

`$ARGUMENTS` — optional. A one-line title, or a sentence describing the friction. With
neither, work from what just happened in the session.

## Preflight context

- Today: !`date +%F`
- Lessons scan: !`node ${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs --lessons`

Read the JSON before writing anything. It carries `lessons_path`, every entry already in
the log with its title and bucket, and the rule ids the repo already enforces.

| Preflight | Meaning | Do |
|---|---|---|
| `mode: "lessons"` | configured, log parsed | **Steps**, below |
| `error_type: "config"` | no `.claude/ast-grep.json` | relay `message`, send them to `/ast-grep-rules:init`, stop |
| `error_type: "sgconfig"` | ast-grep's own config is missing or unreadable | relay `message`, send them to `/ast-grep-rules:init`, stop |
| `error_type: "usage"` / `"runtime"` | relay `message` verbatim and stop | — |

A warning that **no lessons file exists yet** is not an error — it means yours is the
first entry, and step 5 creates the file. `/ast-grep-rules:init` deliberately does not
create it, so that the entry template has exactly one author.

## Conventions

- **`lessons_path` is the only store that counts.** `/ast-grep-rules:mine` reads that one
  file and nothing else — not a memory directory, not a scratch note, not the transcript.
  Writing the entry somewhere else is not a fallback, it is a silent drop: the loop this
  plugin exists to close never sees it. If the write is refused or blocked, say so plainly
  and hand back the entry text so a human can land it — see **Edge cases**. **Reporting a
  lesson as recorded when it went anywhere but `lessons_path` is the one failure here that
  looks exactly like success** — a real session did precisely that.
- **One entry, one friction event.** Two things went wrong in one session? Two entries.
  They get classified separately and they route separately.
- **Exactly one `- [ ] rule:` line per entry, always** — including when the honest answer
  is `none`. An entry without it is invisible to `/ast-grep-rules:mine`; a "none" is a
  recorded judgment, and the corpus says most entries are one.
- **Never tick the box yourself.** `[x]` classifies as `already-consumed` — it means a
  rule was actually promoted from this entry. Only `/ast-grep-rules:rule` earns that,
  after the rule and its fixture are green.
- **Never put the entry inside a fence**, and never remove the fence around the file's
  own template. The scan skips fenced blocks — that is precisely how the template avoids
  being counted as a candidate — so a fenced entry is *silently* invisible.
- **Newest first, and existing entries are not rewritten.** The log is append-only in the
  sense that matters: nothing already recorded gets deleted or reworded. The one exception
  is recording a recurrence on an entry that already exists (step 3), which is an addition,
  not a revision.
- **Write, don't commit.** This skill has no git tools on purpose. It often runs mid-task
  — the hook fires in the middle of an edit — and committing there would splice a commit
  into work the user is still staging. Hand them the command instead (step 7).
- **Don't fix anything while you are here.** Recording friction and acting on it are two
  different moves; the entry is the deliverable. Anything that needs doing goes in the
  next-step lines.

## The entry format

The template every entry conforms to, and what the scan parses:

```markdown
## YYYY-MM-DD

### Lesson: <one-line title>

**What happened:** <the friction, one short paragraph>

**What fixed it:** <the correction that landed>

**Potential next step:**

- [ ] rule: <ast-grep pattern sketch, or `none` and why>

**Related:** <files, commits, prior lessons>
```

Three lines are structural and the parser is strict about them:

| Line | Must be exactly |
|---|---|
| the date heading | `## ` + `YYYY-MM-DD` and nothing else on the line — no weekday, no title |
| the entry heading | `### Lesson: ` + the title, with the space after the colon |
| the checkbox | `- [ ] rule: ` at the start of the line (up to 3 spaces of indent), wrapping onto 2-space-indented continuation lines |

Optional extra next-step lines (`- [ ] doc: …`, `- [ ] structure: …`) are fine and the
scan ignores them — they are for the human. They never replace the `rule:` line.

## Steps

### 1. Pause — do not log mid-problem

Finish the task first, get the check green, then come back. A lesson written while you
are still confused records the confusion instead of the resolution, and **What fixed it**
is the half that makes the entry worth keeping.

If you are here because the friction hook offered mid-edit, that offer is a bookmark, not
an interrupt: acknowledge it, finish the edit, then write the entry.

### 2. Name the friction in one line

The title is what somebody scans six months from now, so make it the *specific* thing:
"scaffolder doesn't create the tsconfig reference entry", not "tsconfig was confusing".
A title that describes a feeling instead of a mechanism is an entry nobody re-reads.

Then, before writing: is this actually friction with *this repo*, or is it a bug in the
code you are writing, an upstream library problem, or a preference? Those three are out
of scope — see **When NOT to use this skill**.

### 3. Check whether it is already logged

The preflight's `items` array carries every existing entry's `title`, `date` and `bucket`.
Grep the log for the mechanism as well as the title — the same friction gets described two
different ways a year apart.

- **Not there** → new entry, step 4.
- **There, and this is the same friction happening again** → **amend that entry, do not
  duplicate it.** Add one line to it — `**Recurrence:** <today> — <where it happened this
  time>` — and, if the recurrence changes your judgment, sharpen its existing `rule:` line
  from a decline into a pattern sketch. Recurrence is the strongest argument a rule ever
  gets, and it is worth far more concentrated on one entry than split across two identical
  ones the miner would surface as two candidates.
- **There, but genuinely a different friction that looks similar** → new entry, and cite
  the older one in `**Related:**`.

### 4. Write the `rule:` line — this is the judgment

Ask one question: **could a parser see a violation of this, without knowing any types?**

Then say what you actually think, in plain words. The scan reads short cues out of that
sentence to sort it into a bucket:

| Your judgment | Write it like | Bucket |
|---|---|---|
| there is a real AST shape here | a pattern sketch — "flag `JSON.parse($X)` that isn't wrapped in the typed helper" | `promotable` |
| a rule would have to know what something *is* | say so — "needs type info", "type-aware", "the callee's return type" | `needs-type-info` |
| a real gate, but not an AST shape | name the right tool — "a check-script gate", "check.sh", "not an AST shape" | `wrong-mechanism` |
| nothing to enforce | open with `none` — "none — a process error, not a code shape" | `declined-none` |

Two things worth knowing about how that reads:

- **The type cue outranks the `none` prefix, deliberately.** "none — needs type info"
  lands in `needs-type-info`, not `declined-none`, because it is a routing judgment rather
  than a decline: the convention is real, ast-grep just cannot see it. Two entries in the
  source corpus hit exactly that wall, and losing them is what the bucket exists to prevent.
- **Write the sentence for the human first.** If the scan then files it somewhere you did
  not intend, fix the sentence, not the scan — a sentence clear enough to classify is a
  sentence clear enough to read. `/ast-grep-rules:mine` re-judges anything the cues got
  wrong, but only for entries that exist and parse.

**Do not manufacture a pattern sketch to make the entry look productive.** The real corpus
yields roughly one promotable candidate in eleven, and a log padded with hopeful sketches
is a miner that proposes rules nobody wants. `none`, with the reason, is the most common
correct answer.

Before you call something `promotable`, check the preflight's `rules.ids` — if a rule
already enforces it, that is worth saying in the entry instead.

### 5. Compose the entry and place it

Use today's date from the preflight. Where it goes depends on what is already there:

- **No lessons file yet** → create `lessons_path` with the header below, then the entry.
  The template goes **inside a fence**; that is what keeps the scan from counting it as a
  twelfth candidate.

  ````markdown
  # Lessons

  Append-only friction log, newest first. `/ast-grep-rules:lesson` appends entries here;
  `/ast-grep-rules:mine` reads them back and sorts each `rule:` checkbox into a bucket.

  Every entry follows the template below. It sits inside a fence on purpose — the scan
  skips fenced blocks, so the template never registers as a candidate of its own.

  ```markdown
  ## YYYY-MM-DD

  ### Lesson: <one-line title>

  **What happened:** <the friction, one short paragraph>

  **What fixed it:** <the correction that landed>

  **Potential next step:**

  - [ ] rule: <ast-grep pattern sketch, or `none` and why>

  **Related:** <files, commits, prior lessons>
  ```
  ````

- **Today's `## YYYY-MM-DD` heading already exists** → insert the `### Lesson:` block
  directly under it, above that day's existing entries. Do not add a second heading for
  the same date.
- **No heading for today** → insert `## <today>` and the entry immediately **above the
  newest existing date heading** — that is, after the file's header and its fenced
  template, before the first `## <date>`.

Never insert inside or above the header's fenced template block.

Keep each section to a short paragraph. A lesson that takes five minutes to read does not
get read, and the whole value proposition here is that it costs thirty seconds.

### 6. Verify it parses back

The entry is not done until the scan can read it. This is the same command the preflight
ran, so the diff is directly comparable:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs --lessons
```

Three things to confirm:

1. **`entries` and `candidates` both went up by exactly one** (or are both unchanged, for
   a step-3 amendment). `candidates` is the item total, stated outright — no summing.
2. **Your title appears verbatim** in an `items[]` entry, under today's date.
3. **`bucket` is the one you intended**, and its `signal` says which cue matched.

| Symptom | Cause |
|---|---|
| the title is missing entirely | the entry did not parse — usually `###Lesson:` with no space, a date heading carrying extra text, or the whole block landing inside a fence |
| `entries` went up but `candidates` did not | the entry has no `- [ ] rule:` line, so the miner will never see it |
| the bucket is wrong | the `rule:` sentence says something other than what you meant — rewrite the sentence |

Fix the entry, not the scan, and re-run until all three hold.

### 7. Report and hand off

- The path written, and whether the file was created or appended to.
- The title, the date, the bucket, and the `signal` the scan gave for it.
- The commit, as a suggestion rather than an action — lessons are worth their own commit
  so they do not disappear into an unrelated diff:

  ```bash
  git add <lessons_path> && git commit -m "lesson: <title>"
  ```

Then route by bucket, in one line each — never more than one handoff:

- **`promotable`, and this friction has now happened at least twice** →
  `/ast-grep-rules:rule`, carrying the pattern sketch. A rule is a standing commitment
  that blocks future edits, so a *first* occurrence stays logged and waits; that is what
  `/ast-grep-rules:mine` is for.
- **`needs-type-info`** → name the type-aware linter (oxlint) as the destination, so the
  convention is routed rather than quietly dropped.
- **`wrong-mechanism`** → name the tool that should hold the gate: the check script, CI,
  the formatter, `tsconfig`.
- **`declined-none`** → nothing further. Say so plainly; recording it *was* the outcome.

One closing line worth saying when it applies: if the friction was that a convention the
repo has **already written down** was not enforced, `/ast-grep-rules:audit` is the faster
route to a rule than waiting for this entry to be mined — every rule in the source corpus
came from a convention audit, and none from the friction log.

## When to use this skill

Always, when any of these happen:

- **The user corrected you** — a wrong call they had to point out is the single signal the
  friction hook is built to catch, and the one the earlier version of this skill missed.
- **You made a change and reverted or significantly reworked it in the same session.**
- You made the same mistake twice in one session.
- A spec, constraint or doc statement, read literally, produced a change that did not
  apply to the repo's current state.
- A rule fired and you had to re-read its `note:` to understand it.
- You searched for code and did not find it where you expected.
- The check command told you something was wrong in a way that was not actionable.
- A convention in the repo's docs was not enforced, and you violated it.
- You hand-copied from an existing package instead of running the scaffolder, and it cost
  you something.
- **The friction hook offered.** That offer is this skill's primary trigger by design —
  self-invocation is exactly what the source corpus proves does not happen reliably.

## When NOT to use this skill

- **A bug in the code you are writing.** That belongs in the code, or its commit message.
- **An external library problem.** That belongs upstream.
- **A preference that is not a mistake** — "I wish the formatter did X".
- **A convention that is written down but unenforced.** That is `/ast-grep-rules:audit`,
  which is where rules actually come from. Log it here only if the friction was that you
  *violated* it because nothing stopped you.
- **You already know the rule you want.** Go straight to `/ast-grep-rules:rule`; the log
  is the long way round when the candidate is already decided.
- **The repo is not configured yet** — `/ast-grep-rules:init` first.

## Edge cases

- **The lessons file does not exist.** Expected — this skill creates it, header and fenced
  template included. `/ast-grep-rules:init` leaves it alone precisely so the template has
  one author and cannot drift into two versions.
- **`lessons_path` points at nothing, but a lessons log exists somewhere else.** Glob
  `**/lessons.md`, report what you found, and offer `/ast-grep-rules:init` to repoint the
  config. Do not start a second log — a split corpus is worse than a misconfigured path.
- **The log has its own `## Format` section** (the four source repos do). Leave it exactly
  as it is and insert below it. `## Format` is not a date heading, so the parser already
  ignores it.
- **The existing log is oldest-first.** Follow the order the file already uses rather than
  imposing newest-first on someone else's log; the scan reads either.
- **The repo still carries a bespoke `post-friction-lesson` skill.** Both write the same
  shape, so nothing breaks — but say which one you used and point at the adoption note
  `/ast-grep-rules:init` reports, so the repo ends up with one implementation.
- **The friction has no structural shape whatsoever.** Log it anyway, with `- [ ] rule:
  none — <why>`. That is the common case and it is a complete outcome, not a half-finished
  one.
- **Several distinct frictions in one session.** One entry each, under the same date
  heading. They classify and route independently.
- **The write to `lessons_path` is blocked** — a permission refusal, a read-only tree, a
  sandbox. **Report the block; do not reroute.** Say which path was refused, print the
  composed entry in full so nothing is lost, and give the human the one command that lands
  it. Do not write it to a memory store, a notes file, or anywhere else and call it
  recorded: `/ast-grep-rules:mine` reads `lessons_path` alone, so an entry parked
  elsewhere is worse than an entry never written — it reads as done and mines as absent.
- **The user declines to record it.** Nothing is written. Say what the entry would have
  said in one line, so the judgment is at least in the transcript.
