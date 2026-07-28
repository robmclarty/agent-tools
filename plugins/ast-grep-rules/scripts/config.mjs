#!/usr/bin/env node
/**
 * Config resolver — the one contract every `ast-grep-rules` skill reads.
 *
 * Two sources, one answer:
 *
 *   .claude/ast-grep.json  per-repo variance this plugin owns: where the prose stores
 *                          live, how to invoke ast-grep, an optional rule scaffolder
 *   sgconfig.yml           where rules, utils, tests and snapshots actually live —
 *                          read from ast-grep's own config, never restated in ours
 *
 * That split is the whole design. `ruleDirs` genuinely varies in the wild (`rules`,
 * `tools/ast-grep/rules`, `config/ast-grep/rules`, `./rules`), and ast-grep already owns
 * the mapping — duplicating it in a second file is how the two drift apart. So this
 * resolver reads sgconfig.yml and hands every skill the same resolved, repo-relative
 * paths. Restating a path we own in `.claude/ast-grep.json` is ignored, with a warning.
 *
 * Paths inside sgconfig.yml resolve relative to *that file*, not to the repo root —
 * which is what ast-grep does, and it matters: a `.ast-grep/sgconfig.yml` declaring
 * `ruleDirs: [./rules]` means `.ast-grep/rules/`. `snapshotDir` in turn resolves
 * relative to its own `testDir`, defaulting to `__snapshots__`.
 *
 * Always emits exactly one JSON object on stdout — skills consume it directly:
 *
 *   { mode: 'config', root, config_path, sgconfig_path, paths, exists,
 *     lessons_path, conventions_path, convention_docs,
 *     ast_grep_command, scaffold_command, warnings }
 *   { mode: 'error',  error_type, message }
 *
 * `error_type` is what `/init` branches on: `config` means this repo has never been
 * configured, `sgconfig` means it has but ast-grep's own config is missing or malformed.
 *
 * Usage:
 *   node config.mjs                 # resolve for the enclosing git repo (else cwd)
 *   node config.mjs --root <dir>    # resolve for an explicit root
 *
 * Exit codes:
 *   0  ran to completion — including expected failures (`mode: 'error'`). A non-zero
 *      exit would make a skill's preflight swallow stdout and hide the message.
 *   2  unexpected crash — JSON still on stdout where possible.
 *
 * Zero runtime dependencies, including for YAML: see `parse_sgconfig`.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CONFIG_REL = '.claude/ast-grep.json';
const DEFAULT_SNAPSHOT_DIR = '__snapshots__';

const DEFAULTS = {
  sgconfig: 'sgconfig.yml',
  lessons_path: 'docs/lessons.md',
  conventions_path: 'docs/conventions.md',
  convention_docs: ['CLAUDE.md'],
  ast_grep_command: 'pnpm exec ast-grep',
  scaffold_command: null,
};

// Keys ast-grep owns. Honoring one of these from our config would give a varying path
// two sources of truth, so they are ignored — loudly, since a user who wrote one meant
// something by it.
const SGCONFIG_OWNED = new Set([
  'rules_dir', 'rule_dirs', 'utils_dir', 'util_dirs', 'tests_dir', 'snapshot_dir',
]);

class ResolveError extends Error {
  constructor(error_type, message) {
    super(message);
    this.error_type = error_type;
  }
}

// ---------------------------------------------------------------- yaml subset

// sgconfig.yml is a small, flat document: two sequences of paths and one sequence of
// two-key mappings. Rather than take on a YAML dependency for that, this reads exactly
// the three keys the plugin needs and ignores every other top-level key the file may
// carry (`customLanguages`, `languageGlobs`, …) — an unknown key is never a failure.
// What it deliberately does NOT do is guess: an input it cannot read as the shape it
// expects throws, because a silently mis-parsed rules dir is worse than a stopped run.

function strip_comment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquote(value) {
  const q = value[0];
  if ((q === '"' || q === "'") && value.length > 1 && value.endsWith(q)) {
    return value.slice(1, -1);
  }
  return value;
}

// `key: value` — the first colon wins, so a value may contain colons.
const KEY_RE = /^([^:\s][^:]*):\s*(.*)$/;

function scan_lines(text) {
  const lines = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = strip_comment(raw).replace(/\s+$/, '');
    const body = line.trim();
    if (body === '' || body === '---' || body === '...') return;
    const indent = line.length - line.trimStart().length;
    if (line.slice(0, indent).includes('\t')) {
      throw new ResolveError('sgconfig', `line ${i + 1}: tabs are not valid YAML indentation.`);
    }
    lines.push({ n: i + 1, indent, text: body });
  });
  return lines;
}

// Split the document into its top-level `key:` blocks, each carrying its indented body.
function top_level_blocks(lines) {
  const blocks = new Map();
  let current = null;
  for (const line of lines) {
    if (line.indent === 0) {
      const m = KEY_RE.exec(line.text);
      if (!m) {
        throw new ResolveError('sgconfig', `line ${line.n}: expected a top-level \`key:\`, got \`${line.text}\`.`);
      }
      current = { key: m[1].trim(), inline: m[2].trim(), body: [], n: line.n };
      blocks.set(current.key, current);
    } else if (current) {
      current.body.push(line);
    } else {
      throw new ResolveError('sgconfig', `line ${line.n}: indented content before any top-level key.`);
    }
  }
  return blocks;
}

function parse_flow_sequence(inline, block) {
  if (!inline.startsWith('[') || !inline.endsWith(']')) {
    throw new ResolveError('sgconfig', `line ${block.n}: \`${block.key}\` must be a list, got \`${inline}\`.`);
  }
  return inline
    .slice(1, -1)
    .split(',')
    .map((s) => unquote(s.trim()))
    .filter((s) => s !== '');
}

// A block sequence whose items are either scalars (`- rules`) or one-level mappings
// (`- testDir: tests` plus deeper `snapshotDir: …` continuation lines).
function parse_block_sequence(block) {
  const items = [];
  let current = null;
  let item_indent = null;

  for (const line of block.body) {
    if (line.text === '-' || line.text.startsWith('- ')) {
      if (item_indent === null) item_indent = line.indent;
      else if (line.indent !== item_indent) {
        throw new ResolveError('sgconfig', `line ${line.n}: nested lists under \`${block.key}\` are not supported.`);
      }
      const rest = line.text.slice(1).trim();
      const m = rest === '' ? null : KEY_RE.exec(rest);
      if (rest === '') {
        current = {};
      } else if (m) {
        current = { [m[1].trim()]: unquote(m[2].trim()) };
      } else {
        items.push(unquote(rest));
        current = null;
        continue;
      }
      items.push(current);
      continue;
    }

    if (current === null || item_indent === null || line.indent <= item_indent) {
      throw new ResolveError('sgconfig', `line ${line.n}: expected a \`- \` list item under \`${block.key}\`, got \`${line.text}\`.`);
    }
    const m = KEY_RE.exec(line.text);
    if (!m) {
      throw new ResolveError('sgconfig', `line ${line.n}: expected \`key: value\` under \`${block.key}\`, got \`${line.text}\`.`);
    }
    current[m[1].trim()] = unquote(m[2].trim());
  }
  return items;
}

function parse_sequence(block) {
  return block.inline ? parse_flow_sequence(block.inline, block) : parse_block_sequence(block);
}

/**
 * Read `ruleDirs`, `utilDirs` and `testConfigs` out of an sgconfig.yml document.
 * Returns raw, unresolved values exactly as written — resolution is the caller's job.
 */
