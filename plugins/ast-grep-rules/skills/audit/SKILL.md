---
name: audit
description: Diff the conventions this repo's docs already state against the ast-grep rules it actually enforces, and report the gaps. Use when adopting ast-grep in a repo that already has convention docs, when asked what should have a rule, what the docs say but nothing checks, or which conventions are unenforced — and after /ast-grep-rules:init. Reports only; /ast-grep-rules:rule does the writing.
allowed-tools: Read, Glob, Grep, Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs*), Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs*), Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/install-starter.mjs --list), Bash(pnpm exec ast-grep*), Bash(npx --no-install ast-grep*), Bash(yarn exec ast-grep*), Bash(./node_modules/.bin/ast-grep*), mcp__ast-grep__dump_syntax_tree, mcp__ast-grep__find_code, mcp__ast-grep__find_code_by_rule, mcp__ast-grep__test_match_code_rule
---

# audit

Find the conventions this repo has already written down that nothing enforces.

This is the move that actually produces rules. Across the four repos this plugin was
built from, six rules were authored after the initial scaffold and **all six** came from
exactly this — read a stated convention, check whether a rule enforces it, add the rule if
not. **None** came from mining the friction log. A convention that lives only in prose is
a convention the next model does not read, so the gap between "we wrote it down" and "it
is checked" is where the real work is.

Two halves. `scan.mjs --conventions` does the deterministic one: pull the normative
statements out of the configured docs, cross-reference each against every rule id in the
rules dirs. **You do the other one**, and it is the harder half — deciding what counts as
a stated, structurally-enforceable convention. The script can only see bullet lines and
only match by tokens; it deliberately prefers a spurious flag over a spurious match. What
survives your judgment is the work list.

**This skill writes nothing.** It has no `Write` and no `Edit`, on purpose. It finds work
and hands it to `/ast-grep-rules:rule`, which is where rules get authored and verified.

`$ARGUMENTS` — optional. A doc path to audit instead of the configured set, or a topic to
narrow to ("imports", "error handling"). Neither is required; with none, audit everything
the config names.

## Preflight context

- Conventions scan: !`node ${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs --conventions`
- Example cookbook: !`node ${CLAUDE_PLUGIN_ROOT}/scripts/install-starter.mjs --list`

Read the scan JSON before anything else. It carries the docs that were read, every rule id
currently enforced, and its own first-pass split into `enforced` and `unenforced`.

The cookbook JSON is the second one: six worked example rules, each with what it
`demonstrates` and the `uses` list of the constructs its body contains. It is the
technique lookup for step 2 and the citation for step 5 — a **catalogue to read from, not
an install menu**. This skill installs nothing and writes nothing.

| Preflight | Meaning | Do |
|---|---|---|
| `mode: "conventions"` | scanned | **Steps**, below |
| `error_type: "config"` | no `.claude/ast-grep.json` | relay `message`, send them to `/ast-grep-rules:init`, stop |
| `error_type: "sgconfig"` | ast-grep's own config is missing or unreadable | relay `message`, send them to `/ast-grep-rules:init`, stop |
| `error_type: "usage"` / `"runtime"` | relay `message` verbatim and stop | — |

A warning that **none of the configured convention docs exist** is a stop with a useful
answer, not a clean audit. Name the paths that were looked for, Glob for what the repo
actually has (`docs/*.md`, `CLAUDE.md`, `constraints.md`, `taste.md`, `spec.md`), and offer
`/ast-grep-rules:init` to point `conventions_path` / `convention_docs` at them. Reporting
"no gaps found" against zero documents is the worst outcome this skill has, because it
reads as a clean bill of health.

An **empty rules inventory** is not an error — a repo with zero rules is the repo that
needs this most. Say so and audit normally.

## Conventions

- **Write nothing.** No rule files, no edits to the convention docs, no ticked checkboxes.
  Every finding is a proposal (C3). The one action this skill takes is invoking
  `/ast-grep-rules:rule`, and only when the user picks a candidate.
