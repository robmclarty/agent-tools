---
name: mine
description: Read this repo's friction log back and route every recorded `rule:` judgment — what can become an ast-grep rule, what needs a type-aware linter, what belongs in the check script, what was declined, and what was already promoted. Use when asked what the lessons file is owed, whether any recorded friction is worth a rule yet, after a run of entries has accumulated, or when the same friction recurs. Runs honestly on a log of one entry and hands the best candidate to /ast-grep-rules:rule.
allowed-tools: Read, Glob, Grep, Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs*), Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs*), Bash(pnpm exec ast-grep*), Bash(npx --no-install ast-grep*), Bash(yarn exec ast-grep*), Bash(./node_modules/.bin/ast-grep*), mcp__ast-grep__dump_syntax_tree, mcp__ast-grep__find_code, mcp__ast-grep__find_code_by_rule, mcp__ast-grep__test_match_code_rule
---

# mine

Read the friction log back and route every entry in it.

This is the loop's long-tail feeder, and it is the half that stalled. Across the four
repos this plugin was built from, 15 lesson entries were recorded and **zero rules were
ever mined out of them** — because the miner gated itself out of existence. It said *"do
not use when the lessons file is short (<10 entries)"* and required three lessons per
cluster; the largest corpus in the field was seven entries, so neither gate was ever
reachable and the skill never ran once.

**So this skill has no threshold.** It runs on a log of one entry and produces a real
answer, because the answer is a routing table, not a rule. Every entry lands somewhere
and says so. Reporting "one candidate, four declines, two routed to oxlint" is a complete
outcome; refusing to run is not.

The division of labour is fixed by design (D6): `scan.mjs --lessons` does the inventory,
**you do the judgment**. It deliberately does *not* cluster by similarity — eleven
checkboxes is not a corpus you can cluster, and the author already wrote their own
expressibility judgment into each `rule:` line. The script reads that judgment with a
short list of cues and tells you which one matched. Your job is to re-judge it against
what the entry actually says.

Calibrate on the real yield: **roughly one promotable candidate in eleven.** A run that
reports zero is the expected result, not a failed one — and it is why the temptation to
manufacture a candidate has to be named up front.

**This skill writes nothing.** No `Write`, no `Edit`, on purpose. It finds work and hands
it to `/ast-grep-rules:rule`, which is where rules get authored, verified, and where the
entry's checkbox finally gets ticked.

`$ARGUMENTS` — optional. A bucket to focus on (`promotable`, `needs-type-info`), a topic
("imports", "error handling"), or a date range. None is required; with none, mine the
whole log.

## Preflight context

- Lessons scan: !`node ${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs --lessons`

Read the JSON before anything else. It carries `lessons_path`, the entry count, every
`rule:` checkbox with its date, title, source line, verbatim text, bucket and the cue
that produced that bucket, plus the rule ids the repo already enforces.

| Preflight | Meaning | Do |
|---|---|---|
| `mode: "lessons"` | log parsed | **Steps**, below |
| `error_type: "config"` | no `.claude/ast-grep.json` | relay `message`, send them to `/ast-grep-rules:init`, stop |
| `error_type: "sgconfig"` | ast-grep's own config is missing or unreadable | relay `message`, send them to `/ast-grep-rules:init`, stop |
| `error_type: "usage"` / `"runtime"` | relay `message` verbatim and stop | — |

A warning that **no lessons file exists yet** is a stop with a useful answer, not an
error: there is nothing recorded to mine. Say so, point at `/ast-grep-rules:lesson` for
the next friction event, and at `/ast-grep-rules:audit` — which needs no log at all and
is where every rule in the source corpus actually came from.

An **empty rules inventory** is not an error either. A repo with zero rules is the repo
with the most to gain here.

## Conventions

- **Write nothing.** No rule files, no edits to the log, no ticked checkboxes. Ticking a
  box is `/ast-grep-rules:rule`'s job, and only after the rule and its fixture are green —
  a `[x]` means a rule exists, so ticking one here would launder a proposal into a fact.
- **No threshold, ever.** Not on corpus size, not on recurrence count. Recurrence is
  *ranking* evidence (step 3); the moment it becomes a gate this skill stops running, which
  is the exact failure it was built to fix.
