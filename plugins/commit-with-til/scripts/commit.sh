#!/usr/bin/env bash
# commit.sh — filter, stage, and commit in one deterministic step.
#
# Usage:
#   commit.sh [--block-binary] <path>... <<'COMMIT_MSG'
#   subject
#
#   body
#
#   TIL: ...
#   COMMIT_MSG
#
# Reads the commit message from stdin. Use a single-quoted heredoc
# (`<<'COMMIT_MSG'`) so apostrophes, backticks, and `$` in the body pass
# through literally — no shell escaping needed.
#
# Each positional arg is a path to stage. Directory args are expanded to
# the set of tracked + untracked-not-ignored files under them via
# `git ls-files`, so passing a directory works the same as passing every
# file inside it. Each resulting file is checked against the never-stage
# filter below; survivors are staged and committed.
#
# Never-stage (skipped, with reason printed to stderr):
#   secrets    .env, .env.*  (except .env.example, .env.sample)
#              *.pem, *.key, *.secret
#              *.token, token.json, tokens.json
#              credentials*, *-credentials*
#   logs       *.log
#   gitignored untracked paths that .gitignore excludes. A tracked file under
#              an ignored directory is not ignored and still stages (see the
#              staging step at the bottom).
#   binary     ONLY when --block-binary is passed (default: allow). The
#              `grep -I` heuristic mis-flags Playwright snapshot PNGs,
#              ML model fixtures, fonts, and other intentional commit
#              targets — defaulting to allow lets binaries through, and
#              callers pass --block-binary on the rare commit that's
#              meant to be source-only.
#   oversize   files larger than 1 MB
#   empty dir  directory expanded to no stageable files
#
# If at least one path survives the filter and stdin is non-empty, stages the
# survivors in two passes (`git add -f -- <tracked>`, `git add -- <untracked>`;
# the staging step at the bottom says why) and runs:
#   git commit -F - (with the stdin message)
# Otherwise exits non-zero without committing.

set -euo pipefail

block_binary=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --block-binary)
      block_binary=1
      shift
      ;;
    --)
      shift
      break
      ;;
    --*)
      echo "error: unknown flag: $1" >&2
      echo "usage: $0 [--block-binary] <path>... <<'COMMIT_MSG' ... COMMIT_MSG" >&2
      exit 2
      ;;
    *)
      break
      ;;
  esac
done

if [[ $# -lt 1 ]]; then
  echo "usage: $0 [--block-binary] <path>... <<'COMMIT_MSG' ... COMMIT_MSG" >&2
  exit 2
fi

# Read the entire commit message from stdin up front. If invoked without
# a heredoc/pipe, stdin is closed/empty and `cat` returns immediately.
msg="$(cat)"

# Reject empty / whitespace-only messages. Catches "forgot the heredoc
# body" without hanging on tty input.
if [[ -z "${msg//[[:space:]]/}" ]]; then
  echo "error: commit message on stdin is empty" >&2
  echo "  pipe a message via heredoc: $0 <path>... <<'COMMIT_MSG' ... COMMIT_MSG" >&2
  exit 2
fi

declare -a to_stage=()
declare -a skipped=()

is_secret() {
  local base="$1"
  case "$base" in
    .env.example|.env.sample) return 1 ;;
    .env|.env.*) return 0 ;;
    *.pem|*.key|*.secret) return 0 ;;
    *.token|token.json|tokens.json) return 0 ;;
    credentials|credentials.*|*-credentials|*-credentials.*) return 0 ;;
  esac
  return 1
}

# Expand directory args to their tracked + untracked-not-ignored files,
# so `commit.sh some/dir` behaves like `commit.sh some/dir/a some/dir/b ...`
# and the per-file filter below sees real files (wc -c, grep -I, etc.).
declare -a expanded=()
for p in "$@"; do
  if [[ -d "$p" ]]; then
    dir_files=()
    while IFS= read -r line; do
      [[ -n "$line" ]] && dir_files+=("$line")
    done < <(git ls-files --cached --others --exclude-standard -- "$p")
    if (( ${#dir_files[@]} == 0 )); then
      skipped+=("$p (directory contains no stageable files)")
      continue
    fi
    expanded+=("${dir_files[@]}")
  else
    expanded+=("$p")
  fi
done

for p in "${expanded[@]}"; do
  base="$(basename "$p")"

  if is_secret "$base"; then
    skipped+=("$p (secret)")
    continue
  fi

  if [[ "$base" == *.log ]]; then
    skipped+=("$p (log)")
    continue
  fi

  # An untracked path that .gitignore excludes is one more never-stage rule:
  # report it and move on, rather than let `git add` exit 1 and abort the whole
  # commit. Tracked files are exempt, because git ignores only what it doesn't
  # track and `git check-ignore` agrees, so this never skips a tracked file.
  if git check-ignore -q -- "$p"; then
    skipped+=("$p (gitignored)")
    continue
  fi

  # Nonexistent path: defer to git for the error message.
  if [[ ! -e "$p" ]]; then
    to_stage+=("$p")
    continue
  fi

  size=$(wc -c < "$p" | tr -d ' ')
  if (( size > 1048576 )); then
    skipped+=("$p (>1MB: ${size} bytes)")
    continue
  fi

  # Binary check: opt-in via --block-binary. The grep -I heuristic
  # mis-flags every legitimate committed binary (Playwright snapshots,
  # ML fixtures, fonts, sample audio), so defaulting to "skip binary"
  # caused more friction than it prevented. With --block-binary the
  # check runs uniformly — no fixtures/snapshots carve-outs needed.
  if (( block_binary == 1 )) && [[ -f "$p" && $size -gt 0 ]] \
      && ! grep -Iq . "$p" 2>/dev/null; then
    skipped+=("$p (binary)")
    continue
  fi

  to_stage+=("$p")
done

if (( ${#skipped[@]} > 0 )); then
  echo "skipped:" >&2
  for s in "${skipped[@]}"; do
    echo "  - $s" >&2
  done
fi

if (( ${#to_stage[@]} == 0 )); then
  echo "error: no paths survived the never-stage filter; nothing to commit" >&2
  exit 1
fi

# Stage in two passes. git ignores only what it doesn't track, so a tracked
# file under a gitignored directory is a legitimate target; but `git add` still
# exits 1 on the ignored pathspec even as it stages the file (git 2.50), and
# `set -e` would abort before the commit. `-f` is safe for paths the index
# already holds. Untracked paths get a plain `git add`, so .gitignore keeps
# deciding for anything new (the filter above has already skipped the ignored
# ones).
declare -a tracked=()
declare -a untracked=()
for p in "${to_stage[@]}"; do
  if git ls-files --error-unmatch -- "$p" >/dev/null 2>&1; then
    tracked+=("$p")
  else
    untracked+=("$p")
  fi
done
if (( ${#tracked[@]} > 0 )); then
  git add -f -- "${tracked[@]}"
fi
if (( ${#untracked[@]} > 0 )); then
  git add -- "${untracked[@]}"
fi
printf '%s\n' "$msg" | git commit -F -
