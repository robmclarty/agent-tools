// Tests for the config resolver.
//
// Every case runs against a hand-authored fixture repo under `fixtures/` — nothing
// here reads a sibling project, so the suite passes on a machine that has never seen
// gantry or ridgeline, and in CI, which has no siblings at all.
//
// The three layouts are the ones that actually occur in the wild, verified against
// the sgconfig.yml files on this machine: rules under `tools/`, a bare root `rules`,
// and everything under `config/`. The fourth (sgconfig in a subdirectory) is the one
// whose semantics are easiest to get wrong and quietly ship.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse_sgconfig, resolve_config } from '../config.mjs';

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

// ---------------------------------------------------------------- layouts

test('layout A: tools/ast-grep/rules with an explicit testConfigs entry', () => {
  const c = resolve_config(fixture('tools-layout'));

  assert.equal(c.mode, 'config');
  assert.equal(c.config_path, '.claude/ast-grep.json');
  assert.equal(c.sgconfig_path, 'sgconfig.yml');
  assert.deepEqual(c.paths, {
    rules_dir: 'tools/ast-grep/rules',
    rule_dirs: ['tools/ast-grep/rules'],
    utils_dir: 'tools/ast-grep/util',
    util_dirs: ['tools/ast-grep/util'],
    tests_dir: 'tools/ast-grep/tests',
    snapshot_dir: 'tools/ast-grep/tests/__snapshots__',
    test_configs: [
      { tests_dir: 'tools/ast-grep/tests', snapshot_dir: 'tools/ast-grep/tests/__snapshots__' },
    ],
  });
  assert.deepEqual(c.warnings, []);
});

test('layout A: an empty config file gets every default', () => {
  const c = resolve_config(fixture('tools-layout'));

  assert.equal(c.lessons_path, 'docs/lessons.md');
  assert.equal(c.conventions_path, 'docs/conventions.md');
  assert.equal(c.ast_grep_command, 'pnpm exec ast-grep');
  assert.equal(c.scaffold_command, null);
  // Primary conventions doc first, then the defaulted extras — each reported as it is,
  // present or not, since `/audit` has to know which docs it can actually read.
  assert.deepEqual(c.convention_docs, [
    { path: 'docs/conventions.md', exists: false },
    { path: 'CLAUDE.md', exists: true },
  ]);
  assert.deepEqual(c.exists, {
    rules_dir: true,
    utils_dir: true,
    tests_dir: true,
    snapshot_dir: true,
    lessons_path: true,
    conventions_path: false,
  });
});

test('layout B: a bare `ruleDirs: [rules]` with no tests dir', () => {
  const c = resolve_config(fixture('bare-layout'));

  assert.equal(c.mode, 'config');
  assert.deepEqual(c.paths, {
    rules_dir: 'rules',
    rule_dirs: ['rules'],
    utils_dir: null,
    util_dirs: [],
    tests_dir: null,
    snapshot_dir: null,
    test_configs: [],
  });
  // No testConfigs is legal ast-grep and a problem for this plugin (every rule ships a
  // fixture), so it warns rather than either failing or inventing a path.
  assert.equal(c.warnings.filter((w) => w.includes('`testConfigs`')).length, 1);
  assert.equal(c.exists.tests_dir, false);
  assert.equal(c.exists.snapshot_dir, false);
});

test('layout B: config keys override the defaults', () => {
  const c = resolve_config(fixture('bare-layout'));

  assert.equal(c.lessons_path, 'notes/friction.md');
  assert.equal(c.conventions_path, 'docs/house-style.md');
  assert.equal(c.ast_grep_command, 'npx --no-install ast-grep');
  assert.equal(c.scaffold_command, 'pnpm scaffold:ast-grep-rule');
  assert.deepEqual(c.convention_docs.map((d) => d.path), [
    'docs/house-style.md',
    'CLAUDE.md',
    'docs/spec.md',
  ]);
});

test('layout B: a path key restated in our config is ignored, and says so', () => {
  const c = resolve_config(fixture('bare-layout'));

  // `rules_dir` belongs to sgconfig.yml. Honoring a second copy is how the two drift.
  assert.equal(c.warnings.filter((w) => w.includes('`rules_dir` is ignored')).length, 1);
  assert.equal(c.warnings.filter((w) => w.includes('unknown key `mine_threshold`')).length, 1);
  assert.equal(c.paths.rules_dir, 'rules');
});

