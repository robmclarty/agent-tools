---
name: rule
description: Add a new ast-grep structural lint rule to this repo, together with the *-test.yml fixture that proves it works. Use when a convention isn't enforced yet, when the same mistake has now happened twice, or when /audit or /mine hands over a candidate. The rule is not finished until `ast-grep test` passes.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs*), Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/scaffold-rule.mjs*), Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/install-starter.mjs --list), Bash(pnpm exec ast-grep*), Bash(npx --no-install ast-grep*), Bash(yarn exec ast-grep*), Bash(./node_modules/.bin/ast-grep*), Bash(pnpm scaffold*), Bash(npm run scaffold*), Bash(yarn scaffold*), mcp__ast-grep__dump_syntax_tree, mcp__ast-grep__test_match_code_rule, mcp__ast-grep__find_code, mcp__ast-grep__find_code_by_rule
---

# rule

Promote one convention to an enforced structural rule. This is where every other
mechanism in the plugin ends up: `/ast-grep-rules:audit` finds a convention no rule
enforces, `/ast-grep-rules:mine` finds friction that recurs, and both hand the candidate
here.

**A rule is two files, not one.** `<rules_dir>/<id>.yml` is what fires;
`<tests_dir>/<id>-test.yml` is what proves it fires on the right things and stays quiet on
the rest. The second one is not optional and not a follow-up — it is the only part of this
conversation that survives it. The corpus is unambiguous about which half goes missing: one
repo has a rule scaffolder and an empty tests directory, another has ten fixtures and no
scaffolder. This skill always produces both.

`$ARGUMENTS` — a kebab-case rule id, a description of the pattern, or both. Neither is
required; ask if you have neither.

## Preflight context

- Resolver result: !`node ${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs`
- Example cookbook: !`node ${CLAUDE_PLUGIN_ROOT}/scripts/install-starter.mjs --list`

Read the resolver JSON before anything else. It carries the rules dir, the tests dir, the
command that runs ast-grep in *this* repo, and whether a repo-local scaffolder exists.

The cookbook JSON is the second one, and it is a **lookup table, not an install menu**:
six worked example rules, each carrying what it `demonstrates`, the `uses` list of the
constructs its body actually contains, and a `path` pair — `path.rule` and `path.test` —
naming exactly where to read that example. Step 4 matches the rule you are about to write
against that list, and opens the winner at the path the listing gave. Nothing in this
skill installs from it.

| Preflight | Meaning | Do |
|---|---|---|
| `mode: "config"` | configured | **Steps**, below |
| `error_type: "config"` | no `.claude/ast-grep.json` | relay `message`, send them to `/ast-grep-rules:init`, stop |
| `error_type: "sgconfig"` | ast-grep's own config is missing or unreadable | relay `message`, send them to `/ast-grep-rules:init`, stop |
| `error_type: "usage"` / `"runtime"` | relay `message` verbatim and stop | — |

A `warnings` entry saying sgconfig declares no `testConfigs` is a **stop**, not a note:
there is nowhere to put the fixture, so the rule cannot be finished. Relay it and send
them to `/ast-grep-rules:init`, which offers to add one.

## Conventions

- **Never invoke `ast-grep` directly.** It is a per-repo devDependency and is not on
  `PATH`. Always the preflight's `ast_grep_command`, with arguments appended.
- **Never write a rule file by hand.** Scaffold it, then edit the TODOs. Hand-written
  YAML is how the four source repos ended up with six variants of the same rule.
- **Cite the cookbook, never install from it.** An example is read at the `path` its
  preflight entry carries, and named in the report. A run that cites three examples still
  writes zero files from them — the only rule this skill produces is this repo's own, at
  the id the user asked for.
- **Never `-U` before the rule is right.** `-U` freezes whatever the rule currently does,
  so recording early just enshrines the wrong answer as the expected one.
- **Never edit source to satisfy a new rule without asking.** Report the hits, offer the
  routes, let the human pick (C3).
- **One rule per run.** If the pattern really needs two rules, finish the first.

## Steps

### 1. Write the two samples first

Before any YAML: one code sample that **must fail** the rule and one that **must pass**.
Concrete, compilable lines, not descriptions. Everything downstream is built from these —
they become the first entries of the fixture, and if you cannot write them the rule is not
yet a rule, it is a feeling.

