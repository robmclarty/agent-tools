# commit-with-til

A `/commit` skill for Claude Code that creates conventional commits and extracts
**TIL** ("today I learned") entries for [code-diary](https://github.com/robmclarty/code-diary).
The model composes the message; a deterministic script owns staging and enforces
a never-stage filter, so secrets and junk can't slip into a commit.

## Install

```shell
/plugin marketplace add robmclarty/agent-tools
/plugin install commit-with-til@robmclarty
```

> If you previously used this as a user-level skill at
> `~/.claude/skills/commit-with-til`, delete that directory after installing so
> `/commit` resolves to the plugin alone.

## Usage

```shell
/commit
/commit some scope or context
```

The skill preloads the repo state (status + staged/unstaged diffs + recent
commits for style reference), decides which paths belong in the commit, composes
a `type(scope): summary` message, and hands staging + committing to the script in
a single tool call. It commits without asking — invoking `/commit` is the
confirmation.

## How it works

Two pieces:

- **`skills/commit/SKILL.md`** — the model's side: read the diff, group changes,
  write a conventional-commit message, scan for a genuine TIL, and call the
  script.
- **`scripts/commit.sh`** — the deterministic guard. Reads the message from a
  single-quoted stdin heredoc (so apostrophes, backticks, and `$` need no
  escaping), applies the never-stage filter, stages the survivors, and commits.

The message is piped in, never passed as a shell argument — one quoting layer,
no escaping of the body.

### Never-stage filter

The script skips (and reports on stderr) paths matching:

- **secrets** — `.env` / `.env.*` (except `.env.example`, `.env.sample`),
  `*.pem`, `*.key`, `*.secret`, `*.token`, `token(s).json`, `*credentials*`
- **logs** — `*.log`
- **gitignored** — untracked paths that `.gitignore` excludes (a tracked file
  under an ignored directory is not ignored, and still stages)
- **oversize** — files larger than 1 MB
- **binary** — only with `--block-binary` (off by default, since the heuristic
  mis-flags legitimate committed binaries like snapshots and fixtures)
- **empty directory** — a directory arg that expands to nothing stageable

Directory arguments are expanded to their tracked + untracked-not-ignored files,
so passing a directory behaves like passing every file under it.

## TIL format

code-diary's parser extracts a TIL from any commit-body line containing `TIL:`
(case-sensitive), taking everything after it to end of line. Most commits have
no TIL — add one only for a genuine insight (first use of an API/flag in the
project, a surprising bug root cause, non-obvious platform behavior).

```
fix(internal-tools): handle timezone offsets with half-hour increments

India Standard Time (+0530) and similar half-hour offsets were being
truncated to whole hours during day segment calculation.

TIL: not all UTC offsets are whole hours — IST is +05:30, Nepal is +05:45
```

## License

MIT
