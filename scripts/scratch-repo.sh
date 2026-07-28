#!/usr/bin/env bash
#
# Build a throwaway TypeScript repo to exercise the `ast-grep-rules` plugin against
# a real ast-grep — the harness every later step of this build checks itself in.
#
# Nothing in this repo may reach for a sibling project to prove itself (C6/C7): a
# test that reads ~/Projects/whatever passes on this machine and nowhere else, and
# CI has no siblings at all. So the plugin's checkable surface is a repo we build
# from nothing, on demand, and throw away. It is also the truest test available,
# because a from-scratch repo is exactly what a new user has.
#
# What it builds, and why each piece is here:
#
#   git init + one commit   later steps read their own diff — `/rule` writing a rule
#                           should show up as a diff, not as untracked noise
#   @ast-grep/cli           pinned, installed as a devDependency, because that is how
#                           every repo in the field has it — never on PATH (D9/C4)
#   sgconfig.yml            the minimal real shape: one rule dir, one test config
#   .claude/ast-grep.json   the plugin's own config, written out in full rather than
#                           left to defaults, so the harness reads as documentation
#   src/*.ts                two files carrying the shapes the starter tiers flag, so
#                           `/audit` and `/rule` have something real to work on
#   docs/lessons.md         the entry template and nothing else — a fresh friction log
#
# It then verifies what it built: ast-grep runs, `ast-grep test` is green against zero
# rules, the plugin's resolver reads the repo back, the scan core counts zero lesson
# candidates (the fenced template must not register as one), and git is clean.
#
# Re-running on the same path rebuilds from scratch. The tree it produces is
# byte-identical run to run, so a second run leaves no residue — that is what makes it
# safe to re-fire between steps rather than hand-repairing a scratch repo you dirtied.
#
# Dependencies: git, pnpm (which brings its own node), jq. Network on first install
# only; pnpm serves later runs from its content-addressable store.
#
# Usage:
#   bash scripts/scratch-repo.sh <dir>     # build (or rebuild) a scratch repo there
#   bash scripts/scratch-repo.sh --help

set -euo pipefail

# Pinned so two runs a month apart produce the same repo. Bump deliberately.
AST_GREP_VERSION="0.45.0"

# Written first, removed never. Its presence is this script's sole permission to
# `rm -rf` a path: no marker, no delete.
MARKER=".scratch-repo"

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }

usage() {
  cat <<'USAGE'
Usage: bash scripts/scratch-repo.sh <dir>

Builds a throwaway repo at <dir> for exercising the ast-grep-rules plugin:
git init, a pinned @ast-grep/cli, a minimal sgconfig.yml, two .ts files and a
seeded docs/lessons.md — then verifies the result.

Re-running on the same path rebuilds it from scratch. The script only deletes a
directory it previously created (one carrying a .scratch-repo marker) or an empty
one; anything else it refuses to touch.
USAGE
}

# ---------------------------------------------------------------- arguments

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  "") usage >&2; echo >&2; fail "a target directory is required" ;;
  -*) fail "unknown option: $1 (expected a target directory, or --help)" ;;
esac
[ "$#" -eq 1 ] || fail "expected exactly one argument (the target directory), got $#"

target_input="$1"
while [ "$target_input" != "/" ] && [ "${target_input%/}" != "$target_input" ]; do
  target_input="${target_input%/}"
done
[ -n "$target_input" ] || fail "the target directory cannot be empty"

# Resolve the target before changing directory, since it may be relative to the
# caller's cwd, not to the repo root. An existing path is resolved through itself so
# that `.` and symlinks land on the real directory — which is what the guards below
# have to compare against to be worth anything.
if [ -d "$target_input" ]; then
  target="$(cd "$target_input" && pwd -P)"
else
  target_parent="$(dirname "$target_input")"
  [ -d "$target_parent" ] || fail "no such directory: $target_parent (the target's parent must already exist)"
  target_parent_abs="$(cd "$target_parent" && pwd -P)"
  target="${target_parent_abs%/}/$(basename "$target_input")"
fi

root="$(cd "$(dirname "$0")/.." && pwd -P)"
plugin="$root/plugins/ast-grep-rules"