- **Report all five buckets on every run**, including the ones that came back empty. A
  bucket silently omitted reads as a bucket with nothing in it, and the difference between
  "no type-blind entries" and "I forgot to mention them" is invisible to the reader.
- **Route, never drop.** `needs-type-info` and `wrong-mechanism` are real outcomes with
  real destinations. A convention this tool cannot hold is still a convention.
- **Cite or quote.** Every item carries its title and `lessons_path:line`, and quotes the
  `rule:` sentence verbatim. A paraphrase is unfalsifiable.
- **The scan is a first pass, not the answer.** A run that prints the JSON back adds
  nothing the script did not already do — the re-judging in step 2 is the whole value.
- **One handoff at a time.** `/ast-grep-rules:rule` does one rule per run.
- **Never invoke `ast-grep` directly.** It is a per-repo devDependency and is not on
  `PATH`. Always the configured `ast_grep_command`, with arguments appended.

## Steps

### 1. Read the JSON, then read the log

`items[]` gives you each checkbox's own sentence and nothing else. That sentence was
written in thirty seconds at the end of a hard task, so **read the entries themselves** at
`lessons_path` — **What happened** and **What fixed it** are where the AST shape actually
lives, and they are what tells you whether the author's one-line judgment holds up.

Then compare two numbers the JSON hands you directly:

- **`entries` vs the candidate total.** The JSON states `entries` outright. It does *not*
  state how many items there are, so **get that total by adding up the five `buckets`
  numbers — never by counting `items[]` by eye.** `buckets` is tallied from `items` in the
  same pass, so the two cannot disagree: a total that does not match what you counted is
  always a miscount, and never a bug in the scan. Do not report one as a bug, and do not
  let it change any bucket's count.
- **The difference is an exact count of entries carrying no `- [ ] rule:` line at all.**
  Those are invisible to this skill permanently — not misfiled, *unseen*. Find them (grep
  the log for `### Lesson:` and diff the titles against `items[]`) and **name every one by
  title**. If you can name fewer than the gap says, re-add the buckets; if you can name
  more, you are counting entries the scan did see. The fix is one line added by whoever
  owns the log — the cheapest yield increase available, and nothing else will surface it.
- **`buckets` against your own reading**, which is step 2.

If `$ARGUMENTS` narrowed the run, narrow here — and say what you narrowed to, so a partial
mine never reads as a full one.

### 2. Re-judge every classification

The cues are short, documented, and quoted back to you in each item's `signal`. They are
right often enough to be worth running first and wrong often enough that this step exists.
The question for every item is the same one `/ast-grep-rules:lesson` asked when the entry
was written: **could a parser see a violation of this, without knowing any types?**

**Types are the one place the easy reflex is wrong, so split them carefully.** "Anything
about types goes to oxlint" is too blunt and it loses real rules. The question is whether
the entry is about **an annotation being written** or about **what a type resolves to**:

- **Written down → structural.** A written `any`, an `as` cast, a `@ts-ignore`, a missing
  return-type annotation. The parser sees whether the node is there:

  ```yaml
  rule:
    kind: function_declaration
    not: { has: { kind: type_annotation, field: return_type } }
  ```

  If a human could point at the character that is or isn't there, so can ast-grep.
- **Resolved → `needs-type-info`.** What a value actually *is*: is this callee returning a
  promise, is this a `string` or a `Buffer`, is this nullable, is this inferred `any`. No
  amount of syntax gets there. This routes to a type-aware linter.

The five re-judgments worth making, in rough order of how often they matter:

| From | To | The tell |
|---|---|---|
| `promotable` | anything else | **Nothing matched, so the script defaulted here.** This is the bucket most likely to be wrong, and wrong in the optimistic direction — check that a shape genuinely exists before you propose a rule for it. |
| `declined-none` | `promotable` | The author declined in the moment, and the friction has since recurred. Recurrence is what overturns a decline (step 3). |
| `needs-type-info` | `promotable` | The written-versus-resolved split above. A convention about an annotation is syntax. |
| `wrong-mechanism` | `promotable` | "Belongs in the check script" is sometimes an instinct rather than a finding — a shape in source is ast-grep's, even when a script could also catch it. |
| `already-consumed` | back to candidate | **A stale tick.** Check each `[x]` against the preflight's `rules.ids`. If no rule with that id exists, the rule was never landed or was later deleted, and the entry has been sitting there looking finished. |