- **The scan is a first pass, not the answer.** Treat `unenforced` as *candidates to
  judge* and `enforced` as *claims to verify*. A skill that just prints the JSON back adds
  nothing the script did not already do.
- **Cite or drop it.** Every finding carries `path:line` and the statement *verbatim*.
  A paraphrase is unfalsifiable, and the citation is what the human checks you against.
- **Never invoke `ast-grep` directly.** It is a per-repo devDependency and is not on
  `PATH`. Always the `ast_grep_command` from the config, with arguments appended.
- **One handoff at a time.** `/ast-grep-rules:rule` does one rule per run. Rank the
  candidates, hand over the top one, come back for the next.
- **Not-expressible is a finding, not a failure.** Routing a convention to oxlint or to
  the check script is a real outcome that closes the loop honestly. Silently dropping it
  is what leaves the same gap open next quarter.
- **Cite the cookbook by reference.** An example is read at its path under `examples/` and
  named in the report. Never install one — this skill has no installer and no `Write`, and
  an audit that cites six examples still leaves the rules dir exactly as it found it.

## The technique lookup

Every candidate that survives into `enforceable` names the ast-grep construct that would
express it, and cites the worked example that demonstrates that construct. Two reasons,
and the second is the load-bearing one:

- The handoff to `/ast-grep-rules:rule` arrives concrete — a construct and a worked
  example, rather than a sentence that skill has to re-derive both from.
- **It is the enforceability test.** "Could a parser see a violation of this?" is easy to
  answer optimistically in the abstract, and step 2's whole job is to answer it honestly.
  Naming the construct is what makes the answer falsifiable. A statement you cannot name a
  construct for is a candidate for `needs-type-info` or `wrong-mechanism`, not for the
  work list.

| The shape of the stated claim | The construct | The example |
|---|---|---|
| **A construct is named and banned** — "never declare a class", "no enums", "no namespaces". The thing has a node kind, and every instance has a different body. | `kind:` | `no-enum-declaration` |
| **A call or expression is named** — "always go through the typed wrapper", "nothing calls `.then()`". You can write the violating line as code. | `pattern:`, with `$X` and `$$$ARGS` | `no-promise-then` |
| **The shape is right but the claim turns on a name** — "`it.only` never lands", where the same syntax is fine on anything else. | `pattern:` + `constraints:` + `regex:` | `no-focused-or-skipped-test` |
| **"X, except Y"** — a broad claim with a sanctioned form carved out; or a claim about the text of a comment or string, which has no structure inside it. | `all:` / `any:` / `not:` / `regex:` | `no-unlinked-todo` |
| **The claim is positional** — "no `await` inside a `forEach` callback", "nothing under `runtime/` may import X". It is about where a node sits or what it contains. | `inside:` / `has:`, with `stopBy: end` | `no-async-array-callback` |
| **The claim governs one tree** — "packages may not log", a doc that only speaks for one workspace. | top-level `files:`, and `ignores:` | `no-console-in-packages` |

Open the example with the **Read** tool before citing it —
`${CLAUDE_PLUGIN_ROOT}/examples/rules/<id>.yml`, with its fixture at
`${CLAUDE_PLUGIN_ROOT}/examples/tests/<id>-test.yml`. Not `cat`: these are plugin paths
outside the repo, and a session with tighter Bash permissions than yours will stop on one.
The `note:` block is
where the technique is taught and where its failure modes are — a `kind:` that covers only
one of a construct's several spellings, a `regex:` that finds the word in every string in
the repo. Reading it is also what stops you promising a shape the construct cannot hold.

Two cautions:

- **Do not rank by whether an example exists.** All six techniques are in the cookbook, so
  every enforceable claim maps to one; that says nothing about which candidate is worth
  doing first. Ranking is step 4's job and rests on live violations, blast radius and
  sharpness.