If the user gave you a pattern but no id, propose a kebab-case id now
(`no-<thing>` is the corpus convention) and say what it will be called.

### 2. Check what is already enforced

The preflight names `paths.rule_dirs`. Grep them for the shape you are about to add.

- **A rule already covers it** → fix that rule instead. Two rules for one idea is how the
  pair drifts apart, and the scaffolder will refuse the id anyway.
- **A rule covers part of it** → decide deliberately: widen the existing rule, or add a
  narrower sibling and say in both `note:` blocks how they divide.
- **oxlint or `tsc` already covers it** → say so and stop. A rule that duplicates a linter
  the repo already runs is pure maintenance cost. Anything needing *type* information —
  return types, inferred shapes, nullability — ast-grep structurally cannot see; route it
  to a type-aware linter instead of writing a rule that half-works.

### 3. Inspect the AST before guessing at a pattern

The single biggest source of rules that match nothing (or everything) is a wrong mental
model of the tree.

**If the `ast-grep` MCP server is available** (its tools appear in your tool list — it is
configured in a good number of repos), use it, in this order:

| Tool | Use it for |
|---|---|
| `dump_syntax_tree` | the fail sample, before writing anything — see the real node kinds |
| `test_match_code_rule` | a drafted rule against both samples, before it touches disk |
| `find_code` | sanity-check a pattern without promoting it to a rule |
| `find_code_by_rule` | preview real hits across the repo |

**If it is not available** — and it must not be required — the CLI does the same work:
`<ast_grep_command> run --pattern '<pattern>' --lang ts <path>` to check a pattern against
real files, and the fixture loop in step 7 for everything else. Never treat a missing MCP
server as a blocker; say you are on the CLI path and continue.

**Probe against files that already exist.** The repo's own sources are the best test
material and cost nothing. If you genuinely need a scratch sample, put it in the fixture's
`valid:` / `invalid:` lists — that is what they are for — rather than writing a throwaway
`.ts` file into the repo. This skill's deliverable is three files; a fourth left behind in
someone's working tree is litter, and you may not be able to remove it.

### 4. Find the example that demonstrates this shape

You now know what the rule must catch (step 1) and what the tree actually looks like
(step 3). Before any YAML, name the ast-grep construct that expresses it — and read the
worked example that demonstrates that construct. The cookbook is six rules, each chosen
to teach exactly one thing. The preflight `--list` carries their `demonstrates` and `uses`
lines; the file itself carries the reasoning.

| The claim you are enforcing | The construct | Read |
|---|---|---|
| **Ban a construct outright** — "no enums", "no classes", "no namespaces". It has a node kind, and every instance has a different body, so there is no useful pattern for it. | `kind:` | `no-enum-declaration` |
| **Ban a call or expression shape** — "nothing calls `.then()`", "no bare `JSON.parse`". You can write the offending line as code. | `pattern:`, with `$X` and `$$$ARGS` | `no-promise-then` |
| **The pattern is right but too broad, and the difference is a name** — `it.only` yes, `router.only` no. | `pattern:` + `constraints:` + `regex:` | `no-focused-or-skipped-test` |
| **"This, but not that"** — a broad claim with the sanctioned form carved back out; or the node is a leaf (a comment, a string) with no structure to grip. | `all:` / `any:` / `not:` / `regex:` | `no-unlinked-todo` |
| **The claim is about context** — where the node sits, or what it contains. "No `await` inside a `forEach` callback." | `inside:` / `has:`, with `stopBy: end` | `no-async-array-callback` |
| **The convention governs part of the tree** — "packages may not log", "this applies under `src/` only". | top-level `files:`, and `ignores:` | `no-console-in-packages` |

Open it with the **Read** tool, at the paths the preflight listing gives for that id:
`path.rule` for the rule, `path.test` for its fixture. Take both from the JSON rather than
composing them — the cookbook's layout is the installer's business, not this skill's, and
a path spelled out here goes stale the first time it moves. Not `cat`: these are plugin
paths outside the repo, and a session with tighter Bash permissions than yours will stop
on one. The `note:` block is
where the technique is taught, including the failure modes that cost the most time: one
construct wearing several kind names, a `regex:` that finds the word in every string you
have, a comment rule that cannot be suppressed by a comment on its own line. The fixture
shows how much `valid:` coverage the technique needs before it can be trusted.