# ---------------------------------------------------------------- guards
#
# This script deletes a directory, so every way that could go wrong is refused by
# name rather than left to a careful caller.

[ "$target" = "/" ] && fail "refusing to build a scratch repo at /"
[ "$target" = "$HOME" ] && fail "refusing to build a scratch repo at your home directory"
[ "$target" = "$root" ] && fail "refusing to build a scratch repo over this repo"
case "$target" in
  "$root"/*) fail "$target is inside this repo — put the scratch repo somewhere disposable (\$TMPDIR), so it can never be committed here" ;;
esac
case "$root"/ in
  "$target"/*) fail "$target contains this repo — refusing to delete it" ;;
esac

if [ -e "$target" ]; then
  [ -d "$target" ] || fail "$target exists and is not a directory"
  if [ -e "$target/$MARKER" ]; then
    rm -rf "$target"
  elif [ -n "$(ls -A "$target")" ]; then
    fail "$target is not empty and carries no $MARKER marker — this script did not create it, so it will not delete it. Pick another path, or remove it yourself."
  fi
fi

command -v git >/dev/null 2>&1 || fail "git is required"
command -v pnpm >/dev/null 2>&1 || fail "pnpm is required — it is how @ast-grep/cli is installed and invoked (D9)"
command -v jq >/dev/null 2>&1 || fail "jq is required to verify the built repo"

# ---------------------------------------------------------------- build

echo "== building =="
echo "  $target"

mkdir -p "$target"
cd "$target"

cat > "$MARKER" <<MARKERFILE
Throwaway repo built by scripts/scratch-repo.sh in:
  $root

Nothing here is precious. Delete it with \`rm -rf\`, or re-run that script on this
path to rebuild it from scratch. This file is what tells the script the directory
is its own to overwrite.
MARKERFILE

mkdir -p .claude docs rules src tests

cat > .gitignore <<'GITIGNORE'
node_modules/
GITIGNORE

# `allowBuilds` (pnpm 11) and `onlyBuiltDependencies` (pnpm 10) are the same consent,
# spelled differently across the two majors. Both are written so this works on either;
# without one of them pnpm skips the postinstall and leaves a shim that errors on use.
cat > pnpm-workspace.yaml <<'WORKSPACE'
allowBuilds:
  '@ast-grep/cli': true
onlyBuiltDependencies:
  - '@ast-grep/cli'
WORKSPACE

cat > package.json <<PACKAGE
{
  "name": "ast-grep-rules-scratch",
  "version": "0.0.0",
  "private": true,
  "description": "Throwaway repo for exercising the ast-grep-rules plugin.",
  "devDependencies": {
    "@ast-grep/cli": "$AST_GREP_VERSION"
  }
}
PACKAGE

# The minimal real shape. Paths here resolve relative to this file, which is what the
# plugin's resolver reproduces — and the only place rule/test paths are ever stated.
cat > sgconfig.yml <<'SGCONFIG'
ruleDirs:
  - rules

testConfigs:
  - testDir: tests
    snapshotDir: __snapshots__
SGCONFIG

touch rules/.gitkeep tests/.gitkeep

# Every key at its default, written out rather than omitted: an empty `{}` resolves
# identically, but this file is the first thing someone reads to learn the contract.
cat > .claude/ast-grep.json <<'ASTGREPJSON'
{
  "sgconfig": "sgconfig.yml",
  "lessons_path": "docs/lessons.md",
  "conventions_path": "docs/conventions.md",
  "convention_docs": ["CLAUDE.md"],
  "ast_grep_command": "pnpm exec ast-grep",
  "scaffold_command": null
}
ASTGREPJSON

# A fresh friction log: the template, and no entries. The template lives inside a fence
# because the scan core must not count it as a twelfth candidate — seeding it here means
# the harness proves that on every build, not just in the fixtures.
cat > docs/lessons.md <<'LESSONS'
# Lessons

Append-only friction log for this scratch repo. `/ast-grep-rules:lesson` appends
entries here; `/ast-grep-rules:mine` reads them back and sorts each `rule:` checkbox
into a bucket.

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
LESSONS

# Two sources carrying, between them, six of the seven shapes the starter tiers flag —
# untyped JSON.parse, console in a package, default export, class, extends, and `this`.
# (`no-cross-package-relative-import` needs a monorepo and has no shape here.) They are
# ordinary enough to read as real code, which is what makes `/audit` a fair test.
cat > src/parse-config.ts <<'PARSECONFIG'
import { readFileSync } from 'node:fs';

export interface AppConfig {
  name: string;
  retries: number;
}

export function loadConfig(path: string): AppConfig {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);

  console.log('loaded config from', path);

  return parsed;
}

export default loadConfig;
PARSECONFIG

cat > src/store.ts <<'STORE'
import type { AppConfig } from './parse-config';

class BaseStore {
  protected items: string[] = [];
}

export class ConfigStore extends BaseStore {
  constructor(private readonly config: AppConfig) {
    super();
  }

  add(item: string): void {
    this.items.push(item);
  }

  get name(): string {
    return this.config.name;
  }
}
STORE

echo
echo "== installing @ast-grep/cli $AST_GREP_VERSION =="
pnpm install --silent

echo
echo "== git =="
git -c init.defaultBranch=main init -q
# Local identity, so the repo commits without depending on a global git config.
git config user.name "scratch-repo"
git config user.email "scratch@example.invalid"
git add -A
git -c commit.gpgsign=false commit -q -m "chore: scratch repo for ast-grep-rules"
echo "  initialized on main, one commit"

# ---------------------------------------------------------------- verify
#
# The build is only useful if it is actually the shape later steps assume, so the
# script asserts that itself rather than leaving it to whoever runs it next.

echo
echo "== verifying =="

version="$(pnpm exec ast-grep --version)" \
  || fail "ast-grep did not run — pnpm skipped the postinstall, so the installed binary is still a shim"
case "$version" in
  *"$AST_GREP_VERSION"*) ;;
  *) fail "expected ast-grep $AST_GREP_VERSION, got: $version" ;;
esac
echo "  ok  $version"

pnpm exec ast-grep test >/dev/null \
  || fail "\`ast-grep test\` is red on a repo with zero rules"
echo "  ok  ast-grep test — green against zero rules"

config="$(node "$plugin/scripts/config.mjs" --root "$target")"
echo "$config" | jq -e '
  .mode == "config"
  and .paths.rules_dir == "rules"
  and .paths.tests_dir == "tests"
  and .paths.snapshot_dir == "tests/__snapshots__"
  and .exists.lessons_path
  and (.warnings | length) == 0
' >/dev/null || fail "the plugin did not resolve this repo:
$config"
echo "  ok  config.mjs — resolved rules/, tests/ and docs/lessons.md, no warnings"

lessons="$(node "$plugin/scripts/scan.mjs" --lessons --root "$target")"
echo "$lessons" | jq -e '.mode == "lessons" and (.items | length) == 0' >/dev/null \
  || fail "expected zero lesson candidates in a fresh log — the fenced template was counted:
$lessons"
echo "  ok  scan.mjs --lessons — 0 candidates, template not counted"

[ -z "$(git status --porcelain)" ] || fail "the built repo has uncommitted changes:
$(git status --porcelain)"
echo "  ok  git — clean tree"

if command -v claude >/dev/null 2>&1; then
  claude plugin validate "$plugin" >/dev/null 2>&1 \
    || fail "\`claude plugin validate\` rejected $plugin"
  echo "  ok  claude plugin validate — the plugin manifest loads from this working tree"
else
  echo "  --  claude not on PATH; skipped \`claude plugin validate\`"
fi

# ---------------------------------------------------------------- report

cat <<REPORT

OK: scratch repo ready — $target

  ast-grep    $AST_GREP_VERSION, as \`pnpm exec ast-grep\`
  rules       rules/ (empty), tests/ (empty)
  lessons     docs/lessons.md — template only, no entries
  sources     src/parse-config.ts, src/store.ts

Open it with the plugin loaded from this working tree:

  cd $target && claude --plugin-dir $plugin

Re-run this script on the same path to rebuild it; \`rm -rf\` it when you are done.
REPORT
