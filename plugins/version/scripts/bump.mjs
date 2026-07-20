#!/usr/bin/env node
/**
 * Config-driven version bumper — deterministic backend for the `/version` skill.
 *
 * Generalizes the gen-3 bump scripts (ridgeline, fascicle, weft) into one engine
 * driven by a per-repo `.claude/version.json`. Accepts raw arguments matching the
 * skill's `$ARGUMENTS`:
 *
 *   patch | minor | major     → standard bump
 *   --repair-skew             → force-align every target to the authoritative
 *                               version without bumping (bump type, if also
 *                               given, is ignored); changes stay uncommitted
 *   init                      → no writes; sniff the repo and emit a detection
 *                               report the skill uses to draft the config
 *
 * Pre-flight (bump mode only): the working tree must be clean — a release
 * commit must contain only the bump + CHANGELOG; mixing in WIP is the bug
 * we're refusing to ship.
 *
 * Always emits exactly one JSON object to stdout — the skill consumes this
 * directly. The `mode` field tells the caller what happened:
 *
 *   { mode: 'bump',        old, new, since, files: [...], changed_count, skew_healed, settings }
 *   { mode: 'repair-skew', old, new,        files: [...], changed_count, settings }
 *   { mode: 'init',        root, existing, candidates, markers }
 *   { mode: 'error',       error_type, message }
 *
 * `since` on a successful bump is the SHA of the previous release — found via
 * the configured release-marker convention (tag-first when marker.tagAuthoritative,
 * else the commit-message patterns built from marker.commit + marker.legacy).
 * The skill uses it as the left boundary for the CHANGELOG commit range; null
 * means no prior release (initial release).
 *
 * Version targets come from config:
 *   targets[]  — static; the FIRST entry is authoritative (read from), the rest
 *                are force-written (self-healing skew, reported per-file)
 *   discover[] — glob rules; matching files join the lockstep set (a file that
 *                exists but doesn't match its declared pattern fails loudly —
 *                existing declares intent to participate)
 *   driver     — escape hatch: a repo-local script that receives the new version
 *                as argv[1], performs all writes, prints changed paths (one per
 *                line), exits non-zero on failure. targets[0] is still required
 *                as the read-only authoritative source.
 *
 * Exit codes:
 *   0  script ran to completion — including expected failures (dirty_tree,
 *      usage, config). The JSON's `mode` signals success vs. failure. Non-zero
 *      would make the slash-command preflight swallow stdout and never hand
 *      control to the skill body, hiding the error from the user.
 *   2  unexpected runtime crash — JSON still on stdout if possible
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const SEMVER_CAPTURE = '(\\d+\\.\\d+\\.\\d+)';
const CONFIG_REL = '.claude/version.json';
const NOTES_REL = '.claude/version.md';

function emit(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function emit_error(error_type, message) {
  emit({ mode: 'error', error_type, message });
  process.exit(0);
}

// ---------------------------------------------------------------- args

function parse_args(argv) {
  const args = argv.slice(2);
  if (args.length === 0) {
    return { error: 'no arguments — pass `patch`, `minor`, `major`, `--repair-skew`, or `init`.' };
  }
  let bump_type = null;
  let repair_skew = false;
  let init = false;
  for (const a of args) {
    if (a === '--repair-skew') repair_skew = true;
    else if (a === 'init') init = true;
    else if (['patch', 'minor', 'major'].includes(a)) bump_type = a;
    else return { error: `unknown argument: ${a} (expected patch|minor|major, --repair-skew, or init)` };
  }
  if (init && (bump_type || repair_skew)) {
    return { error: '`init` takes no other arguments.' };
  }
  if (!init && !repair_skew && !bump_type) {
    return { error: 'pass `patch`, `minor`, or `major` to bump.' };
  }
  return { bump_type, repair_skew, init };
}

// ---------------------------------------------------------------- git

function git(root, args, opts = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', opts.quiet ? 'ignore' : 'pipe'],
  });
}

function find_repo_root() {
  try {
    return git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  } catch {
    return null;
  }
}

function check_clean_tree(root) {
  let out;
  try {
    out = git(root, ['status', '--porcelain']);
  } catch (err) {
    return { ok: false, runtime_error: `git status failed: ${err.message}` };
  }
  const trimmed = out.trim();
  if (trimmed === '') return { ok: true };
  return { ok: false, dirty_files: trimmed.split('\n') };
}

// Find the SHA of the previous release per the marker convention. Tag-first
// when the tag is authoritative (fascicle: correct even when the tag sits on a
// merge/checkpoint commit), then the commit-message patterns built from
// marker.commit and marker.legacy (dual-convention support keeps the changelog
// range working across a convention migration). Returns null if no prior release.
function find_previous_release_sha(root, marker) {
  if (marker.tag && marker.tagAuthoritative) {
    try {
      const tag = git(root, ['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*.[0-9]*.[0-9]*', 'HEAD'], { quiet: true }).trim();
      if (tag !== '') {
        const sha = git(root, ['rev-list', '-n', '1', tag]).trim();
        if (sha !== '') return sha;
      }
    } catch {
      // no reachable release tag — fall through to commit-message detection
    }
  }
  const templates = [marker.commit, ...marker.legacy];
  const alternatives = templates.map((t) =>
    escape_regex(t).replace(/\\\{version\\\}/g, '[0-9]+\\.[0-9]+\\.[0-9]+'),
  );
  const pattern = `^(${alternatives.join('|')})$`;
  try {
    const out = git(root, ['log', '-E', `--grep=${pattern}`, '-1', '--pretty=%H']);
    const sha = out.trim();
    return sha === '' ? null : sha;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- config

const DEFAULTS = {
  marker: { commit: 'v{version}', tag: false, tagAuthoritative: false, legacy: [] },
  changelog: { path: 'CHANGELOG.md', style: 'sections', linkRef: null },
  verify: null,
  publish: { pushTag: false, pushBranch: false, confirm: false },
};

function load_config(root) {
  const path = join(root, CONFIG_REL);
  if (!existsSync(path)) {
    emit_error('config', `no ${CONFIG_REL} found — run \`/version init\` to generate one.`);
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    emit_error('config', `${CONFIG_REL} is not valid JSON: ${err.message}`);
  }
  const config = {
    targets: raw.targets ?? [],
    discover: raw.discover ?? [],
    driver: raw.driver ?? null,
    marker: { ...DEFAULTS.marker, ...(raw.marker ?? {}) },
    changelog: { ...DEFAULTS.changelog, ...(raw.changelog ?? {}) },
    verify: raw.verify ?? DEFAULTS.verify,
    publish: { ...DEFAULTS.publish, ...(raw.publish ?? {}) },
  };
  if (!Array.isArray(config.targets) || config.targets.length === 0) {
    emit_error('config', `${CONFIG_REL} must declare a non-empty \`targets\` array — the first entry is the authoritative version source (required even with a \`driver\`).`);
  }
  for (const t of config.targets) validate_target(t, 'targets');
  for (const d of config.discover) {
    if (typeof d.glob !== 'string') emit_error('config', 'every `discover` rule needs a `glob` string.');
    validate_target(d, 'discover');
  }
  if (typeof config.marker.commit !== 'string' || !config.marker.commit.includes('{version}')) {
    emit_error('config', '`marker.commit` must be a string containing `{version}`.');
  }
  if (!['sections', 'keep-a-changelog', 'flat'].includes(config.changelog.style)) {
    emit_error('config', `unknown changelog style: ${config.changelog.style} (expected sections|keep-a-changelog|flat)`);
  }
  return config;
}

function validate_target(t, where) {
  if (t.type === 'json') {
    if (typeof t.key !== 'string' || t.key === '') {
      emit_error('config', `every json entry in \`${where}\` needs a dot-path \`key\`.`);
    }
  } else if (t.type === 'regex') {
    if (typeof t.match !== 'string' || t.match.split('{semver}').length !== 2) {
      emit_error('config', `every regex entry in \`${where}\` needs a \`match\` literal containing exactly one \`{semver}\` placeholder.`);
    }
  } else {
    emit_error('config', `unknown target type in \`${where}\`: ${t.type} (expected json|regex)`);
  }
  if (where === 'targets' && typeof t.path !== 'string') {
    emit_error('config', 'every entry in `targets` needs a `path`.');
  }
}

// ---------------------------------------------------------------- targets

function escape_regex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function match_regex_for(template) {
  const [before, after] = template.split('{semver}');
  return new RegExp(escape_regex(before) + SEMVER_CAPTURE + escape_regex(after));
}

// Minimal glob: `*` matches within a path segment; no `**`. Enough for
// patterns like `packages/*/package.json` and `packages/*/src/version.ts`.
function expand_glob(root, pattern) {
  let candidates = [root];
  for (const segment of pattern.split('/')) {
    const next = [];
    if (segment.includes('*')) {
      const seg_re = new RegExp(`^${escape_regex(segment).replace(/\\\*/g, '[^/]*')}$`);
      for (const dir of candidates) {
        let entries;
        try {
          entries = readdirSync(dir);
        } catch {
          continue;
        }
        for (const name of entries.sort()) {
          if (seg_re.test(name)) next.push(join(dir, name));
        }
      }
    } else {
      for (const dir of candidates) {
        const p = join(dir, segment);
        if (existsSync(p)) next.push(p);
      }
    }
    candidates = next;
  }
  return candidates.filter((p) => {
    try {
      return statSync(p).isFile();
    } catch {
      return false;
    }
  });
}

function resolve_targets(root, config) {
  const resolved = [];
  const seen = new Set();
  config.targets.forEach((t, i) => {
    const abs = resolve(root, t.path);
    if (!existsSync(abs)) {
      emit_error('config', `target file not found: ${t.path} — fix \`targets\` in ${CONFIG_REL} or create the file.`);
    }
    resolved.push({ ...t, abs, rel: t.path, authoritative: i === 0 });
    seen.add(abs);
  });
  for (const rule of config.discover) {
    for (const abs of expand_glob(root, rule.glob)) {
      if (seen.has(abs)) continue;
      seen.add(abs);
      const rel = abs.slice(root.length + 1);
      resolved.push({ type: rule.type, key: rule.key, match: rule.match, abs, rel, authoritative: false });
    }
  }
  return resolved;
}

