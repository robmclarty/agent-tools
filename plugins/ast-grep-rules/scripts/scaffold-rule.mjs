#!/usr/bin/env node
/**
 * Rule scaffolder — the two files a rule is made of, written together (D3, D4).
 *
 * A rule is not done when its YAML exists. It is done when `<ast_grep_command> test`
 * passes against a `*-test.yml` fixture that pins what it catches and what it must
 * leave alone. The field evidence is blunt about which half goes missing: gantry ships
 * a scaffolder and an **empty** tests directory; ridgeline ships ten fixtures and
 * hand-writes every rule. So this script emits both halves, always, and the fixture is
 * ours on either branch of D4 — a repo's own `scaffold_command` writes the rule YAML
 * and nothing else, which is exactly what gantry's does.
 *
 * **The scaffold is born red.** The rule carries `pattern: TODO_REPLACE_ME` and the
 * fixture an `invalid:` sample that placeholder cannot match, so `ast-grep test` fails
 * until a human fills both in. That is deliberate: D3 enforced by the artifact survives
 * the conversation, and a half-finished rule can never masquerade as a green one.
 *
 * What it will not do is guess. `files:` ships commented out, because gantry's template
 * hardcodes `apps/**`, `packages/**`, `tools/**` and those globs are wrong everywhere
 * else; the three `ignores` entries are universal and do ship. And the `note:` carries
 * the *working* suppression form — a trailing `// ast-grep-ignore: <id>` (D22). Three
 * of the four source repos still document `ast-grep-ignore-next-line`, which does not
 * work; scaffolding it into every new rule would propagate the bug by hand.
 *
 * Always emits exactly one JSON object on stdout:
 *
 *   { mode: 'scaffolded', root, id, rule_path, test_path, written, skipped,
 *     created_dirs, ast_grep_command, scaffold_command, next, warnings }
 *   { mode: 'error', error_type, message }
 *
 * `error_type` is `usage` (the id is not kebab-case), `exists` (that id is already
 * enforced), `no-tests-dir` (sgconfig declares no `testConfigs`, so D3 has nowhere to
 * land), or `config` / `sgconfig` passed through from the resolver unchanged.
 *
 * Usage:
 *   node scaffold-rule.mjs <kebab-id>                  # rule + fixture
 *   node scaffold-rule.mjs <kebab-id> --fixture-only   # after a repo `scaffold_command`
 *   node scaffold-rule.mjs <kebab-id> --rule-only      # a rule whose fixture exists
 *   node scaffold-rule.mjs <kebab-id> --root <dir>
 *
 * Exit codes match config.mjs and scan.mjs: 0 for any completed run including
 * `mode: 'error'` (a non-zero exit would make a skill's preflight swallow the message),
 * 2 for an unexpected crash.
 *
 * Zero runtime dependencies (C1).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolve_config } from './config.mjs';
import { inventory_rules } from './scan.mjs';

// ast-grep ids are kebab-case by convention across all four source repos and every
// bundled example. Enforcing it here keeps `<id>.yml`, `<id>-test.yml` and the trailing
// `// ast-grep-ignore: <id>` comment spelling the same thing.
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The placeholders. They must differ from each other: the rule's pattern is an
// identifier, the fixture's samples are *different* identifiers, so the invalid case
// does not match and the pair is red on arrival.
const RULE_PLACEHOLDER = 'TODO_REPLACE_ME';
const VALID_PLACEHOLDER = 'TODO_REPLACE_ME_VALID';
const INVALID_PLACEHOLDER = 'TODO_REPLACE_ME_INVALID';

class ScaffoldError extends Error {
  constructor(error_type, message) {
    super(message);
    this.error_type = error_type;
  }
}

// ---------------------------------------------------------------- templates

/**
 * The rule YAML. Everything mechanical is filled in; everything that is judgment is a
 * TODO, in the order the skill fills them.
 */
