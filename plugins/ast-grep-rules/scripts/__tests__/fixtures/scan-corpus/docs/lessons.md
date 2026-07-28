# Lessons

Friction log for this fixture repo. Hand-authored to reproduce the *shape* of the
real four-repo corpus — 11 `rule:` checkboxes whose mix matches the field evidence,
one entry with no checkbox, and this fenced template, which every real file carries
and which the scan must never count:

```markdown
## YYYY-MM-DD

### Lesson: <one-line title>

**What happened:** <the friction, one short paragraph>

**What fixed it:** <the correction that landed>

**Potential next step:**

- [ ] rule: <ast-grep pattern sketch, or `none` and why>

**Related:** <files, commits, prior lessons>
```

## 2026-04-18

### Lesson: Fence-matching regexes drifted unanchored

**What happened:** two scripts matched code fences mid-line because their regex
literals carried no anchors, so an indented example inside a list toggled fence
state and swallowed the rest of the file.

**What fixed it:** anchored both literals to full-line fences and added a test.

**Potential next step:**

- [ ] rule: anchor fence-matching regex literals — an ast-grep pattern over regex
  literals that contain a triple backtick but neither `^` nor `$` would have
  caught both call sites.

**Related:** scripts/render.mjs, scripts/toc.mjs

### Lesson: Awaited a callback that returns void

**What happened:** wrapped a synchronous callback in `await`, which read as fine
and did nothing.

**What fixed it:** removed the `await`; the callee never returned a promise.

**Potential next step:**

- [ ] rule: none — deciding this needs the callee's return type, which ast-grep
  cannot see; type information is oxlint type-aware territory.

**Related:** src/pipeline.ts

### Lesson: String/Buffer confusion in the encoder

**What happened:** passed a `Buffer` where a `string` was expected; the encoder
double-encoded silently.

**What fixed it:** normalized at the boundary and typed the parameter tightly.

**Potential next step:**

- [ ] rule: not expressible structurally — telling `string` from `Buffer` takes
  type info, so route this to an oxlint type-aware rule instead.

**Related:** src/encode.ts

### Lesson: Debug console.log shipped in a release

**What happened:** a debug `console.log` left in the packaged CLI printed internal
paths for every user.

**What fixed it:** routed output through the logger and cut a patch release.

**Potential next step:**

- [x] rule: no-console-log — promoted; `rules/text-hygiene.yml` carries it.

**Related:** src/cli.ts

### Lesson: Generated artifacts landed in src/

**What happened:** a build step wrote compiled `.js` next to its sources, and the
diff hid a real change.

**What fixed it:** pointed the build at `dist/` and cleaned the tree.

**Potential next step:**

- [ ] rule: this is a check-script gate — fail when `src/` contains generated
  `.js` files — not an AST shape at all.

**Related:** scripts/build.sh

## 2026-04-19

### Lesson: Misread the CLI flag name

**What happened:** passed `--dry_run` where the flag is `--dry-run`; the CLI
ignored it silently.

**What fixed it:** re-read the help output and fixed the call.

**Potential next step:**

- [ ] rule: none

**Related:** scripts/publish.sh

### Lesson: Committed before running the check

**What happened:** pushed a red tree because the check never ran locally.

**What fixed it:** re-ran the check and amended.

**Potential next step:**

- [ ] rule: none — a process error, not a code shape.

**Related:** scripts/check.sh

### Lesson: Ambiguous config key name

**What happened:** set `sgconfig` to a directory because the key name reads like
one; it wants the file path.

**What fixed it:** pointed it at the file and documented the shape.

**Potential next step:**

- [ ] rule: none (the fix was documentation, not enforcement).

**Related:** templates/ast-grep.example.jsonc

### Lesson: Transposed the arguments to rename

**What happened:** swapped source and destination once, caught it in review.

**What fixed it:** nothing structural — a one-off typo.

**Potential next step:**

- [ ] rule: none — one-off, no recurring pattern to encode.

**Related:** scripts/migrate.mjs

### Lesson: An empty catch swallowed a real error

**What happened:** a `catch {}` written for a probe also swallowed a permissions
error for an hour.

**What fixed it:** narrowed the probe and logged everything else.

**Potential next step:**

- [ ] rule: could match empty catch blocks, but the legitimate probes in this
  repo outnumber the mistakes — not worth a rule.

**Related:** scripts/probe.mjs

### Lesson: Mixed up readFile and readFileSync

**What happened:** treated the async form as sync and read an unresolved promise.

**What fixed it:** used the sync form; the confusion was the API's naming.

**Potential next step:**

- [ ] rule: no rule — a name choice has no structural form to hook.

**Related:** scripts/ingest.mjs

### Lesson: Watched a slow test, took notes

**What happened:** the fixture suite crossed two seconds; noted, not yet friction.

**What fixed it:** nothing yet — recorded to watch for recurrence.

**Potential next step:** nothing to promote — watching for recurrence.

**Related:** scripts/__tests__/