- **The example's policy is not a recommendation.** Each carries an **encodes:** line
  naming the preference it happens to enforce, precisely so it cannot be read as a
  default. You are citing the technique. The convention being enforced is the one this
  repo already wrote down.

## Steps

### 1. Read the docs the scan read

The preflight's `docs` array is the list. Read each one **in full** — the scan only
extracted bullet lines matching a normative cue, and that is the smaller half of any real
convention doc.

What the regex cannot see, and you must add:

- **Prose statements.** "We route every JSON parse through the typed helper" is a
  convention. It is not a bullet, so it is not in `unenforced`.
- **Headings that carry the claim**, with the body only elaborating it.
- **Statements under a table**, or in a numbered list rather than a bulleted one.
- **Conventions stated as a rationale** — "…which is why nothing in `packages/` may import
  across package boundaries by relative path."

Add each one to the candidate set with its own `path:line`. Say plainly in the report how
many candidates came from the scan versus from your own reading; that ratio tells the user
how much of their doc is shaped in a way tools can see.

If `$ARGUMENTS` named a doc or a topic, narrow here — and say what you narrowed to, so a
partial audit never reads as a full one.

### 2. Judge every candidate into one of five buckets

This is the work. The question for each statement is not "is this a good idea" but **can a
parser see a violation of it, without knowing any types**.

| Bucket | What it means | Where it goes |
|---|---|---|
| `enforceable` | stated, structural, and no rule covers it | → `/ast-grep-rules:rule` |
| `already-enforced` | a rule genuinely covers it (verified in step 3) | evidence, not work |
| `needs-type-info` | the violation is only visible once types are *resolved* | → a type-aware linter (oxlint) |
| `wrong-mechanism` | a real gate, but not an AST shape | → the check script, CI, the formatter, tsconfig |
| `not-a-convention` | a fact, a pointer, or a preference | dropped, with the reason said out loud |

**Structural** means the violation has a *shape*: a call to a named function, a syntax
node kind, an import specifier, a keyword, a decorator, an identifier in a position. `class
Foo {}` is a `class_declaration` whether or not anything is imported. `export default` is a
node kind. `JSON.parse(x)` with no wrapper is a call expression.

**Types are the one place the easy reflex is wrong, so split them carefully.** "Anything
about types goes to oxlint" is too blunt and it loses real rules. The question is whether
the convention is about **an annotation being written** or about **what a type resolves
to**:

- **Written down → structural.** "Every exported function declares an explicit return
  type" is about whether a `return_type` field is present on the node. The parser sees
  that without resolving anything:

  ```yaml
  rule:
    kind: function_declaration
    not: { has: { kind: type_annotation, field: return_type } }
  ```

  Same for a written `any`, a written `as` cast, a `@ts-ignore` comment, a missing
  generic parameter. If a human could point at the character that is or isn't there, so
  can ast-grep. These are `enforceable`.
- **Resolved → `needs-type-info`.** "Must return a `Result`" (what does this function
  actually return), "never `any`" where the `any` is *inferred* rather than typed,
  nullability, "don't compare mismatched types", anything about a value's inferred shape.
  No amount of syntax gets there. This routes to a type-aware linter — two entries in the
  source corpus hit exactly this wall, and dropping them silently is how a real convention
  disappears.

**Also not structural**, however firmly stated:
- Anything about **values or runtime** — "timeouts must be under 5s", "keep the bundle
  under 200kb". `wrong-mechanism`: a check script or CI gate.
- Anything about **formatting** — quotes, semicolons, line length. The formatter owns it.
- Anything about **process** — "open a PR before merging", "the changelog lives in
  `CHANGELOG.md`", "prefer small commits". `not-a-convention` as far as this plugin is
  concerned; say so and move on rather than inventing a rule for it.
- **Advisory hedges** — "prefer", "usually", "where possible", "consider". A rule is a
  standing commitment that blocks an edit; a preference is not. If the statement is worth
  enforcing anyway, say the hedge is what you are proposing to harden, and let the human
  decide.

