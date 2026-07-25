#!/usr/bin/env bash
#
# The repo's one check command — everything CI gates on, in a single run.
#
# Two slots today:
#   marketplace : scripts/validate-marketplace.sh, the existing CI gate
#   tests       : `node --test` over every test file in the tree
#
# The tests slot is green when empty on purpose: plugin scripts arrive with
# their tests over the course of a build, and a tree with no test files yet is
# not a failing tree. The summary line always reports both counts, so "0 test
# files" is visible rather than silently skipped.
#
# Test files are any `*.test.mjs` anywhere, plus any `*.mjs` under a
# `__tests__/` directory.
#
# Dependencies: jq (via validate-marketplace.sh). node, only once test files exist.
#
# Usage:
#   bash scripts/check.sh                  # offline structural checks + tests
#   bash scripts/check.sh --check-sources  # also probe each plugin source (CI)

set -euo pipefail

cd "$(dirname "$0")/.."

MANIFEST="${MANIFEST:-.claude-plugin/marketplace.json}"

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }

case "${1:-}" in
  ""|--check-sources) ;;
  *) fail "unknown argument: $1 (expected --check-sources or nothing)" ;;
esac

echo "== marketplace =="
bash scripts/validate-marketplace.sh ${1:+"$1"}
plugins="$(jq '.plugins | length' "$MANIFEST")"

echo
echo "== tests =="
tests="$(find . \
  \( -name .git -o -name node_modules \) -prune -o \
  \( -name '*.test.mjs' -o \( -path '*/__tests__/*' -name '*.mjs' \) \) -print \
  | sort)"

count=0
[ -n "$tests" ] && count="$(printf '%s\n' "$tests" | wc -l | tr -d ' ')"

if [ "$count" -eq 0 ]; then
  echo "  no test files yet — nothing to run"
else
  command -v node >/dev/null 2>&1 || fail "node is required to run $count test file(s)"
  # shellcheck disable=SC2086 # deliberate word-split: paths in this repo have no spaces
  node --test $tests
fi

echo
echo "OK: check green — $plugins plugins validated, $count test files"
