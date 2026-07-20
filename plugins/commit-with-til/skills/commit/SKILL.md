---
name: commit
description: Creates a conventional commit with TIL extraction for code-diary. The commit message uses code-diary's categorization format; learning moments become TIL: entries that code-diary's parser extracts.
argument-hint: [optional scope or context]
disable-model-invocation: true
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/scripts/commit.sh *) Bash(git status *)
---

# Commit with TIL Extraction

Repository state is pre-loaded below. Compose a conventional commit message and hand off staging + committing to the plugin's `scripts/commit.sh`, which enforces the never-stage filter deterministically.

## Repository state (pre-loaded)

```!
echo "=== git status ==="
git status
echo
echo "=== staged diff ==="
git diff --cached
echo
echo "=== unstaged diff ==="
git diff
echo
echo "=== recent commits (style reference) ==="
git log --oneline -5
```

## Workflow

One tool call (`Bash`):

1. From the diffs above, determine what changed and why. Pick the set of paths that belong in this commit. Apply judgment: if there are multiple unrelated changes, prefer to commit only one logical group and leave the rest unstaged for a follow-up commit.
2. Compose the message: `type(scope): lowercase imperative summary`. Recognized types: `feat|fix|refactor|docs|chore|test|style|perf|build|ci`. Add a body if it adds context the diff doesn't make obvious. Scan for TIL opportunities (rules below) and append `TIL:` lines.
3. **Run** `${CLAUDE_PLUGIN_ROOT}/scripts/commit.sh <path>...` with the commit message piped on stdin via a single-quoted heredoc (`<<'COMMIT_MSG'`). The script filters never-stage matches, stages survivors, and commits. Do not ask for confirmation — the user invoked `/commit` to commit.

If `$ARGUMENTS` is non-empty, use it as scope/context input for the message.

### What the script handles for you

`scripts/commit.sh` is the deterministic guard. You don't need to second-guess its filter list — pass any path that you'd plausibly want to commit, and it will skip files matching the never-stage rules and report what it skipped on stderr. The filter rules are documented at the top of the script.

### Why a single-quoted stdin heredoc

A `<<'COMMIT_MSG'` heredoc lets you write the commit message body without escaping anything — apostrophes (`it's`, `provider's`), backticks (`` `inline code` ``), and `$` (`$HOME`, `$(date)`) all pass through literally. The single quotes around the terminator (`'COMMIT_MSG'`) disable shell expansion inside the body.

This replaces two earlier designs: `-m "..."` arg lists (LLM owns shell escaping; brittle on apostrophe-heavy messages) and a Write-to-scratch-file handoff (fragile permission matching, two tool calls). One tool call, zero escaping in the message body, no scratch state.

The heredoc-apostrophe bug noted in older versions of this skill was specific to `"$(cat <<'EOF' ... EOF)"` (three nested quoting layers). A bare heredoc redirected to a single command's stdin is one layer and works cleanly through the Bash tool wrapper.

### Message format

```
type(scope): summary

Optional body explaining the why.

TIL: optional learning moment
```

## TIL Format

code-diary's parser extracts TILs via `line.indexOf("TIL:")` and takes everything after `TIL:` to end-of-line, trimmed. Format is strict:

- Must be exactly `TIL:` — case-sensitive (not `til:` or `Til:`)
- One TIL per line, in the commit body
- Multiple TILs per commit are fine

**Most commits will NOT have a TIL.** Only add one for a genuine insight:
- First-time use of an API, language feature, or tool flag in this project
- Non-obvious bug root cause where the "why" was surprising
- Performance, config, or platform behavior that isn't widely known

## Edge Cases

- **Pre-commit hook failure**: the commit did not happen. Fix the issue, then re-run the script to create a NEW commit. Never `--amend` after a hook failure.
- **Script exits non-zero with "no paths survived the never-stage filter"**: every path you passed was filtered. Tell the user what was skipped (the script prints reasons on stderr) and stop.
- **Script exits non-zero with "commit message on stdin is empty"**: the heredoc body was empty or whitespace-only. Re-invoke with the message body filled in.
- **Path you believe should be committed got skipped**: if the never-stage filter is wrong for this case, tell the user — the fix belongs in the plugin's `scripts/commit.sh` (in the agent-tools marketplace repo), not in a one-off workaround.

## Example

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/commit.sh src/timezone.ts test/timezone.test.ts <<'COMMIT_MSG'
fix(internal-tools): handle timezone offsets with half-hour increments

India Standard Time (+0530) and similar half-hour offsets were being
truncated to whole hours during day segment calculation.

TIL: not all UTC offsets are whole hours — IST is +05:30, Nepal is +05:45
COMMIT_MSG
```