**Also not structural**, however firmly the entry states it: anything about values or
runtime (timings, sizes, counts) → `wrong-mechanism`; anything about formatting → the
formatter owns it; anything about process ("run the check before committing") →
`declined-none`, and say so rather than inventing a rule for it.

Say plainly in the report which calls you overrode and why. That list is the most useful
thing a mine run produces for whoever tunes the cues next.

### 3. Group by recurrence — evidence, never a gate

The script does no clustering, so do a light pass by hand across what survived step 2: two
entries describing the same mechanism are **one candidate with two citations**, not two
candidates. Match on the mechanism, not the wording — the same friction gets described two
different ways a year apart, and `**Related:**` lines are the fastest thread to follow.

Recurrence is the strongest argument a rule ever gets, because a rule is a standing
commitment that blocks future edits and a single occurrence has not yet earned one. It
ranks a candidate to the top of the list.

**It does not gate anything.** A single occurrence is still reported, still routed, still
offered — it just ranks below a recurrence. The old miner's "three lessons per cluster" is
precisely what made it unrunnable, and re-introducing it here in any form re-breaks the
loop.

### 4. Rank the promotable set

Strongest evidence first:

1. **Recurrence** — how many entries, and how far apart.
2. **Live violations** — the shape existing in code right now:

   ```bash
   <ast_grep_command> run --pattern '<sketch>' --lang ts <src dir>
   ```

   Or `find_code` / `dump_syntax_tree` if the ast-grep MCP server is in your tool list.
   Both are read-only and neither is required — if a pattern sketch is not obvious in one
   attempt, skip it and rank on judgment. A blocked mine helps nobody.
3. **Blast radius** — a shape that can appear anywhere outranks one confined to a helper.
4. **Sharpness** — a candidate with an obvious AST shape outranks one you would have to
   argue about, because the rule will be right on the first try.

Zero live hits is not a reason to drop a candidate. A rule with no current violations
lands green and stays green.

### 5. Report — all five buckets, every run

Lead with the shape of the whole log, so the reader sees the denominator before the work:

| Bucket | Count | Where it goes |
|---|---|---|
| `promotable` | n | → `/ast-grep-rules:rule` |
| `needs-type-info` | n | → a type-aware linter (oxlint) |
| `wrong-mechanism` | n | → the check script, CI, the formatter, `tsconfig` |
| `declined-none` | n | nothing further — the decline was the outcome |
| `already-consumed` | n | a rule exists; evidence, not work |

**Five rows, and their total is the one from step 1** — the sum of the preflight's
`buckets`, which every re-judgment moves *between* rows and never changes. Every item is
counted in exactly one row, using *your* bucket from step 2 rather than the script's; where
the two differ, show both counts and let the overrides explain the move. An item that
deserves special handling (a contradiction, a stale tick, a decline worth re-opening) still
sits in its bucket row and gets cross-referenced in the prose below. Lifting it into a
sixth row breaks the one arithmetic check the reader has, and a table that does not
reconcile makes every other number in the report unfalsifiable.

Then each bucket, in that order:

**`promotable` — the work list.** For each, in `/ast-grep-rules:rule`'s own opening shape,
because that is what it asks for first:

- **Proposed id** — kebab-case, `no-<thing>` is the corpus convention.
- **The citation** — `docs/lessons.md:36`, the entry title, and the `rule:` sentence quoted.
- **Must fail** — one concrete, compilable line that violates it.
- **Must pass** — one concrete near-miss line that must stay quiet.
- **Recurrence** and **live hits**, where steps 3 and 4 found them.

**`needs-type-info` — routed, not dropped.** One line each: the title, the sentence, and
the destination named as a type-aware linter. Say what the rule would check, in one clause
("that the awaited expression is actually a promise"), so the routing survives this
conversation instead of evaporating into a bucket name. Two entries in the source corpus
independently hit exactly this wall; losing them silently is what this bucket exists to
prevent.

**`wrong-mechanism`.** One line each, naming the tool that should hold the gate — the
check script, CI, the formatter, `tsconfig`. "Not an AST shape" alone is half an answer.

**`declined-none`.** One line each: title, and the reason the author gave. No apology
needed — this is the majority bucket in every real corpus, and recording the decline *was*
the outcome. Flag separately any you would re-open, with what changed.

