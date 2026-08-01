#!/usr/bin/env node
/**
 * Cookbook installer — copies one worked example into the repo's own ast-grep dirs.
 *
 * What ships under `examples/` is **not a starter ruleset** (D23). It is six worked
 * rules, each chosen to demonstrate a distinct thing ast-grep can express — `kind:`,
 * `pattern:` with metavariables, `constraints:` + regex, a composite `all:`/`regex:`/
 * `not:`, a relational `inside:`/`has:` with `stopBy: end`, and `files:` scoping. Every
 * one of them also enforces *some* policy, because a rule that enforced nothing would
 * teach nothing; so every one of them says out loud which policy that is, on an
 * `encodes:` line, right next to the `demonstrates:` line naming the technique. A
 * reader who disagrees with all six policies still gets all six techniques.
 *
 * That is why there is no `--all`, no default, and no tier: the adopter names one
 * example, adapts it, and the rules their repo actually needs come from
 * `/ast-grep-rules:audit` reading their own docs. Adapt, don't adopt.
 *
 * Each example ships the three files a rule is actually made of: `<id>.yml`,
 * `<id>-test.yml`, and `<id>-snapshot.yml`. The snapshot is not optional garnish —
 * `ast-grep test` reports `No <id> baseline found` and exits non-zero for any fixture
 * with `invalid:` cases and no recorded snapshot. Shipping ours means an installed
 * example is green immediately, rather than green after the adopter runs `--update-all`
 * and accepts whatever it generates (D3).
 *
 * Where they land is the repo's business, not ours: `rules_dir`, `tests_dir` and
 * `snapshot_dir` all come from the resolver reading the repo's `sgconfig.yml` (D2).
 *
 * Installs are **atomic**. Every destination is computed and every collision refused
 * before the first byte is written, so a half-installed set is not a state this can
 * leave behind.
 *
 * Always emits exactly one JSON object on stdout:
 *
 *   { mode: 'examples', examples }
 *   { mode: 'installed', root, examples, written, skipped, created_dirs,
 *     path_scoped, ast_grep_command, next, warnings }
 *   { mode: 'error', error_type, message }
 *
 * `error_type` is `usage` (no example named, or an unknown one), `exists` (a rule of
 * that id is already enforced here — pass `--skip-existing` when naming several),
 * `no-tests-dir` (sgconfig declares no `testConfigs`, so the fixture has nowhere to
 * land), `example` (the bundled example itself is unreadable — a packaging bug, not a
 * repo problem), or `config` / `sgconfig` passed through from the resolver unchanged.
 *
 * Usage:
 *   node install-starter.mjs --list
 *   node install-starter.mjs --example no-enum-declaration
 *   node install-starter.mjs --example no-enum-declaration --example no-promise-then
 *   node install-starter.mjs --example no-promise-then --skip-existing
 *   node install-starter.mjs --example no-promise-then --root <dir>
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

const EXAMPLES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'examples');

/**
 * The rule keys that name a technique, in the order a reader meets them. Surfaced in
 * the listing so the catalogue is legible *without installing anything* — which is
 * what makes "learn the technique, reject the policy" an actual option rather than an
 * intention (D23). `install-starter.test.mjs` checks each example against the
 * technique its own `demonstrates:` line claims, using this same vocabulary.
 */
// A sub-rule can sit under a `- ` in an `all:`/`any:` list or on its own indented
// line, so every key tolerates the dash. `constraints:` and `files:` are top-level
// siblings of `rule:` and are anchored at column 0 on purpose.
const sub = (key) => new RegExp(`^[ \\t]*(?:-[ \\t]*)?${key}:`, 'm');
const CONSTRUCTS = [
  ['kind:', sub('kind')],
  ['pattern:', sub('pattern')],
  ['constraints:', /^constraints:/m],
  ['all:', sub('all')],
  ['any:', sub('any')],
  ['not:', sub('not')],
  ['regex:', sub('regex')],
  ['inside:', sub('inside')],
  ['has:', sub('has')],
  ['stopBy: end', /^[ \t]*(?:-[ \t]*)?stopBy:[ \t]*end[ \t]*$/m],
  ['files:', /^files:/m],
];