export function render_rule(id) {
  return `id: ${id}
language: TypeScript
severity: error
message: "TODO: one line. Format: \\"Don't <X>. Use <runnable exemplar>.\\" plus a docs anchor."
note: |
  TODO: replace this block. A future model reads it when this rule blocks its
  edit, so answer three questions in order:

    1. Why is this pattern wrong *here*? (the project reason, not a general one)
    2. What is the replacement, written as a line someone can paste?
    3. When is suppression legitimate?

  Legitimate suppression, and the only form that works — a trailing comment on
  the offending line:

      // ast-grep-ignore: ${id}

  Or add the path to \`ignores\` below.

rule:
  # TODO: replace with the structural match. Prefer \`kind:\` over \`pattern:\` where you
  # can — \`kind: class_declaration\` tolerates syntax it has never seen, a pattern does
  # not. Use \`stopBy: end\` on relational rules (\`inside\`, \`has\`) so the search reaches
  # the end of the direction instead of stopping at the first ancestor.
  #
  # This placeholder matches nothing you care about, which keeps \`ast-grep test\` red
  # until you replace it. That is the point — an unfinished rule cannot look done.
  pattern: ${RULE_PLACEHOLDER}

# TODO: narrow to the globs this rule should govern. Omit the key entirely to let it
# apply everywhere ast-grep already scans. There is no portable default: every repo's
# source layout differs, so a guessed glob is a rule that silently governs nothing.
# files:
#   - "src/**/*.ts"

ignores:
  - "**/*.d.ts"
  - "**/dist/**"
  - "**/node_modules/**"
`;
}

/**
 * The `*-test.yml` fixture. `valid:` is the half that gets skipped and the half that
 * catches over-broad rules, so the comment says so where it will be read.
 */
export function render_fixture(id) {
  return `id: ${id}
# TODO: replace both lists. Start with the two samples you wrote down before
# scaffolding, then add the edge cases this rule is most likely to get wrong —
# template literals, generics, async, JSX, re-exports.
#
#   valid:   code that must NOT match. This is the half that catches an over-broad
#            rule, and the half everyone under-writes. Spend your samples here.
#   invalid: code that MUST match. Every shape the rule is meant to catch.
#
# The placeholders below are deliberately unmatchable: the rule ships with
# \`pattern: ${RULE_PLACEHOLDER}\`, which does not match \`${INVALID_PLACEHOLDER}\`,
# so \`ast-grep test\` is red until both lists are real.
valid:
  - "const ${VALID_PLACEHOLDER} = 1"

invalid:
  - "const ${INVALID_PLACEHOLDER} = 1"
`;
}

// ---------------------------------------------------------------- scaffold

function assert_id(id) {
  if (!id) {
    throw new ScaffoldError('usage', 'a rule id is required: `node scaffold-rule.mjs <kebab-id>`.');
  }
  if (!KEBAB_RE.test(id)) {
    throw new ScaffoldError(
      'usage',
      `\`${id}\` is not a kebab-case rule id — lowercase letters, digits and single hyphens (e.g. \`no-default-export\`).`,
    );
  }
}

function write_file(root, rel, contents, created_dirs) {
  const abs = resolve(root, rel);
  const dir = dirname(abs);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    created_dirs.push(rel.split('/').slice(0, -1).join('/'));
  }
  writeFileSync(abs, contents, 'utf8');
}

/**
 * Scaffold one rule into a repo. Returns the object the CLI prints — never throws for
 * an expected failure, so callers and tests read the same shape.
 *
 * `mode` is `'both'` (the D4 fallback), `'fixture'` (a repo `scaffold_command` already
 * wrote the rule) or `'rule'` (a fixture-less rule being repaired).
 */