**Two fitting is ordinary.** Most real rules compose — `no-async-array-callback` is itself
`kind:` plus `all:` plus `regex:` plus a nested `inside:`/`has:`. Read both.

**Nothing fitting is a signal, not a gap in the cookbook.** If you cannot name a construct
after dumping the tree, the claim may not be structural at all. Go back to step 2's
type-information test before you scaffold anything.

Take the technique and leave the policy. Every example also enforces something, because a
rule enforcing nothing would demonstrate nothing, and each one says which on an
**encodes:** line beside its **demonstrates:** line. That line is a caveat, not a
recommendation: none of these is a default, and the rule you are about to write is this
project's.

### 5. Scaffold both files

Branch on `scaffold_command` from the preflight. This is a capability flag, not two
different skills — both branches end at the same two files.

**`scaffold_command` is set** — the repo has its own scaffolder, and it is authoritative
for the rule file's house shape (`files:`, `ignores:`, severity conventions):

```bash
<scaffold_command> <id>
node ${CLAUDE_PLUGIN_ROOT}/scripts/scaffold-rule.mjs <id> --fixture-only
```

Repo scaffolders write the rule and nothing else — none of the ones in the field emit a
fixture. Check what actually landed: if it did write a fixture, keep theirs and skip the
second command; if it wrote the rule somewhere unexpected, report where and do not write a
second copy.

**`scaffold_command` is `null`** — the plugin writes both:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/scaffold-rule.mjs <id>
```

Either way the script refuses rather than clobbers: a non-kebab id, an id already in the
inventory, or an existing file each come back as `mode: "error"` with a message worth
relaying verbatim.

**The scaffold is deliberately red.** It ships `pattern: TODO_REPLACE_ME` and placeholder
samples that cannot match it, so `<ast_grep_command> test` fails until you finish. Do not
"fix" that by deleting the fixture — finishing it is the job.

### 6. Fill in the rule

Three TODOs, each a judgment call:

- **`message:`** — one line, present tense, with a *runnable* exemplar and a docs anchor:
  `"Use a named export: \`export const fn = () => {}\` — not \`export default fn\`. See docs/conventions.md#named-exports."` This is what someone sees at the moment they are
  blocked, so the fix belongs in it.
- **`note:`** — the long form, read by a future model when the rule blocks its edit.
  Answer three questions: why is this wrong *here* (the project reason), what is the
  replacement as a pasteable line, and when is suppression legitimate. **Keep the
  suppression stanza the scaffold gave you.** The working form is a trailing
  `// ast-grep-ignore: <id>` comment on the offending line; the `ast-grep-ignore-next-line`
  form that older rules in the wild document **does not work**, so never write it into a
  note, not even as a counter-example.
- **`rule:`** — write the construct step 4 named, with that example open. Prefer `kind:`
  over `pattern:` where you can; `kind: class_declaration` tolerates syntax it has never
  seen and `pattern: class $X { $$$ }` does not. Use `stopBy: end` on relational rules
  (`inside`, `has`). Use `not:` sparingly — a narrower positive rule reads better than a
  negated broad one.
- **`files:`** ships commented out, because no source glob is portable. Uncomment and set
  it if the rule should only govern part of the tree; leave it off to let the rule apply
  everywhere ast-grep already scans.

If the rule has known false positives you cannot design away, `severity: warning` is the
honest setting. Errors block; warnings inform.

### 7. Fill in the fixture, then drive it green

Replace both placeholder lists with real samples. `invalid:` is every shape the rule must
catch; `valid:` is every near-miss it must leave alone — that second list is what catches
an over-broad rule, and it is the one everybody under-writes. Include the edge cases the
pattern is most likely to trip on: template literals, generics, `async`, JSX, re-exports.

```bash
<ast_grep_command> test
```

Iterate until every case reports the verdict you intended. A surprising result means the
AST is not the shape you assumed — go back to step 3 and dump the tree again rather than
adding special cases.

Two failure shapes read very differently, and the marker after the rule name tells you
which you have:

| Marker | Meaning |
|---|---|
| `.M` | **Missing** — an `invalid:` case reported nothing. The rule does not match what it must. |
| `.W` | **Wrong/missing snapshot** — the rule matched, but no recorded snapshot agrees. That is step 8, not a rule bug. |