Three more checks before anything lands in `enforceable`:

- **Can you name the construct that would express it?** Take it to **The technique
  lookup** above and come back with a construct and the example that demonstrates it. If
  nothing in the table fits, that is the enforceability answer arriving late — re-judge
  the statement rather than promoting it and hoping `/ast-grep-rules:rule` finds a way.
- **Does another tool already cover it?** Grep the repo's lint config (`oxlint.json`,
  `.oxlintrc.json`, `eslint.config.*`, `tsconfig.json` compiler options). A rule that
  duplicates a linter the repo already runs is pure maintenance cost — that is
  `already-enforced`, by a different tool, and the report should name which.
- **Does an existing rule cover it under a name that reads nothing like the sentence?**
  The scan matches by id tokens, so `no-simple-git` will never token-match "shell out to
  git only through the wrapper". Grep the rule files' `message:` and `note:` text, not just
  their ids, before calling anything a gap.

### 3. Verify the `enforced` claims — do not trust them

The scan's `enforced` list is a token heuristic. `via: "id"` means the statement names the
rule id verbatim and is trustworthy. **`via: "tokens"` is a guess**, and a false positive
here is the only failure in this skill nobody ever sees: the audit reads clean while the
gap stays wide open.

For each `via: "tokens"` entry, Read the cited `rule_file` and ask whether that rule
actually enforces *that sentence*. Watch for:

- **Partial coverage** — the sentence says "never declare classes or interfaces", the rule
  only catches `class_declaration`. That is half a gap, and it belongs in `enforceable` as
  a sibling rule with the overlap stated.
- **Scope mismatch** — the rule's `files:` glob covers `src/` but the convention governs
  the whole repo, or vice versa.
- **Coincidence** — the tokens overlapped and the rule is about something else entirely.

Anything that fails verification moves back into the candidate set and is judged in step 2.
Say in the report which enforced claims you checked and which you demoted.

### 4. Rank what survives

Order the `enforceable` list by evidence, strongest first. The cheap signal is whether the
convention is being violated *right now*:

```bash
<ast_grep_command> run --pattern '<sketch>' --lang ts <src dir>
```

Or `find_code` / `dump_syntax_tree` if the ast-grep MCP server is in your tool list. Both
are read-only and neither is required — if a pattern sketch is not obvious in one attempt,
skip it and rank on judgment. A blocked audit helps nobody.

Rank on:

1. **Live violations** — a convention violated in code that exists today is a rule with
   immediate work behind it. Say how many hits and where.
2. **Blast radius** — a convention about imports or module boundaries outranks one about a
   single helper.
3. **Sharpness** — a statement with an obvious AST shape outranks one you would have to
   argue about, because the rule will be right on the first try.

Zero live violations is not a reason to drop a candidate. A rule with no current hits is a
rule that lands green and stays green — often the best kind to add.

### 5. Report

Lead with the count, then the work list. Every entry cites `path:line` and quotes the
statement verbatim.

**`enforceable` — the work list.** For each, in `/ast-grep-rules:rule`'s own opening shape,
because that is what it asks for first:

- **Proposed id** — kebab-case, `no-<thing>` is the corpus convention.
- **The citation** — `docs/conventions.md:12`, and the sentence, quoted.
- **Must fail** — one concrete, compilable line that violates it.
- **Must pass** — one concrete near-miss line that must stay quiet.
- **Technique** — the construct that expresses it, and the example that demonstrates that
  construct, by path: *"`kind:` — see `examples/rules/no-enum-declaration.yml`."* One
  line. Say once, at the top of the work list, that these are read rather than installed,
  so a report citing three examples cannot be mistaken for three rules about to land.
- **Live hits**, if step 4 found any.

**The routed buckets, each with its statement and its destination.** `needs-type-info`
names the type-aware linter; `wrong-mechanism` names the tool that should hold the gate.
Nothing gets dropped without a line saying why — a convention you silently discarded is
one the user will keep re-auditing.