export function scaffold_rule(root_input, id, mode = 'both') {
  try {
    assert_id(id);

    const config = resolve_config(root_input);
    if (config.mode === 'error') return config;

    const writes_rule = mode !== 'fixture';
    const writes_test = mode !== 'rule';
    const warnings = [...config.warnings];

    if (writes_test && config.paths.tests_dir === null) {
      throw new ScaffoldError(
        'no-tests-dir',
        `${config.sgconfig_path} declares no \`testConfigs\`, so there is nowhere to put \`${id}-test.yml\` — and a rule without a passing fixture is not done. Add a \`testConfigs\` entry (\`/ast-grep-rules:init\` offers to), then run this again.`,
      );
    }

    const rule_path = `${config.paths.rules_dir}/${id}.yml`;
    const test_path = config.paths.tests_dir === null ? null : `${config.paths.tests_dir}/${id}-test.yml`;

    // Refuse a collision rather than stack a second rule on the same idea. The
    // inventory check is skipped in fixture mode, where the id is *expected* to be
    // present — the repo's own scaffolder just wrote it.
    if (writes_rule) {
      const { rules, warnings: rule_warnings } = inventory_rules(config.root, config.paths.rule_dirs);
      warnings.push(...rule_warnings);
      const clash = rules.find((r) => r.id === id);
      if (clash) {
        throw new ScaffoldError(
          'exists',
          `\`${id}\` is already enforced by ${clash.file}. Fix that rule rather than stacking a second one on it — two rules for one idea is how the pair drifts apart.`,
        );
      }
      if (existsSync(resolve(config.root, rule_path))) {
        throw new ScaffoldError('exists', `${rule_path} already exists — refusing to overwrite it.`);
      }
    }
    if (writes_test && existsSync(resolve(config.root, test_path))) {
      throw new ScaffoldError('exists', `${test_path} already exists — refusing to overwrite it.`);
    }

    const written = [];
    const skipped = [];
    const created_dirs = [];

    if (writes_rule) {
      write_file(config.root, rule_path, render_rule(id), created_dirs);
      written.push(rule_path);
    } else {
      skipped.push(rule_path);
    }
    if (writes_test) {
      write_file(config.root, test_path, render_fixture(id), created_dirs);
      written.push(test_path);
    } else if (test_path !== null) {
      skipped.push(test_path);
    }

    return {
      mode: 'scaffolded',
      root: config.root,
      id,
      rule_path,
      test_path,
      written,
      skipped,
      created_dirs,
      ast_grep_command: config.ast_grep_command,
      scaffold_command: config.scaffold_command,
      next: [
        `fill in \`message:\`, \`note:\` and \`rule:\` in ${rule_path} — every TODO is a judgment call the scaffolder deliberately left open`,
        `replace the placeholder \`valid:\` / \`invalid:\` samples in ${test_path ?? '<the fixture>'}`,
        `run \`${config.ast_grep_command} test\` until every case reports what you intended — it is red right now, on purpose`,
        `record the snapshot with \`${config.ast_grep_command} test -U\`, then confirm \`${config.ast_grep_command} test\` is green with no flags — a fixture with \`invalid:\` cases is not green until its snapshot exists`,
        `then \`${config.ast_grep_command} scan\` to see what the new rule finds in code that already exists`,
      ],
      warnings,
    };
  } catch (err) {
    if (err instanceof ScaffoldError) {
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
  let id = null;
  let mode = 'both';

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--root') {
      root = args[i + 1];
      i += 1;
      if (!root) return emit({ mode: 'error', error_type: 'usage', message: '`--root` needs a directory.' });
    } else if (arg === '--fixture-only' || arg === '--rule-only') {
      const requested = arg === '--fixture-only' ? 'fixture' : 'rule';
      if (mode !== 'both' && mode !== requested) {
        return emit({ mode: 'error', error_type: 'usage', message: '`--fixture-only` and `--rule-only` are mutually exclusive.' });
      }
      mode = requested;
    } else if (arg.startsWith('-')) {
      return emit({ mode: 'error', error_type: 'usage', message: `unknown argument: ${arg} (expected --fixture-only, --rule-only or --root <dir>)` });
    } else if (id === null) {
      id = arg;
    } else {
      return emit({ mode: 'error', error_type: 'usage', message: `unexpected argument: ${arg} (one rule id at a time)` });
    }
  }

  emit(scaffold_rule(root ?? find_repo_root() ?? process.cwd(), id, mode));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv);
  } catch (err) {
    emit({ mode: 'error', error_type: 'runtime', message: err.stack ?? err.message });
    process.exit(2);
  }
}