class InstallError extends Error {
  constructor(error_type, message) {
    super(message);
    this.error_type = error_type;
  }
}

// ---------------------------------------------------------------- bundled examples

/**
 * One `**label:**` paragraph out of a rule's `note:`, unwrapped to a single line.
 *
 * The two labels live in the note rather than in a sidecar manifest on purpose: the
 * note is the part that travels into the adopter's repo. A file that arrives without
 * the line naming the policy it carries is exactly the payload D23 refuses, and a
 * manifest this installer reads and then leaves behind would be that file.
 */
export function read_labelled(text, label) {
  // Deliberately not multiline: with the `m` flag `$` matches every line end, which
  // would clip each label to its first wrapped line. The paragraph runs to the next
  // blank line, or to the end of the file.
  const found = new RegExp(`(?:^|\\n)[ \\t]*\\*\\*${label}:\\*\\*[ \\t]*([\\s\\S]*?)(?:\\n[ \\t]*\\n|$)`).exec(text);
  return found ? found[1].replace(/\s+/g, ' ').trim() : null;
}

/**
 * The fields a caller needs from a bundled rule that are not its filename.
 *
 * This reads three top-level keys off a YAML document *we author and ship*, which is
 * what makes a line scanner honest here rather than lazy: the inputs are six files in
 * this repo, not arbitrary user YAML, and `install-starter.test.mjs` asserts every one
 * of them parses to an id matching its own filename. A packaging mistake fails
 * `scripts/check.sh`, not somebody's install.
 */