function get_dot_path(obj, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function set_dot_path(obj, key, value) {
  const parts = key.split('.');
  const last = parts.pop();
  const parent = parts.reduce((o, k) => (o == null ? undefined : o[k]), obj);
  if (parent == null || typeof parent !== 'object') {
    throw new Error(`dot-path \`${key}\` does not resolve to an object`);
  }
  parent[last] = value;
}

function detect_indent(text) {
  const m = text.match(/^([ \t]+)"/m);
  return m ? m[1] : 2;
}

function read_target_version(target) {
  const text = readFileSync(target.abs, 'utf8');
  if (target.type === 'json') {
    const version = get_dot_path(JSON.parse(text), target.key);
    if (typeof version !== 'string' || version.length === 0) {
      throw new Error(`${target.rel} has no version string at \`${target.key}\``);
    }
    return version;
  }
  const m = text.match(match_regex_for(target.match));
  if (!m) {
    throw new Error(`${target.rel} does not contain a line matching \`${target.match}\` — the file declares intent to participate, so silently skipping it would hide skew.`);
  }
  return m[1];
}

// Idempotent rewrite; returns whether the file changed.
function write_target_version(target, new_version) {
  const text = readFileSync(target.abs, 'utf8');
  if (target.type === 'json') {
    const obj = JSON.parse(text);
    if (get_dot_path(obj, target.key) === new_version) return false;
    set_dot_path(obj, target.key, new_version);
    const trailing = text.endsWith('\n') ? '\n' : '';
    writeFileSync(target.abs, `${JSON.stringify(obj, null, detect_indent(text))}${trailing}`);
    return true;
  }
  const re = match_regex_for(target.match);
  const m = text.match(re);
  if (!m) {
    throw new Error(`${target.rel} does not contain a line matching \`${target.match}\``);
  }
  if (m[1] === new_version) return false;
  const updated = text.replace(re, (whole, current) => whole.replace(current, new_version));
  writeFileSync(target.abs, updated);
  return true;
}

function bump_semver(current, type) {
  const m = SEMVER_RE.exec(current);
  if (!m) throw new Error(`unparseable semver: ${current}`);
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  if (type === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`unknown bump type: ${type}`);
}

// Echoed to the skill so it never re-parses the config and always sees defaults applied.
function settings_for(root, config) {
  return {
    marker: config.marker,
    changelog: config.changelog,
    verify: config.verify,
    publish: config.publish,
    notes: existsSync(join(root, NOTES_REL)) ? NOTES_REL : null,
  };
}

// ---------------------------------------------------------------- bump / repair

function run_driver(root, driver, new_version) {
  const abs = resolve(root, driver);
  if (!existsSync(abs)) {
    emit_error('config', `driver script not found: ${driver}`);
  }
  let out;
  try {
    out = execFileSync(abs, [new_version], { cwd: root, encoding: 'utf8' });
  } catch (err) {
    emit_error('runtime', `driver ${driver} failed (exit ${err.status ?? '?'}):\n${err.stderr ?? err.message}`);
  }
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .map((rel) => ({ rel, kind: 'driver', changed: true, skewed: false }));
}

function mode_bump(root, bump_type) {
  const tree = check_clean_tree(root);
  if (!tree.ok) {
    if (tree.runtime_error) emit_error('runtime', tree.runtime_error);
    const lines = tree.dirty_files.map((l) => `  ${l}`).join('\n');
    emit_error(
      'dirty_tree',
      `working tree is not clean — refusing to bump.\n` +
        `  a release commit must contain only the version bump + CHANGELOG.\n` +
        `  uncommitted changes:\n${lines}`,
    );
  }

  const config = load_config(root);
  const targets = resolve_targets(root, config);
  // Read every target before writing any: a target that fails to parse or
  // match must abort the bump with the tree untouched, not half-rewritten.
  const olds = targets.map((t) => read_target_version(t));
  const current = olds[0];
  const next = bump_semver(current, bump_type);
  const since = find_previous_release_sha(root, config.marker);

  let files;
  if (config.driver) {
    files = [
      { rel: targets[0].rel, kind: targets[0].type, old: current, changed: write_target_version(targets[0], next), skewed: false },
      ...run_driver(root, config.driver, next),
    ];
  } else {
    files = targets.map((t, i) => ({
      rel: t.rel,
      kind: t.type,
      old: olds[i],
      changed: write_target_version(t, next),
      // Non-authoritative files are force-written to `next` regardless
      // (plumbbob-style self-healing); skew is reported, not fatal, so the
      // skill can surface it in its final report.
      skewed: !t.authoritative && olds[i] !== current,
    }));
  }

  emit({
    mode: 'bump',
    old: current,
    new: next,
    since,
    files,
    changed_count: files.filter((f) => f.changed).length,
    skew_healed: files.filter((f) => f.skewed).map((f) => f.rel),
    settings: settings_for(root, config),
  });
}

function mode_repair_skew(root) {
  // No clean-tree requirement: repair is a recovery action and leaves its
  // changes uncommitted for review.
  const config = load_config(root);
  const targets = resolve_targets(root, config);
  const olds = targets.map((t) => read_target_version(t));
  const current = olds[0];

  let files;
  if (config.driver) {
    files = [
      { rel: targets[0].rel, kind: targets[0].type, old: current, changed: false, skewed: false },
      ...run_driver(root, config.driver, current),
    ];
  } else {
    files = targets.map((t, i) => ({
      rel: t.rel,
      kind: t.type,
      old: olds[i],
      changed: write_target_version(t, current),
      skewed: !t.authoritative && olds[i] !== current,
    }));
  }

  emit({
    mode: 'repair-skew',
    old: current,
    new: current,
    files,
    changed_count: files.filter((f) => f.changed).length,
    settings: settings_for(root, config),
  });
}

// ---------------------------------------------------------------- init

function read_json_quiet(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function last_commit_matching(root, pattern) {
  try {
    const out = git(root, ['log', '-E', `--grep=${pattern}`, '-1', '--pretty=%H %s']).trim();
    return out === '' ? null : out;
  } catch {
    return null;
  }
}

function mode_init(root) {
  const existing = {
    config: existsSync(join(root, CONFIG_REL))
      ? (read_json_quiet(join(root, CONFIG_REL)) ? 'valid' : 'invalid')
      : null,
    notes: existsSync(join(root, NOTES_REL)) ? NOTES_REL : null,
    bespoke_skill: existsSync(join(root, '.claude/skills/version/SKILL.md'))
      ? '.claude/skills/version/SKILL.md'
      : null,
    changelog: null,
  };
  if (existsSync(join(root, 'CHANGELOG.md'))) {
    const text = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    const heading = text.split('\n').find((l) => l.startsWith('## '));
    existing.changelog = { path: 'CHANGELOG.md', first_heading: heading ?? null };
  }

  const pkg = read_json_quiet(join(root, 'package.json'));
  const plugin = read_json_quiet(join(root, '.claude-plugin/plugin.json'));
  const marketplace = read_json_quiet(join(root, '.claude-plugin/marketplace.json'));
  const candidates = {
    package_json: pkg ? { version: pkg.version ?? null, workspaces: pkg.workspaces ?? null } : null,
    plugin_json: plugin ? { version: plugin.version ?? null } : null,
    marketplace_json: marketplace ? { metadata_version: marketplace.metadata?.version ?? null } : null,
    package_manifests: expand_glob(root, 'packages/*/package.json').map((abs) => ({
      rel: abs.slice(root.length + 1),
      version: read_json_quiet(abs)?.version ?? null,
    })),
    version_ts: expand_glob(root, 'packages/*/src/version.ts')
      .map((abs) => abs.slice(root.length + 1)),
    version_constants: [],
  };
  // Version constants in source files (e.g. Odin `VERSION :: "1.2.3"`,
  // Python `__version__ = "1.2.3"`). Shallow scan: repo root and src/ only.
  const constant_res = [
    /^\s*\w*VERSION\w*\s*::\s*"(\d+\.\d+\.\d+)"/,
    /^__version__\s*=\s*["'](\d+\.\d+\.\d+)["']/,
    /^\s*export\s+const\s+version\s*=\s*['"](\d+\.\d+\.\d+)['"]/,
  ];
  for (const dir of [root, join(root, 'src')]) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries.sort()) {
      if (!/\.(odin|py|ts|zig|c|h)$/.test(name)) continue;
      const abs = join(dir, name);
      let text;
      try {
        if (!statSync(abs).isFile()) continue;
        text = readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
      for (const line of text.split('\n')) {
        if (constant_res.some((re) => re.test(line))) {
          candidates.version_constants.push({ rel: abs.slice(root.length + 1), line: line.trim() });
          break;
        }
      }
    }
  }

  let last_tag = null;
  try {
    last_tag = git(root, ['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*'], { quiet: true }).trim() || null;
  } catch {
    // no tags
  }
  let has_remote = false;
  try {
    has_remote = git(root, ['remote']).trim() !== '';
  } catch {
    // not fatal
  }
  const markers = {
    last_v_tag: last_tag,
    last_v_commit: last_commit_matching(root, '^v[0-9]+\\.[0-9]+\\.[0-9]+$'),
    last_chore_release: last_commit_matching(root, '^chore: release [0-9]+\\.[0-9]+\\.[0-9]+$'),
    last_chore_bump: last_commit_matching(root, '^chore: bump version to [0-9]+\\.[0-9]+\\.[0-9]+$'),
    has_remote,
  };

  emit({ mode: 'init', root, existing, candidates, markers });
}

// ---------------------------------------------------------------- main

function main() {
  const parsed = parse_args(process.argv);
  if (parsed.error) emit_error('usage', parsed.error);

  const root = find_repo_root();
  if (!root) emit_error('runtime', 'not inside a git repository.');

  if (parsed.init) mode_init(root);
  else if (parsed.repair_skew) mode_repair_skew(root);
  else mode_bump(root, parsed.bump_type);
}

try {
  main();
} catch (err) {
  try {
    emit({ mode: 'error', error_type: 'runtime', message: err.stack ?? err.message });
  } catch {
    process.stderr.write(`bump.mjs: ${err.stack ?? err.message}\n`);
  }
  process.exit(2);
}
