#!/usr/bin/env bash
#
# Validate .claude-plugin/marketplace.json.
#
# Catches the failures a generic JSON linter misses: malformed JSON *and*
# semantic problems (missing required keys, unknown source types, source
# objects missing their companion field). With --check-sources it also
# verifies each plugin's source is reachable *and actually a plugin* — the
# referenced repo/package/dir must carry a .claude-plugin/plugin.json.
# (Reachability alone is not enough: a package can exist on npm yet be a
# plain CLI with no plugin manifest, which would fail to install.)
#
# Dependencies: jq (required). curl and tar (only for --check-sources).
#
# Usage:
#   scripts/validate-marketplace.sh                 # offline structural checks
#   scripts/validate-marketplace.sh --check-sources # also probe each source
#
# Honors GH_TOKEN / GITHUB_TOKEN for authenticated GitHub API calls.

set -euo pipefail

MANIFEST="${MANIFEST:-.claude-plugin/marketplace.json}"
CHECK_SOURCES=0
[ "${1:-}" = "--check-sources" ] && CHECK_SOURCES=1

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }

command -v jq >/dev/null 2>&1 || fail "jq is required but not installed"
[ -f "$MANIFEST" ] || fail "manifest not found: $MANIFEST"

# 1. Syntax — must parse as JSON at all.
jq empty "$MANIFEST" 2>/dev/null || fail "$MANIFEST is not valid JSON"

# 2. Structure — collect every semantic problem into a flat array of strings.
errors="$(jq -r '
  . as $root
  | (["name","owner","metadata","plugins"]
     | map(. as $k | select($root | has($k) | not) | "top-level missing key: \($k)"))
  + (if ($root.plugins | type) != "array" then ["plugins is not an array"]
     elif ($root.plugins | length) == 0 then ["plugins array is empty"]
     else [] end)
  + ([ $root.plugins[]? ]
     | map(
         . as $p
         | (($p.name // "<unnamed>") as $n
            | (["name","source","description"]
               | map(. as $k | select($p | has($k) | not) | "plugin \($n): missing key \($k)"))
            + (if ($p.source | type) == "string" then
                 (if ($p.source | startswith("./")) then []
                  else ["plugin \($n): string source must be a relative path starting with ./"] end)
               elif ($p.source | type) != "object" then ["plugin \($n): source is not an object or relative path string"]
               elif ($p.source | has("source") | not) then ["plugin \($n): source.source missing"]
               elif (["github","npm","git","local"] | index($p.source.source)) == null
                 then ["plugin \($n): invalid source type \($p.source.source) (expected github|npm|git|local)"]
               elif ($p.source.source == "github" and ($p.source | has("repo") | not))
                 then ["plugin \($n): github source missing repo field"]
               elif ($p.source.source == "npm" and ($p.source | has("package") | not))
                 then ["plugin \($n): npm source missing package field"]
               else [] end)))
     | add // [])
  | .[]
' "$MANIFEST")"

if [ -n "$errors" ]; then
  printf 'FAIL: %s\n' "$errors" >&2
  exit 1
fi

echo "OK: $MANIFEST is valid JSON and structurally sound ($(jq '.plugins | length' "$MANIFEST") plugins)"

# 2.5. Local plugins — a relative-path source must exist in this repo and carry
# a valid plugin manifest. This is offline (the plugin ships with the repo).
while IFS=$'\t' read -r name path; do
  [ -n "$name" ] || continue
  manifest="$path/.claude-plugin/plugin.json"
  [ -f "$manifest" ] || fail "plugin $name: $manifest not found"
  jq empty "$manifest" 2>/dev/null || fail "plugin $name: $manifest is not valid JSON"
  [ -d "$path/skills" ] || fail "plugin $name: $path/skills/ not found"
  echo "  ok  $name -> $path (local plugin manifest + skills present)"
done < <(jq -r '.plugins[] | select(.source | type == "string") | [.name, .source] | @tsv' "$MANIFEST")

# 3. Reachability + plugin validity (opt-in) — confirm each remote source
#    resolves AND carries a .claude-plugin/plugin.json. A reachable package
#    that isn't a plugin (e.g. a plain CLI on npm) is a FAIL, not an ok:
#    `/plugin install` would find no manifest.
if [ "$CHECK_SOURCES" -eq 1 ]; then
  command -v curl >/dev/null 2>&1 || fail "--check-sources needs curl"
  command -v tar >/dev/null 2>&1 || fail "--check-sources needs tar (npm plugin validity)"
  token="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
  rc=0

  while IFS=$'\t' read -r name kind ref; do
    case "$kind" in
      github)
        hdr=(-H "Accept: application/vnd.github+json")
        [ -n "$token" ] && hdr+=(-H "Authorization: Bearer $token")
        if ! curl -sf "${hdr[@]}" "https://api.github.com/repos/$ref" >/dev/null; then
          echo "  ERR $name -> github:$ref unreachable" >&2; rc=1
        elif curl -sf "${hdr[@]}" "https://api.github.com/repos/$ref/contents/.claude-plugin/plugin.json" >/dev/null; then
          echo "  ok  $name -> github:$ref (plugin manifest present)"
        else
          echo "  ERR $name -> github:$ref is reachable but has no .claude-plugin/plugin.json (not a plugin)" >&2; rc=1
        fi
        ;;
      npm)
        meta="$(curl -sf "https://registry.npmjs.org/$ref" || true)"
        if [ -z "$meta" ]; then
          echo "  ERR $name -> npm:$ref not found on registry" >&2; rc=1
        else
          tarball="$(printf '%s' "$meta" | jq -r '.versions[.["dist-tags"].latest].dist.tarball // empty')"
          # npm tarballs prefix every path with `package/`.
          listing="$([ -n "$tarball" ] && curl -sfL "$tarball" | tar -tzf - 2>/dev/null || true)"
          if printf '%s\n' "$listing" | grep -q '^package/\.claude-plugin/plugin\.json$'; then
            echo "  ok  $name -> npm:$ref (plugin manifest present)"
          else
            echo "  ERR $name -> npm:$ref is on the registry but ships no .claude-plugin/plugin.json (not a plugin)" >&2; rc=1
          fi
        fi
        ;;
      *)
        echo "  skip $name -> $kind:$ref (no reachability probe for this source type)"
        ;;
    esac
  done < <(jq -r '.plugins[] | [.name] + (.source | if type == "string" then ["path", .] else [.source, (.repo // .package // .url // "")] end) | @tsv' "$MANIFEST")

  [ "$rc" -eq 0 ] || fail "one or more plugin sources were unreachable or are not valid plugins"
  echo "OK: all plugin sources reachable and carry a plugin manifest"
fi