test('layout C: config/ast-grep/rules, with snapshotDir defaulted inside testDir', () => {
  const c = resolve_config(fixture('config-layout'));

  assert.equal(c.mode, 'config');
  assert.equal(c.paths.rules_dir, 'config/ast-grep/rules');
  assert.equal(c.paths.tests_dir, 'config/ast-grep/tests');
  assert.equal(c.paths.snapshot_dir, 'config/ast-grep/tests/__snapshots__');
  // The tests dir is declared but not yet created: the path resolves, existence is
  // reported separately. `/rule` needs both answers, and they are different questions.
  assert.equal(c.exists.rules_dir, true);
  assert.equal(c.exists.tests_dir, false);
  assert.deepEqual(c.warnings, []);
});

test('sgconfig paths resolve relative to the sgconfig file, not the repo root', () => {
  const c = resolve_config(fixture('nested-sgconfig'));

  assert.equal(c.sgconfig_path, '.ast-grep/sgconfig.yml');
  assert.equal(c.paths.rules_dir, '.ast-grep/rules');
  assert.equal(c.exists.rules_dir, true);
});

// ---------------------------------------------------------------- error paths

test('a repo with no .claude/ast-grep.json points at /init', () => {
  const c = resolve_config(fixture('no-config'));

  assert.equal(c.mode, 'error');
  assert.equal(c.error_type, 'config');
  assert.match(c.message, /no \.claude\/ast-grep\.json found/);
  assert.match(c.message, /init/);
});

test('a configured repo whose sgconfig.yml is missing is a distinct failure', () => {
  const c = resolve_config(fixture('no-sgconfig'));

  // Distinct from the one above on purpose: `/init` branches on error_type to tell
  // "never configured" from "configured, but ast-grep's own config is gone".
  assert.equal(c.mode, 'error');
  assert.equal(c.error_type, 'sgconfig');
  assert.match(c.message, /sgconfig not found: sgconfig\.yml/);
});

test('an unparseable config file reports the JSON error', () => {
  const c = resolve_config(fixture('bad-config'));

  assert.equal(c.mode, 'error');
  assert.equal(c.error_type, 'config');
  assert.match(c.message, /is not valid JSON/);
});

test('an sgconfig with no ruleDirs fails instead of guessing one', () => {
  const c = resolve_config(fixture('empty-sgconfig'));

  assert.equal(c.mode, 'error');
  assert.equal(c.error_type, 'sgconfig');
  assert.match(c.message, /declares no `ruleDirs`/);
});

// ---------------------------------------------------------------- yaml subset

test('parse_sgconfig ignores keys the plugin does not read', () => {
  const parsed = parse_sgconfig([
    'ruleDirs:',
    '  - rules',
    'customLanguages:',
    '  mojo:',
    '    libraryPath: mojo.so',
    'languageGlobs:',
    '  html: ["*.vue"]',
  ].join('\n'));

  assert.deepEqual(parsed, { ruleDirs: ['rules'], utilDirs: [], testConfigs: [] });
});

test('parse_sgconfig handles comments, quotes and both sequence styles', () => {
  const parsed = parse_sgconfig([
    '# leading comment',
    'ruleDirs: ["rules", \'more/rules\']  # trailing comment',
    'utilDirs:',
    '  - "tools/util"   # quoted scalar',
    'testConfigs:',
    '  - testDir: tests',
    '    snapshotDir: snaps',
  ].join('\n'));

  assert.deepEqual(parsed, {
    ruleDirs: ['rules', 'more/rules'],
    utilDirs: ['tools/util'],
    testConfigs: [{ testDir: 'tests', snapshotDir: 'snaps' }],
  });
});

test('parse_sgconfig refuses shapes it cannot read rather than mis-reading them', () => {
  // A nested sequence would otherwise flatten into the outer list — a silently wrong
  // rules dir is worse than a stopped run.
  assert.throws(
    () => parse_sgconfig('testConfigs:\n  - testDir: tests\n    include:\n      - a\n'),
    /nested lists/,
  );
  assert.throws(() => parse_sgconfig('testConfigs:\n  - snapshotDir: snaps\n'), /needs a `testDir`/);
  assert.throws(() => parse_sgconfig('ruleDirs:\n  - testDir: tests\n'), /must be a list of paths/);
  assert.throws(() => parse_sgconfig('ruleDirs: rules\n'), /must be a list/);
  assert.throws(() => parse_sgconfig('ruleDirs:\n\t- rules\n'), /tabs are not valid/);
});