export function parse_sgconfig(text) {
  const blocks = top_level_blocks(scan_lines(text));
  const out = { ruleDirs: [], utilDirs: [], testConfigs: [] };

  for (const key of ['ruleDirs', 'utilDirs']) {
    const block = blocks.get(key);
    if (!block) continue;
    out[key] = parse_sequence(block).map((item) => {
      if (typeof item !== 'string') {
        throw new ResolveError('sgconfig', `line ${block.n}: \`${key}\` must be a list of paths.`);
      }
      return item;
    });
  }

  const tests = blocks.get('testConfigs');
  if (tests) {
    out.testConfigs = parse_sequence(tests).map((item) => {
      if (typeof item !== 'object') {
        throw new ResolveError('sgconfig', `line ${tests.n}: every \`testConfigs\` entry must be a mapping with a \`testDir\`.`);
      }
      if (!item.testDir) {
        throw new ResolveError('sgconfig', `line ${tests.n}: every \`testConfigs\` entry needs a \`testDir\`.`);
      }
      return item;
    });
  }

  return out;
}

// ---------------------------------------------------------------- paths

// Repo-relative, posix-separated — the form every skill interpolates into a path or a
// shell command. A path outside the root keeps its `../` prefix rather than being
// rejected; ast-grep allows it, so reporting it honestly beats refusing it.
function rel_to_root(root, abs) {
  const rel = relative(root, abs).split(/[\\/]/).join('/');
  return rel === '' ? '.' : rel;
}