**`already-enforced`**, one line each: statement → rule id → file. Plus any you demoted in
step 3, which are the most interesting lines in the report.

**One closing line on the other direction of the diff:** rule ids in the inventory that no
statement in any doc corresponds to. Those rules are enforced but undocumented — a docs
gap rather than a rule gap, and not this skill's job to fix, but worth naming while you
have both lists in hand.

If nothing is enforceable, say exactly that. A clean audit against real documents is a
good result and a real answer — do not manufacture candidates to fill the report.

### 6. Hand off

Offer the top candidate to `/ast-grep-rules:rule` by id, carrying the citation, both
samples and the construct-plus-example from the lookup, so it starts from step 2 of its own
flow rather than re-deriving them. That skill has the same cookbook in its own preflight
and will read the example itself; handing it over means it does not have to guess which.
Wait for the user to pick — they may want a different one, or none.

Then, two follow-ups worth naming once:

- **After a rule lands, its id in the doc line makes the next audit exact.** A convention
  written as "Never use `export default` (`no-default-export`)" matches `via: "id"` from
  then on, instead of being re-judged by a token heuristic every run. Suggest it; the write
  belongs to the human or to `/ast-grep-rules:rule`, not here.
- `/ast-grep-rules:lesson` for anything in the routed buckets that deserves to come back —
  a `needs-type-info` convention is still a real convention, just one this tool cannot hold.

## When to use this skill

- Adopting `ast-grep-rules` in a repo that already has `docs/conventions.md`, `CLAUDE.md`,
  `constraints.md` or a spec doc — this is the natural first move after
  `/ast-grep-rules:init`.
- The user asks what should have a rule, what the docs say that nothing checks, or which
  conventions are unenforced.
- A convention doc just changed, or a new one was written.
- Periodically, as the rules dir grows — the diff drifts in both directions.
- Before `/ast-grep-rules:rule`, when the candidate is not already decided.

## When NOT to use this skill

- **To author a rule.** That is `/ast-grep-rules:rule`; this skill only finds the work.
- **To mine the friction log.** That is `/ast-grep-rules:mine`, reading
  `docs/lessons.md`. Different input, same destination.
- **The repo is not configured yet** — `/ast-grep-rules:init` first.
- **The repo has no written conventions at all.** There is nothing to diff against. Say so
  plainly; writing the conventions doc is the prerequisite, and inventing conventions to
  audit against would be inventing house style on the user's behalf.

## Edge cases

- **A doc that is one long prose essay with no bullets.** The scan will return an empty
  `unenforced` list and it means nothing. Read the doc; step 1 is the whole audit here, and
  the report should say the scan contributed nothing.
- **A monorepo where a doc governs one package.** Say which tree each convention actually
  governs, and note it as the `files:` glob the eventual rule will need —
  `examples/rules/no-console-in-packages.yml` is the worked case, including why `files:`
  is a sibling of `rule:` rather than something inside it. A repo-wide rule for a
  package-local convention is a rule that gets suppressed everywhere.
- **The same convention stated in two docs.** Report it once, cite both locations.
- **A convention already declined once.** You cannot know that from here — this skill has
  no memory and no store. That is the point of suggesting the rule id in the doc line, and
  of `/ast-grep-rules:lesson` for the routed ones.
- **A statement that contradicts an existing rule.** Say so loudly and stop short of
  proposing anything. One of the two is out of date and only the human knows which.
- **A convention with a real AST shape and dozens of live violations.** Still a candidate,
  but say the count up front — `/ast-grep-rules:rule` will land it red against the repo's
  own code, and the honest routes there are `severity: warning`, an `ignores` entry, or
  fixing the code first.
- **`$ARGUMENTS` names a doc that is not in the configured set.** Audit it anyway, and note
  that adding it to `convention_docs` via `/ast-grep-rules:init` is what makes it stick.