export function read_rule_meta(text) {
  const lines = text.split('\n');
  // Constructs are counted from `rule:` down, never over the note — otherwise a note
  // that *explains* `any:` would report a rule that uses it, and the technique
  // coverage this file claims would be prose checking prose.
  const body_at = text.search(/^rule:/m);
  const body = body_at === -1 ? '' : text.slice(body_at);
  const meta = {
    id: null,
    severity: null,
    files: [],
    demonstrates: read_labelled(text, 'demonstrates'),
    encodes: read_labelled(text, 'encodes'),
    uses: CONSTRUCTS.filter(([, re]) => re.test(body)).map(([name]) => name),
  };
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

/** Every bundled example id, in directory order. */
export function example_ids() {
  return readdirSync(resolve(EXAMPLES_DIR, 'rules'))
    .filter((f) => f.endsWith('.yml'))
    .map((f) => f.slice(0, -'.yml'.length))
    .sort();
}

function read_example(id) {
  const rule_source = resolve(EXAMPLES_DIR, 'rules', `${id}.yml`);
  if (!existsSync(rule_source)) {
    throw new InstallError('example', `no bundled example named \`${id}\` — run \`--list\` to see what ships.`);
  }

  const test_source = resolve(EXAMPLES_DIR, 'tests', `${id}-test.yml`);
  const snapshot_source = resolve(EXAMPLES_DIR, 'tests', '__snapshots__', `${id}-snapshot.yml`);

  // A rule without both halves is not a rule (D3), and an example that shipped one
  // would install a red `ast-grep test` into somebody's repo.
  for (const [label, path] of [['fixture', test_source], ['snapshot', snapshot_source]]) {
    if (!existsSync(path)) {
      throw new InstallError('example', `bundled example \`${id}\` is missing its ${label} — this is a packaging bug in the plugin, not a problem with your repo.`);
    }
  }

  const meta = read_rule_meta(readFileSync(rule_source, 'utf8'));
  if (meta.id !== id) {
    throw new InstallError('example', `bundled example rules/${id}.yml declares \`id: ${meta.id}\`, which does not match its filename — this is a packaging bug in the plugin.`);
  }
  // An example that arrived without one of its two labels would be a rule presented
  // as a technique, which is the exact drift D23 exists to catch.
  for (const label of ['demonstrates', 'encodes']) {
    if (!meta[label]) {
      throw new InstallError('example', `bundled example \`${id}\` has no **${label}:** line in its note — this is a packaging bug in the plugin.`);
    }
  }

  return { id, ...meta, rule_source, test_source, snapshot_source };
}

/**
 * The whole cookbook, as the offer is made from it: what each example teaches, what it
 * would enforce, which constructs its rule body actually uses, and where to read the
 * rule and its fixture. Writes nothing — reading the catalogue is the no-install path
 * through this script, and the `path` pair is what makes citing an example cost no
 * install at all.
 */
export function list_examples() {
  return example_ids().map((id) => {
    const { severity, files, demonstrates, encodes, uses, rule_source, test_source } = read_example(id);
    return {
      id,
      demonstrates,
      encodes,
      uses,
      severity,
      // Where to *read* the example, not where an install would put it. `/rule` and
      // `/audit` cite the cookbook by opening these files, so the catalogue hands them
      // the paths rather than leaving each SKILL to spell out the bundled layout in
      // prose — six hard-coded paths that go stale the first time it moves.
      path: { rule: rule_source, test: test_source },
      path_scoped: files.length > 0,
      files,
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
 * Install one or more named examples into a repo. Returns the object the CLI prints —
 * never throws for an expected failure, so callers and tests read the same shape.
 *
 * Nothing is written until every named example has a destination and no collision: a
 * set that would half-land is refused whole.
 */
export function install_examples(root_input, ids, { skip_existing = false } = {}) {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new InstallError('usage', 'name at least one example: `--example <id>`, or `--list` to see all six. There is no default and no install-everything flag — an example is something you adapt, one at a time.');
    }

    const known = example_ids();
    const unknown = ids.filter((n) => !known.includes(n));
    if (unknown.length > 0) {
      throw new InstallError('usage', `unknown example${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')} — the bundled examples are ${known.join(', ')}.`);
    }

    const config = resolve_config(root_input);
    if (config.mode === 'error') return config;

    const warnings = [...config.warnings];

    if (config.paths.tests_dir === null || config.paths.snapshot_dir === null) {
      throw new InstallError(
        'no-tests-dir',
        `${config.sgconfig_path} declares no \`testConfigs\`, so the bundled fixture has nowhere to land — and a rule without a passing fixture is not done. Add a \`testConfigs\` entry (\`/ast-grep-rules:init\` offers to), then run this again.`,
      );
    }

    // Deduped in order: naming the same example twice installs it once.
    const candidates = [...new Set(ids)].map(read_example);

    // What this repo already enforces. A bundled example colliding with a local rule
    // is the interesting case: the local rule is the tuned one, so the default is to
    // refuse rather than to overwrite it or to stack a near-duplicate beside it.
    const { rules: existing, warnings: inventory_warnings } = inventory_rules(config.root, config.paths.rule_dirs);
    warnings.push(...inventory_warnings);

    const clashes = [];
    const install = [];
    for (const example of candidates) {
      const local = existing.find((r) => r.id === example.id);
      const rule_path = `${config.paths.rules_dir}/${example.id}.yml`;
      const test_path = `${config.paths.tests_dir}/${example.id}-test.yml`;
      const snapshot_path = `${config.paths.snapshot_dir}/${example.id}-snapshot.yml`;
      const on_disk = [rule_path, test_path, snapshot_path].filter((p) => existsSync(resolve(config.root, p)));

      if (local || on_disk.length > 0) {
        clashes.push({ ...example, rule_path, test_path, snapshot_path, at: local ? local.file : on_disk[0] });
      } else {
        install.push({ ...example, rule_path, test_path, snapshot_path });
      }
    }

    if (clashes.length > 0 && !skip_existing) {
      const detail = clashes.map((c) => `  ${c.id} — already at ${c.at}`).join('\n');
      throw new InstallError(
        'exists',
        `this repo already has ${clashes.length} of these rule${clashes.length > 1 ? 's' : ''}:\n${detail}\n\nNothing was written. Your version is the tuned one, so it wins by default — pass \`--skip-existing\` to install the rest around it, or read the bundled copy under \`examples/\` if you want the technique rather than the file.`,
      );
    }

    if (install.length === 0) {
      throw new InstallError(
        'exists',
        `every example named is already present in this repo — nothing left to install.`,
      );
    }

    // ------ nothing above this line writes; nothing below it can fail on a collision

    const written = [];
    const created_dirs = [];
    for (const example of install) {
      write_file(config.root, example.rule_path, readFileSync(example.rule_source, 'utf8'), created_dirs);
      write_file(config.root, example.test_path, readFileSync(example.test_source, 'utf8'), created_dirs);
      write_file(config.root, example.snapshot_path, readFileSync(example.snapshot_source, 'utf8'), created_dirs);
      written.push(example.rule_path, example.test_path, example.snapshot_path);
    }

    // A rule carrying `files:` governs only what those globs reach. Reporting the ones
    // whose fixed prefix is not a directory in this repo turns a silent no-op into a
    // line the adopter can act on.
    const path_scoped = install
      .filter((example) => example.files.length > 0)
      .map((example) => {
        const missing = [...new Set(example.files.map(glob_prefix).filter(Boolean))]
          .filter((prefix) => !existsSync(resolve(config.root, prefix)));
        return { id: example.id, rule_path: example.rule_path, files: example.files, missing_prefixes: missing };
      });

    // The closing instruction is *adapt*, not *run* — an example installed and left
    // alone is the bundled policy D23 refuses, just delivered by hand.
    const next = [
      `read the **encodes:** line at the top of ${install.length > 1 ? 'each' : 'the'} rule's \`note:\` and decide whether you agree with it — that line is the policy, and it is the part you are meant to change`,
      `run \`${config.ast_grep_command} test\` — it should be green immediately, because each example shipped with its fixture and its recorded snapshot`,
      `run \`${config.ast_grep_command} scan\` to see what it finds in code that already exists — on a mature repo it usually finds plenty, and that is the real decision`,
    ];
    for (const scoped of path_scoped) {
      if (scoped.missing_prefixes.length > 0) {
        next.push(`edit \`files:\` in ${scoped.rule_path} — it is scoped to ${scoped.files.map((f) => `\`${f}\``).join(', ')}, and this repo has no ${scoped.missing_prefixes.map((p) => `\`${p}/\``).join(', ')} directory, so the rule currently governs nothing`);
      }
    }
    next.push(
      `state the convention in ${config.conventions_path} once you have decided you want it — \`/ast-grep-rules:audit\` reads your docs, so a rule enforcing a convention nobody wrote down stays invisible to it`,
    );
    if (clashes.length > 0) {
      next.push(`review the ${clashes.length} example${clashes.length > 1 ? 's' : ''} skipped as already present: ${clashes.map((c) => c.id).join(', ')}`);
    }

    return {
      mode: 'installed',
      root: config.root,
      examples: install.map(({ id, severity, demonstrates, encodes, uses, rule_path, test_path, snapshot_path }) => ({
        id, severity, demonstrates, encodes, uses, rule_path, test_path, snapshot_path,
      })),
      written,
      skipped: clashes.map(({ id, at }) => ({ id, reason: 'already present', at })),
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
  const examples = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--root' || arg === '--example') {
      const value = args[i + 1];
      i += 1;
      if (!value || value.startsWith('-')) {
        return emit({ mode: 'error', error_type: 'usage', message: `\`${arg}\` needs a ${arg === '--root' ? 'directory' : 'example id'}.` });
      }
      if (arg === '--root') root = value;
      else examples.push(value);
    } else if (arg === '--list') {
      list = true;
    } else if (arg === '--skip-existing') {
      skip_existing = true;
    } else {
      return emit({ mode: 'error', error_type: 'usage', message: `unknown argument: ${arg} (expected --list, --example <id>, --skip-existing or --root <dir>)` });
    }
  }

  // `--list` with no example named is the default posture: say what ships, write
  // nothing. The catalogue is the deliverable; the install is the optional part (D23).
  if (list || examples.length === 0) {
    if (examples.length > 0) {
      return emit({ mode: 'error', error_type: 'usage', message: '`--list` and `--example` do different things — run one or the other.' });
    }
    return emit({ mode: 'examples', examples: list_examples() });
  }

  emit(install_examples(root ?? find_repo_root() ?? process.cwd(), examples, { skip_existing }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv);
  } catch (err) {
    emit({ mode: 'error', error_type: 'runtime', message: err.stack ?? err.message });
    process.exit(2);
  }
}