function resolve_sgconfig(root, sgconfig_rel, warnings) {
  const abs = isAbsolute(sgconfig_rel) ? sgconfig_rel : resolve(root, sgconfig_rel);
  if (!existsSync(abs)) {
    throw new ResolveError(
      'sgconfig',
      `sgconfig not found: ${rel_to_root(root, abs)} — run \`/ast-grep-rules:init\` to bootstrap one, or point \`sgconfig\` in ${CONFIG_REL} at the right file.`,
    );
  }

  const parsed = parse_sgconfig(readFileSync(abs, 'utf8'));
  // ast-grep resolves every path in sgconfig.yml relative to the file itself.
  const base = dirname(abs);
  const from_base = (p) => rel_to_root(root, resolve(base, p));

  if (parsed.ruleDirs.length === 0) {
    throw new ResolveError(
      'sgconfig',
      `${rel_to_root(root, abs)} declares no \`ruleDirs\` — ast-grep has nowhere to load rules from.`,
    );
  }

  const rule_dirs = parsed.ruleDirs.map(from_base);
  const util_dirs = parsed.utilDirs.map(from_base);

  const test_configs = parsed.testConfigs.map((tc) => {
    const test_dir_abs = resolve(base, tc.testDir);
    return {
      tests_dir: rel_to_root(root, test_dir_abs),
      snapshot_dir: rel_to_root(root, resolve(test_dir_abs, tc.snapshotDir || DEFAULT_SNAPSHOT_DIR)),
    };
  });

  if (test_configs.length === 0) {
    warnings.push(
      `${rel_to_root(root, abs)} declares no \`testConfigs\` — \`ast-grep test\` has nowhere to look, and every rule this plugin writes ships with a \`*-test.yml\` fixture. Add one before running \`/ast-grep-rules:rule\`.`,
    );
  }

  return {
    path: rel_to_root(root, abs),
    paths: {
      // The first entry of each list is the one this plugin writes to; the full lists
      // are what `/audit` and the scan core inventory.
      rules_dir: rule_dirs[0],
      rule_dirs,
      utils_dir: util_dirs[0] ?? null,
      util_dirs,
      tests_dir: test_configs[0]?.tests_dir ?? null,
      snapshot_dir: test_configs[0]?.snapshot_dir ?? null,
      test_configs,
    },
  };
}

// ---------------------------------------------------------------- config file

function load_config_file(root) {
  const path = resolve(root, CONFIG_REL);
  if (!existsSync(path)) {
    throw new ResolveError('config', `no ${CONFIG_REL} found — run \`/ast-grep-rules:init\` to generate one.`);
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new ResolveError('config', `${CONFIG_REL} is not valid JSON: ${err.message}`);
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ResolveError('config', `${CONFIG_REL} must contain a JSON object.`);
  }
  return raw;
}

