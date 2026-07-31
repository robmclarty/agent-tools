#!/usr/bin/env node
/**
 * Starter-tier installer — copies a bundled tier into the repo's own ast-grep dirs.
 *
 * The bundled rules are **always explicitly opt-in** (D5). Nothing here runs unless a
 * tier is named on the command line, and naming no tier is a listing, not an install —
 * which is what makes "the user declined" cost exactly zero writes. The plugin's
 * non-goals refuse to be a rule library; two small tiers a stranger can read and turn
 * down are the most that fits inside that refusal.
 *
 * Two tiers, because the seven rules shared across the four source repos turned out to
 * be two different kinds of claim (D14):
 *
 *   hygiene           three defects — `any` from JSON.parse, `../../../` across a
 *                     package boundary, a library writing to stdout
 *   functional-style  four house-style calls — no classes, no `this`, no inheritance,
 *                     no default exports
 *
 * Each tier ships, per rule, the three files a rule is actually made of: `<id>.yml`,
 * `<id>-test.yml`, and `<id>-snapshot.yml`. The snapshot is not optional garnish —
 * `ast-grep test` reports `No <id> baseline found` and exits non-zero for any fixture
 * with `invalid:` cases and no recorded snapshot. Shipping ours means a freshly
 * installed tier is green immediately, rather than green after the adopter runs
 * `--update-all` and accepts whatever it generates (D3).
 *
 * Where they land is the repo's business, not ours: `rules_dir`, `tests_dir` and
 * `snapshot_dir` all come from the resolver reading the repo's `sgconfig.yml` (D2).
 *
 * Installs are **atomic**. Every destination is computed and every collision refused
 * before the first byte is written, so a half-installed tier is not a state this can
 * leave behind.
 *
 * Always emits exactly one JSON object on stdout:
 *
 *   { mode: 'tiers', tiers }
 *   { mode: 'installed', root, tiers, rules, written, skipped, created_dirs,
 *     path_scoped, ast_grep_command, next, warnings }
 *   { mode: 'error', error_type, message }
 *
 * `error_type` is `usage` (no tier, or an unknown one), `exists` (a rule in the tier is
 * already enforced here — pass `--skip-existing` to install the rest), `no-tests-dir`
 * (sgconfig declares no `testConfigs`, so the fixtures have nowhere to land), `tier`
 * (the bundled tier itself is unreadable — a packaging bug, not a repo problem), or
 * `config` / `sgconfig` passed through from the resolver unchanged.
 *
 * Usage:
 *   node install-starter.mjs --list
 *   node install-starter.mjs --tier hygiene
 *   node install-starter.mjs --tier hygiene --tier functional-style
 *   node install-starter.mjs --tier hygiene --skip-existing
 *   node install-starter.mjs --tier hygiene --root <dir>
 *
 * Exit codes match config.mjs, scan.mjs and scaffold-rule.mjs: 0 for any completed run
 * including `mode: 'error'`, 2 for an unexpected crash.
 *
 * Zero runtime dependencies (C1).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolve_config } from './config.mjs';
import { inventory_rules } from './scan.mjs';

const TIERS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'starter-rules');

class InstallError extends Error {
  constructor(error_type, message) {
    super(message);
    this.error_type = error_type;
  }
}

// ---------------------------------------------------------------- bundled tiers

/**
 * The two fields a caller needs from a bundled rule that are not its filename.
 *
 * This reads three top-level keys off a YAML document *we author and ship*, which is
 * what makes a line scanner honest here rather than lazy: the inputs are seven files in
 * this repo, not arbitrary user YAML, and `install-starter.test.mjs` asserts every one
 * of them parses to an id matching its own filename. A packaging mistake fails
 * `scripts/check.sh`, not somebody's install.
 */
