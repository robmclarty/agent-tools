# ast-grep-rules

Adaptive structural lint for TypeScript, as a Claude Code plugin. It turns the
conventions a repo has already written down — and the friction its sessions
keep hitting — into enforced [ast-grep](https://ast-grep.github.io/) rules,
each landing with the test fixture that proves it works.

Two mechanisms feed the same endpoint, and they are deliberately unequal:

- **`/ast-grep-rules:audit` — the headline.** Diff the conventions your docs
  state against the rule ids you actually enforce, and report the gaps. In the
  repos this plugin was distilled from, every rule authored after the initial
  scaffold — six of six — came from exactly this move, and none from mining
  friction logs.
- **The lesson loop — the long-tail feeder.** A `PostToolUse` hook notices an
  edit that takes work back and offers `/ast-grep-rules:lesson`;
  `/ast-grep-rules:mine` reads the log back and routes every entry to wherever
  it can actually be enforced. Slower to yield, but it catches what no doc
  ever stated.

Both hand their candidates to **`/ast-grep-rules:rule`**, which refuses to
finish until `ast-grep test` passes on the fixture it scaffolds alongside the
rule.

The design splits three concerns:

- **Invariant skills** (`skills/`) — `init`, `audit`, `rule`, `lesson`,
  `mine`: the workflows, the same in every repo.
- **Deterministic scripts** (`scripts/`, zero dependencies) — `config.mjs`
  resolves the per-repo contract, `scan.mjs` owns the rules inventory and both
  scan modes, `scaffold-rule.mjs` emits the rule + fixture pair,
  `install-starter.mjs` catalogues and copies the worked examples. Each runs
  in a skill's preflight, before the model reasons, and prints one JSON
  object.
- **A per-repo config** (`.claude/ast-grep.json`) — only what genuinely
  varies. Generated once by `/ast-grep-rules:init`; every path ast-grep
  already knows is read from the repo's own `sgconfig.yml` instead.

## Install

```shell
/plugin marketplace add robmclarty/agent-tools
/plugin install ast-grep-rules@robmclarty
```

## Quick start

Once per repo:

```shell
/ast-grep-rules:init
```

It detects the layout, generates `.claude/ast-grep.json`, and — when the repo
has no ast-grep at all — offers to bootstrap a minimal `sgconfig.yml`.
Nothing is written without your approval, and a second run reports the
resolved config instead of overwriting it. Then:

```shell
/ast-grep-rules:audit    # find stated conventions nothing enforces
/ast-grep-rules:rule     # promote one to a rule + passing fixture
/ast-grep-rules:lesson   # record one friction event (the hook offers this)
/ast-grep-rules:mine     # read the friction log back and route every entry
```

## The audit loop

`/ast-grep-rules:audit` reads the docs your config names — `conventions_path`
plus every entry in `convention_docs` — and diffs the conventions they state
against the rule ids present in your rules directory. A deterministic first
pass (`scan.mjs --conventions`) catches the normative bullet lines; the skill
then reads the docs themselves, because real conventions also live in prose
paragraphs the scan cannot see. Every "already enforced" claim is verified by
reading and running the rule rather than trusting a name match — a token match
reported as enforced is the one failure nobody ever sees. What comes back is
the list of unenforced conventions, each with a `path:line` citation for where
it is stated and a proposed rule id, handed to `/ast-grep-rules:rule`. The
skill is read-only by construction: no `Write`, no `Edit`.

## The lesson loop

The feeder has three stages, and each fixes a way the mechanism has stalled
before:

1. **The hook.** A `PostToolUse` command hook watches `Edit`/`Write` on
   `.ts`/`.tsx` files and asks one question the diff alone cannot answer: is
   this edit rewriting code *the assistant itself wrote earlier in this
   session* — and did you say something in between? A human turn between the
   assistant's own edits is the correction signature; the same rewrite with no
   turn between is the weaker undo signature. Ordinary forward progress stays
   silent, and so does the second edit of an episode that already offered once.
   On a hit it *offers* `/ast-grep-rules:lesson`; it never writes anything
   itself. (Recording friction by remembering to invoke a skill is the
   discipline that failed everywhere it shipped.)

   The gate is a deterministic script — no model call, ~40ms, reading the
   session transcript. It started as an LLM judging each diff in isolation,
   which could not see the conversation and so could not detect a correction at
   all; it stayed silent on the turn that carried the friction and fired on one
   that did not. It also fails open: any unreadable input is silence, never a
   broken turn.
2. **`/ast-grep-rules:lesson`** appends one template-conforming entry to the
   friction log (`lessons_path`, default `docs/lessons.md`) — append-only
   prose, thirty seconds, worth it even when nothing structural follows. A
   recurrence amends the existing entry rather than splitting the evidence.
3. **`/ast-grep-rules:mine`** classifies every recorded `- [ ] rule:` judgment
   into five buckets — `promotable`, `declined-none`, `needs-type-info`,
   `wrong-mechanism`, `already-consumed` — and routes instead of gating:
   type-resolution claims go to a type-aware linter by name, process claims to
   your check script, and the promotable ones to `/ast-grep-rules:rule`. There
   is no corpus-size threshold anywhere; it runs honestly on a log of one
   entry. (Its predecessor required ten entries and three-lesson clusters, and
   never once ran.)

## The rule gate

`/ast-grep-rules:rule` is where both mechanisms land. It prefers a repo-local
`scaffold_command` when your config names one and writes the YAML itself when
none exists — either way the same three files must exist before it reports
done: the rule, a `<id>-test.yml` fixture with `valid:`/`invalid:` cases, and
the recorded snapshot, with a plain `ast-grep test` green across them. A
freshly scaffolded rule is born red on purpose — the placeholder pattern
matches nothing, so an unfinished rule cannot masquerade as a passing one.
Every emitted rule documents the trailing `// ast-grep-ignore: <rule-id>`
suppression form in its note.

## The cookbook — `examples/`

Six worked rules, each demonstrating a distinct ast-grep technique. **They are
teaching material, not a ruleset.** Each carries a `demonstrates:` line naming
its technique and an `encodes:` line naming the preference it embodies, so it
cannot be mistaken for a recommendation — delete every policy in the set and
the techniques still stand. `/ast-grep-rules:init` installs an example only
when you name it; `/ast-grep-rules:rule` and `/ast-grep-rules:audit` cite them
by reference while authoring, never by installing.

| Example | Technique it demonstrates | Preference it encodes (yours to reject) |
|---|---|---|
| `no-enum-declaration` | `kind:` — match a construct by its tree-sitter node name, no pattern at all | types that erase over constructs that emit runtime code |
| `no-promise-then` | `pattern:` with metavariables — `$NAME` is one node, `$$$ARGS` zero or more | `await` over promise chains |
| `no-focused-or-skipped-test` | `constraints:` — capture a metavariable, then narrow it (usually with `regex:`) | a committed `.only`/`.skip` is a defect, not a checkpoint |
| `no-unlinked-todo` | composite `all:`/`regex:`/`not:` — "this, but not that" | TODOs a tracker can find (`TODO(#123):`) |
| `no-async-array-callback` | relational `inside:`/`has:` with `stopBy: end` | concurrency written down rather than implied |
| `no-console-in-packages` | `files:` scoping — a top-level key deciding which files are opened at all | libraries hand information back instead of printing it |

Every example ships its fixture and recorded snapshot, and the set is green
under `ast-grep test`.

## Configuration

`.claude/ast-grep.json` — see
[`templates/ast-grep.example.jsonc`](templates/ast-grep.example.jsonc) for the
annotated reference. Every key is optional; `{}` is a valid config for a
conventionally-laid-out repo.

| Key | Purpose |
|-----|---------|
| `sgconfig` | Path to the repo's `sgconfig.yml` (default `sgconfig.yml`). |
| `lessons_path` | The friction log `/lesson` writes and `/mine` reads (default `docs/lessons.md`). |
| `conventions_path` | The primary conventions doc `/audit` diffs against enforced rules (default `docs/conventions.md`). |
| `convention_docs` | Additional docs that state conventions — spec, constraints, taste files (default `["CLAUDE.md"]`). |
| `ast_grep_command` | How to invoke ast-grep — a command prefix, since it is usually a devDependency rather than on `PATH` (default `pnpm exec ast-grep`). |
| `scaffold_command` | Optional repo-local rule scaffolder; when set, `/rule` prefers it. `null` means the plugin writes the YAML itself. |

What is *not* here is the point: `rules_dir`, `utils_dir`, `tests_dir` and
`snapshot_dir` are read from the repo's own `sgconfig.yml`, never restated —
ast-grep already owns that mapping, and duplicating a path that genuinely
varies across repos only invites skew.

TypeScript-only for v1, as a deliberate limit rather than an accident.

## Authoring notes

Three findings this plugin's own build paid for, recorded so you don't pay
again:

- **Tested against `@ast-grep/cli` 0.45.0 — where snapshots are not
  optional.** On 0.42.1 a fixture with `invalid:` cases ran green without a
  recorded snapshot; on 0.45.0 the same fixture *fails* ("Test failed due to
  mismatching snapshots", exit 4) until `ast-grep test -U` records one. That
  is why every bundled example ships its snapshot, and why `/rule` treats the
  snapshot as part of reaching green — three files, not two.
  `--skip-snapshot-tests` is the escape hatch.
- **To run this plugin from a working tree, use `--plugin-dir`.**
  `claude --plugin-dir <checkout>/plugins/ast-grep-rules` loads it for one
  session and leaves no residue. Registering the checkout as a *local
  marketplace* instead files it under the manifest's own name — colliding
  with the same-named marketplace already registered from GitHub.
- **A rule that matches comment nodes cannot be suppressed from inside the
  comment it flags.** ast-grep reads a comment that starts its own line as a
  suppression directive for the *next* line, so
  `// TODO: fix // ast-grep-ignore: no-unlinked-todo` leaves the TODO flagged
  and the embedded ignore unused. The directive has to be its own comment on
  the line above. (For code nodes the trailing same-line form works as
  documented.)

## The scripts, standalone

Each is plain Node with zero dependencies and prints one JSON object:

```shell
node scripts/config.mjs                  # the resolved per-repo contract
node scripts/scan.mjs --conventions      # stated conventions × enforced rule ids
node scripts/scan.mjs --lessons          # friction-log checkbox classification
node scripts/install-starter.mjs --list  # the example catalogue, with each
                                         # rule's demonstrates/encodes lines
```

## License

MIT