function expect_string(raw, key) {
  const value = raw[key];
  if (value === undefined || value === null) return DEFAULTS[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ResolveError('config', `${CONFIG_REL}: \`${key}\` must be a non-empty string.`);
  }
  return value;
}

function normalize_config(raw, warnings) {
  for (const key of Object.keys(raw)) {
    if (SGCONFIG_OWNED.has(key)) {
      warnings.push(`${CONFIG_REL}: \`${key}\` is ignored — rule, util, test and snapshot paths are read from sgconfig.yml, which owns them.`);
    } else if (!(key in DEFAULTS)) {
      warnings.push(`${CONFIG_REL}: unknown key \`${key}\` ignored.`);
    }
  }

  const config = {
    sgconfig: expect_string(raw, 'sgconfig'),
    lessons_path: expect_string(raw, 'lessons_path'),
    conventions_path: expect_string(raw, 'conventions_path'),
    ast_grep_command: expect_string(raw, 'ast_grep_command'),
    convention_docs: raw.convention_docs ?? DEFAULTS.convention_docs,
    scaffold_command: raw.scaffold_command ?? DEFAULTS.scaffold_command,
  };

  if (!Array.isArray(config.convention_docs) || config.convention_docs.some((d) => typeof d !== 'string')) {
    throw new ResolveError('config', `${CONFIG_REL}: \`convention_docs\` must be an array of paths.`);
  }
  if (config.scaffold_command !== null && (typeof config.scaffold_command !== 'string' || config.scaffold_command.trim() === '')) {
    throw new ResolveError('config', `${CONFIG_REL}: \`scaffold_command\` must be a non-empty string or null.`);
  }
  return config;
}

// ---------------------------------------------------------------- resolve

/**
 * Resolve `.claude/ast-grep.json` + sgconfig.yml into the plugin's one contract.
 * Never throws for an expected failure — returns `{ mode: 'error', … }` instead, so
 * callers and tests read the same object the CLI prints.
 */
export function resolve_config(root_input) {
  const root = resolve(root_input);
  const warnings = [];
  try {
    const config = normalize_config(load_config_file(root), warnings);
    const sg = resolve_sgconfig(root, config.sgconfig, warnings);

    // The audit set `/audit` reads, primary doc first, deduped.
    const convention_docs = [...new Set([config.conventions_path, ...config.convention_docs])]
      .map((path) => ({ path, exists: existsSync(resolve(root, path)) }));

    const has = (path) => path !== null && existsSync(resolve(root, path));

    return {
      mode: 'config',
      root,
      config_path: CONFIG_REL,
      sgconfig_path: sg.path,
      paths: sg.paths,
      exists: {
        rules_dir: has(sg.paths.rules_dir),
        utils_dir: has(sg.paths.utils_dir),
        tests_dir: has(sg.paths.tests_dir),
        snapshot_dir: has(sg.paths.snapshot_dir),
        lessons_path: has(config.lessons_path),
        conventions_path: has(config.conventions_path),
      },
      lessons_path: config.lessons_path,
      conventions_path: config.conventions_path,
      convention_docs,
      ast_grep_command: config.ast_grep_command,
      scaffold_command: config.scaffold_command,
      warnings,
    };
  } catch (err) {
    if (err instanceof ResolveError) {
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
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--root') {
      root = args[i + 1];
      i += 1;
      if (!root) return emit({ mode: 'error', error_type: 'usage', message: '`--root` needs a directory.' });
    } else {
      return emit({ mode: 'error', error_type: 'usage', message: `unknown argument: ${args[i]} (expected --root <dir> or nothing)` });
    }
  }
  emit(resolve_config(root ?? find_repo_root() ?? process.cwd()));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv);
  } catch (err) {
    emit({ mode: 'error', error_type: 'runtime', message: err.stack ?? err.message });
    process.exit(2);
  }
}