export function read_rule_meta(text) {
  const lines = text.split('\n');
  const meta = { id: null, severity: null, files: [] };
  let in_files = false;

  for (const line of lines) {
    if (/^\s*$/.test(line)) continue;

    // A sequence item, but only while the `files:` key is the one still open.
    const item = in_files && /^\s+-\s+(.*)$/.exec(line);
    if (item) {
      meta.files.push(item[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    // Any other line at column 0 closes whatever key was open. Indented lines that
    // are not sequence items are block-scalar body (`note: |`) and mean nothing here.
    if (/^\S/.test(line)) in_files = false;
    else continue;

    const key = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (!key) continue;
    const [, name, inline] = key;
    if (name === 'id') meta.id = inline.trim().replace(/^["']|["']$/g, '') || null;
    else if (name === 'severity') meta.severity = inline.trim() || null;
    else if (name === 'files') in_files = inline.trim() === '';
  }

  return meta;
}

/**
 * A glob's fixed prefix — everything before the first metacharacter, as a directory.
 * `packages/**\/*.ts` → `packages`. Used to tell an adopter that a path-scoped rule
 * points at a directory their repo does not have, which is the failure mode that costs
 * nothing to hit and never announces itself: the rule loads, matches nothing, and looks
 * enforced.
 */
export function glob_prefix(glob) {
  const segments = glob.split('/');
  const fixed = [];
  for (const segment of segments) {
    if (/[*?[\]{}]/.test(segment)) break;
    fixed.push(segment);
  }
  // A trailing fixed segment is the filename, not a directory, unless the glob ended
  // without ever hitting a metacharacter — in which case there is no directory to check.
  if (fixed.length === segments.length) fixed.pop();
  return fixed.length === 0 ? null : fixed.join('/');
}

function read_tier(name) {
  const dir = resolve(TIERS_DIR, name);
  const manifest_path = resolve(dir, 'tier.json');
  if (!existsSync(manifest_path)) {
    throw new InstallError('tier', `no bundled tier named \`${name}\` — run \`--list\` to see what ships.`);
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifest_path, 'utf8'));
  } catch (err) {
    throw new InstallError('tier', `${name}/tier.json is not valid JSON: ${err.message}`);
  }

  const rules_dir = resolve(dir, 'rules');
  const tests_dir = resolve(dir, 'tests');
  const snapshots_dir = resolve(tests_dir, '__snapshots__');

  const rules = readdirSync(rules_dir)
    .filter((f) => f.endsWith('.yml'))
    .sort()
    .map((file) => {
      const id = file.slice(0, -'.yml'.length);
      const rule_source = resolve(rules_dir, file);
      const test_source = resolve(tests_dir, `${id}-test.yml`);
      const snapshot_source = resolve(snapshots_dir, `${id}-snapshot.yml`);

      // A rule without both halves is not a rule (D3), and a tier that shipped one
      // would install a red `ast-grep test` into somebody's repo.
      for (const [label, path] of [['fixture', test_source], ['snapshot', snapshot_source]]) {
        if (!existsSync(path)) {
          throw new InstallError('tier', `bundled rule \`${id}\` in tier \`${name}\` is missing its ${label} — this is a packaging bug in the plugin, not a problem with your repo.`);
        }
      }

      const meta = read_rule_meta(readFileSync(rule_source, 'utf8'));
      if (meta.id !== id) {
        throw new InstallError('tier', `bundled rule ${name}/rules/${file} declares \`id: ${meta.id}\`, which does not match its filename — this is a packaging bug in the plugin.`);
      }

      return { id, tier: name, severity: meta.severity, files: meta.files, rule_source, test_source, snapshot_source };
    });

  if (rules.length === 0) {
    throw new InstallError('tier', `bundled tier \`${name}\` contains no rules — this is a packaging bug in the plugin.`);
  }

  return { ...manifest, name, rules };
}

/** Every bundled tier, in directory order, with its rules. */
export function list_tiers() {
  const names = readdirSync(TIERS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  return names.map((name) => {
    const tier = read_tier(name);
    return {
      name: tier.name,
      title: tier.title,
      summary: tier.summary,
      description: tier.description,
      adopt_when: tier.adopt_when,
      decline_when: tier.decline_when,
      rules: tier.rules.map(({ id, severity, files }) => ({
        id,
        severity,
        path_scoped: files.length > 0,
        files,
      })),
    };
  });
}

// ---------------------------------------------------------------- install

function write_file(root, rel, contents, created_dirs) {
  const abs = resolve(root, rel);
  const dir = dirname(abs);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    const created = rel.split('/').slice(0, -1).join('/');
    if (!created_dirs.includes(created)) created_dirs.push(created);
  }
  writeFileSync(abs, contents, 'utf8');
}

/**
 * Install one or more bundled tiers into a repo. Returns the object the CLI prints —
 * never throws for an expected failure, so callers and tests read the same shape.
 *
 * Nothing is written until every rule in every named tier has a destination and no
 * collision: a tier that would half-land is refused whole.
 */
export function install_tiers(root_input, names, { skip_existing = false } = {}) {
  try {
    if (!Array.isArray(names) || names.length === 0) {
      throw new InstallError('usage', 'name at least one tier: `--tier hygiene`, `--tier functional-style`, or `--list` to see both.');
    }

    const known = readdirSync(TIERS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    const unknown = names.filter((n) => !known.includes(n));
    if (unknown.length > 0) {
      throw new InstallError('usage', `unknown tier${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')} — the bundled tiers are ${known.sort().join(' and ')}.`);
    }

    const config = resolve_config(root_input);
    if (config.mode === 'error') return config;

    const warnings = [...config.warnings];

    if (config.paths.tests_dir === null || config.paths.snapshot_dir === null) {
      throw new InstallError(
        'no-tests-dir',
        `${config.sgconfig_path} declares no \`testConfigs\`, so the bundled fixtures have nowhere to land — and a rule without a passing fixture is not done. Add a \`testConfigs\` entry (\`/ast-grep-rules:init\` offers to), then run this again.`,
      );
    }

    // Deduped in order: naming both tiers twice installs each rule once.
    const seen_ids = new Set();
    const tiers = [...new Set(names)].map(read_tier);
    const candidates = [];
    for (const tier of tiers) {
      for (const rule of tier.rules) {
        if (seen_ids.has(rule.id)) continue;
        seen_ids.add(rule.id);
        candidates.push(rule);
      }
    }

    // What this repo already enforces. A bundled rule colliding with a local one is
    // the interesting case: the local rule is the tuned one, so the default is to
    // refuse rather than to overwrite it or to stack a near-duplicate beside it.
    const { rules: existing, warnings: inventory_warnings } = inventory_rules(config.root, config.paths.rule_dirs);
    warnings.push(...inventory_warnings);

    const clashes = [];
    const install = [];
    for (const rule of candidates) {
      const local = existing.find((r) => r.id === rule.id);
      const rule_path = `${config.paths.rules_dir}/${rule.id}.yml`;
      const test_path = `${config.paths.tests_dir}/${rule.id}-test.yml`;
      const snapshot_path = `${config.paths.snapshot_dir}/${rule.id}-snapshot.yml`;
      const on_disk = [rule_path, test_path, snapshot_path].filter((p) => existsSync(resolve(config.root, p)));

      if (local || on_disk.length > 0) {
        clashes.push({ ...rule, rule_path, test_path, snapshot_path, at: local ? local.file : on_disk[0] });
      } else {
        install.push({ ...rule, rule_path, test_path, snapshot_path });
      }
    }

    if (clashes.length > 0 && !skip_existing) {
      const detail = clashes.map((c) => `  ${c.id} — already at ${c.at}`).join('\n');
      throw new InstallError(
        'exists',
        `this repo already has ${clashes.length} of these rule${clashes.length > 1 ? 's' : ''}:\n${detail}\n\nNothing was written. Your version is the tuned one, so it wins by default — pass \`--skip-existing\` to install the rest of the tier around it, or diff yours against the bundled copy under \`starter-rules/\` if you want the newer text.`,
      );
    }

    if (install.length === 0) {
      throw new InstallError(
        'exists',
        `every rule in ${names.join(' and ')} is already present in this repo — nothing left to install.`,
      );
    }

    // ------ nothing above this line writes; nothing below it can fail on a collision

    const written = [];
    const created_dirs = [];
    for (const rule of install) {
      write_file(config.root, rule.rule_path, readFileSync(rule.rule_source, 'utf8'), created_dirs);
      write_file(config.root, rule.test_path, readFileSync(rule.test_source, 'utf8'), created_dirs);
      write_file(config.root, rule.snapshot_path, readFileSync(rule.snapshot_source, 'utf8'), created_dirs);
      written.push(rule.rule_path, rule.test_path, rule.snapshot_path);
    }

    // A rule carrying `files:` governs only what those globs reach. Reporting the ones
    // whose fixed prefix is not a directory in this repo turns a silent no-op into a
    // line the adopter can act on.
    const path_scoped = install
      .filter((rule) => rule.files.length > 0)
      .map((rule) => {
        const missing = [...new Set(rule.files.map(glob_prefix).filter(Boolean))]
          .filter((prefix) => !existsSync(resolve(config.root, prefix)));
        return { id: rule.id, rule_path: rule.rule_path, files: rule.files, missing_prefixes: missing };
      });

    const next = [
      `run \`${config.ast_grep_command} test\` — it should be green immediately, because each rule shipped with its fixture and its recorded snapshot`,
      `run \`${config.ast_grep_command} scan\` to see what the new rules find in code that already exists — a tier landing on a mature repo usually does`,
    ];
    for (const scoped of path_scoped) {
      if (scoped.missing_prefixes.length > 0) {
        next.push(`edit \`files:\` in ${scoped.rule_path} — it is scoped to ${scoped.files.map((f) => `\`${f}\``).join(', ')}, and this repo has no ${scoped.missing_prefixes.map((p) => `\`${p}/\``).join(', ')} directory, so the rule currently governs nothing`);
      }
    }
    next.push(
      `state these conventions in ${config.conventions_path} if they are not written down yet — \`/ast-grep-rules:audit\` reads your docs, so a rule enforcing a convention nobody wrote down stays invisible to it`,
    );
    if (clashes.length > 0) {
      next.push(`review the ${clashes.length} rule${clashes.length > 1 ? 's' : ''} skipped as already present: ${clashes.map((c) => c.id).join(', ')}`);
    }

    return {
      mode: 'installed',
      root: config.root,
      tiers: tiers.map((t) => t.name),
      rules: install.map(({ id, tier, severity, rule_path, test_path, snapshot_path }) => ({
        id, tier, severity, rule_path, test_path, snapshot_path,
      })),
      written,
      skipped: clashes.map(({ id, tier, at }) => ({ id, tier, reason: 'already present', at })),
      created_dirs,
      path_scoped,
      ast_grep_command: config.ast_grep_command,
      next,
      warnings,
    };
  } catch (err) {
    if (err instanceof InstallError) {
      return { mode: 'error', error_type: err.error_type, message: err.message };
    }
    throw err;
  }
}

// ---------------------------------------------------------------- cli

function emit(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function find_repo_root() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function main(argv) {
  const args = argv.slice(2);
  let root = null;
  let list = false;
  let skip_existing = false;
  const tiers = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--root' || arg === '--tier') {
      const value = args[i + 1];
      i += 1;
      if (!value || value.startsWith('-')) {
        return emit({ mode: 'error', error_type: 'usage', message: `\`${arg}\` needs a ${arg === '--root' ? 'directory' : 'tier name'}.` });
      }
      if (arg === '--root') root = value;
      else tiers.push(value);
    } else if (arg === '--list') {
      list = true;
    } else if (arg === '--skip-existing') {
      skip_existing = true;
    } else {
      return emit({ mode: 'error', error_type: 'usage', message: `unknown argument: ${arg} (expected --list, --tier <name>, --skip-existing or --root <dir>)` });
    }
  }

  // `--list` with no tier is the default posture: say what ships, write nothing (D5).
  if (list || tiers.length === 0) {
    if (tiers.length > 0) {
      return emit({ mode: 'error', error_type: 'usage', message: '`--list` and `--tier` do different things — run one or the other.' });
    }
    return emit({ mode: 'tiers', tiers: list_tiers() });
  }

  emit(install_tiers(root ?? find_repo_root() ?? process.cwd(), tiers, { skip_existing }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv);
  } catch (err) {
    emit({ mode: 'error', error_type: 'runtime', message: err.stack ?? err.message });
    process.exit(2);
  }
}