**`already-consumed`.** Title → rule id → the file it lives in. Plus any stale ticks from
step 2, which are the most interesting lines in the report.

**Then two closing notes:** the overrides you made in step 2, and any entries carrying no
`rule:` checkbox from step 1.

If nothing is promotable, say exactly that, plainly. It is the common result and a
complete one. Do not manufacture a candidate to fill the report — a rule proposed to make
a mine run look productive is a rule someone has to maintain forever.

### 6. Hand off

Offer the top candidate to `/ast-grep-rules:rule` by id, carrying the citation and both
samples so it starts from step 2 of its own flow rather than re-deriving them. Wait for
the user to pick — they may want a different one, or none.

Then, two follow-ups worth naming once:

- **`/ast-grep-rules:rule` is what ticks the checkbox**, once the rule and its fixture are
  green. Until then the entry stays `[ ]` and this skill will surface it again — which is
  correct, and why nothing here writes to the log.
- **`/ast-grep-rules:audit` is the higher-yield route.** Every rule in the source corpus
  came from auditing stated conventions against enforced rule ids, and none from mining the
  log. If this run found little, that is not a reason to stop mining — it is a reason to
  audit as well.

## When to use this skill

- The user asks what is in the friction log, whether anything recorded is worth a rule, or
  what the log is owed.
- Entries have accumulated since the last look — especially if the friction hook has been
  firing.
- The same friction just recurred, and a recurrence is what overturns an earlier decline.
- Periodically, as a review pass. The routed buckets drift as the repo's other tooling
  changes — a `needs-type-info` entry becomes actionable the day oxlint type-aware is
  turned on.
- **On a log of any size.** One entry is enough. That is the whole point.

## When NOT to use this skill

- **To author a rule.** That is `/ast-grep-rules:rule`; this skill only finds and ranks.
- **To record friction.** That is `/ast-grep-rules:lesson`, which writes the entries this
  one reads back.
- **To find conventions nothing enforces.** That is `/ast-grep-rules:audit`, reading the
  convention docs. Different input, same destination — and the higher-yield one.
- **The repo is not configured yet** — `/ast-grep-rules:init` first.
- ~~**The log is short.**~~ **Not a reason.** This was the retired gate that stopped the
  original miner from ever running, in any of the four repos that carried it. If you find
  yourself reasoning that a log is too small to be worth mining, that is the failure mode,
  not a judgment.

## Edge cases

- **The log does not exist, or has zero entries.** Not a failure — say so, point at
  `/ast-grep-rules:lesson` for the next friction event and at `/ast-grep-rules:audit`,
  which needs no log at all.
- **Every checkbox is a decline.** The most likely single outcome, and a complete one.
  Report the buckets, note anything worth re-opening if it recurs, and stop.
- **An entry with no `- [ ] rule:` line.** Invisible to the scan. Name it in the report;
  the fix belongs to whoever owns the log, not here.
- **A `[x]` with no matching rule id.** A stale tick — step 2 puts it back in the
  candidate set. Say which, because it looked finished and was not.
- **The same friction appears in the log *and* in a convention doc.** Route it through
  `/ast-grep-rules:audit` instead: a stated convention is stronger evidence than a recorded
  mistake, and it carries the doc citation the rule's `message:` wants.
- **A candidate whose sketch was already tried and abandoned.** You cannot know that from
  here — this skill has no memory. If the entry says so, honor it; otherwise propose it and
  let the human say.
- **A promotable candidate with dozens of live violations.** Still a candidate, but say the
  count up front — `/ast-grep-rules:rule` will land it red against the repo's own code, and
  the honest routes there are `severity: warning`, an `ignores` entry, or fixing the code
  first.
- **Two entries that contradict each other.** Report both and propose neither. One of them
  is out of date and only the human knows which.
- **The repo still carries a bespoke `mine-ast-grep-rules` skill.** Say which one you ran
  and point at the adoption note `/ast-grep-rules:init` reports. The bespoke one carries the
  thresholds that stalled it; the repo should end up with one implementation.
- **`$ARGUMENTS` narrowed the run to one bucket.** Narrow the *detail*, never the counts —
  print the full five-bucket table regardless, so a focused run cannot read as a full audit
  of the log.