### 8. Record the snapshots

A fixture with `invalid:` cases is **not green until its snapshot exists** — `ast-grep
test` fails with *"Test failed due to mismatching snapshots"* even when the rule matches
exactly the right code. So this step is part of finishing, not an extra:

```bash
<ast_grep_command> test -U    # records <snapshot_dir>/<id>-snapshot.yml
<ast_grep_command> test       # must now be green with no flags at all
```

Run `-U` only once the rule is right (step 7), never to make a red test go away. Then
**read the snapshot before moving on**: it records the exact source span each match
highlights, so a span wider than you intended is a rule quietly matching more than you
think — the one failure mode `valid:` / `invalid:` alone cannot show you.

Say plainly that a third file was written, and where. If a repo has deliberately decided
against snapshots, `--skip-snapshot-tests` is the documented escape hatch — but keeping
them is the default, and the plain no-flag `test` above is the run that has to be green.

### 9. Preview what it finds in code that already exists

```bash
<ast_grep_command> scan --rule <rules_dir>/<id>.yml
```

Report every hit with its file and line. For each, offer three routes and **take none of
them without approval**:

1. **Fix the code** — the usual answer when the rule is right.
2. **Add the path to `ignores`**, with a comment naming why it is exempt.
3. **Narrow the rule** — the right answer when legitimate exceptions pile up. More than a
   couple means the rule is wrong, not the code. Back to step 6.

A rule that lands red against its own repo is a rule everyone learns to ignore, so say
plainly how many hits are outstanding.

### 10. Report

- The three files written, at their real paths.
- The example you read in step 4 and the technique you took from it — one line, and say
  it was read rather than installed, so nobody goes looking for a fourth file.
- The `ast-grep test` result, from the plain no-flag run.
- Hits outstanding in existing code, and what was decided about each.
- If this rule came from a `docs/lessons.md` entry, offer to tick that entry's
  `- [ ] rule:` checkbox to `[x]` so `/ast-grep-rules:mine` stops re-proposing it.
- `/ast-grep-rules:audit` as the natural next move — most rules come from conventions the
  docs already state.

## When to use this skill

- A convention in `docs/conventions.md`, `CLAUDE.md` or a spec doc is stated but nothing
  enforces it.
- `/ast-grep-rules:audit` or `/ast-grep-rules:mine` handed over a candidate.
- The same structural mistake has now happened twice, in different contexts.
- An existing rule is too broad or too narrow and needs a sibling.

## When NOT to use this skill

- **The check needs type information.** Return types, inferred shapes, nullability —
  ast-grep sees syntax, not types. Route it to a type-aware linter; that is a real,
  recurring outcome, not a failure.
- **oxlint or `tsc` already covers it.** Enable that instead.
- **It is a one-off.** Record it with `/ast-grep-rules:lesson` and wait for a second
  occurrence; a rule is a standing commitment.
- **It is formatting.** That is the formatter's job.
- **The repo is not configured yet** — `/ast-grep-rules:init` first.

## Edge cases

- **The user abandons mid-run.** The scaffolded pair is red by design, so leaving it
  behind makes `ast-grep test` red for everyone. Offer to delete both files, and say which
  ones they are.
- **`scaffold_command` fails or writes somewhere unexpected.** Report exactly what it did
  and what it produced. Fall back to `scaffold-rule.mjs <id>` only if it wrote nothing;
  never write a second copy of a rule it already created.
- **The configured `ast_grep_command` is unusual.** The four common forms are pre-approved;
  anything else will surface a permission prompt on first use. Expected — approve it and
  continue.
- **A rule id collides.** The scaffolder refuses and names the file. Fix that rule.
- **The user wants the cited example installed rather than adapted.** That is
  `/ast-grep-rules:init`'s cookbook step, which owns the installer; this skill only reads.
  Hand it over and finish the rule they actually asked for.
- **The repo has no `testConfigs`.** Stop and route to `/ast-grep-rules:init`. Do not
  invent a tests directory that ast-grep has not been told about — the fixture would never
  run, which is worse than no fixture at all.
- **The candidate turns out not to be structurally expressible.** Say so plainly and stop.
  A rule that only half-matches the convention is worse than the convention staying prose,
  because it reads as enforced.
