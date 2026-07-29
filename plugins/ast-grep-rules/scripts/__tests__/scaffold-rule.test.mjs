// Tests for the rule scaffolder — the two files a rule is made of (D3, D4).
//
// This is the first script in the plugin that *writes*, so the cases that reach a write
// build a throwaway repo under the OS temp dir and remove it afterwards. Nothing here
// touches a sibling project or dirties a committed fixture (C7): the suite passes on a
// machine that has never seen gantry or ridgeline, and in CI, which has no siblings.
//
// Every refusal, by contrast, happens *before* any write, so those cases can point
// straight at the read-only fixtures the resolver tests already use.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { render_fixture, render_rule, scaffold_rule } from '../scaffold-rule.mjs';

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const cli = fileURLToPath(new URL('../scaffold-rule.mjs', import.meta.url));

const SGCONFIG = `ruleDirs:
  - rules

testConfigs:
  - testDir: tests
    snapshotDir: __snapshots__
`;

const temps = [];

/** A minimal configured repo in the temp dir, removed when the suite ends. */
function make_repo({ sgconfig = SGCONFIG, config = '{}', dirs = ['rules', 'tests'], files = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ast-grep-rules-'));
  temps.push(root);

  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(join(root, '.claude/ast-grep.json'), config, 'utf8');
  writeFileSync(join(root, 'sgconfig.yml'), sgconfig, 'utf8');
  for (const dir of dirs) mkdirSync(join(root, dir), { recursive: true });
  for (const [rel, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), contents, 'utf8');
  }
  return root;
}

const read = (root, rel) => readFileSync(join(root, rel), 'utf8');

after(() => {
  for (const root of temps) rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- the happy path

test('writes both halves of a rule at the sgconfig-resolved paths', () => {
  const root = make_repo();
  const s = scaffold_rule(root, 'no-untyped-json-parse');

  assert.equal(s.mode, 'scaffolded');
  assert.equal(s.id, 'no-untyped-json-parse');
  assert.equal(s.rule_path, 'rules/no-untyped-json-parse.yml');
  assert.equal(s.test_path, 'tests/no-untyped-json-parse-test.yml');
  assert.deepEqual(s.written, [
    'rules/no-untyped-json-parse.yml',
    'tests/no-untyped-json-parse-test.yml',
  ]);
  assert.deepEqual(s.skipped, []);
  assert.deepEqual(s.warnings, []);

  assert.ok(existsSync(join(root, s.rule_path)), 'the rule file is on disk');
  assert.ok(existsSync(join(root, s.test_path)), 'the fixture is on disk');
  assert.match(read(root, s.rule_path), /^id: no-untyped-json-parse$/m);
  assert.match(read(root, s.test_path), /^id: no-untyped-json-parse$/m);
  // The resolved command is relayed so the skill runs the repo's ast-grep, not `ast-grep`.
  assert.equal(s.ast_grep_command, 'pnpm exec ast-grep');
  assert.equal(s.scaffold_command, null);
});

test('follows sgconfig into a non-default layout rather than assuming rules/', () => {
  const root = make_repo({
    sgconfig: 'ruleDirs:\n  - tools/ast-grep/rules\n\ntestConfigs:\n  - testDir: tools/ast-grep/tests\n',
    dirs: ['tools/ast-grep/rules', 'tools/ast-grep/tests'],
  });
  const s = scaffold_rule(root, 'no-commonjs');

  assert.equal(s.rule_path, 'tools/ast-grep/rules/no-commonjs.yml');
  assert.equal(s.test_path, 'tools/ast-grep/tests/no-commonjs-test.yml');
  assert.ok(existsSync(join(root, s.rule_path)));
  assert.ok(existsSync(join(root, s.test_path)));
});

test('creates a rules or tests directory that sgconfig declares but the repo lacks', () => {
  const root = make_repo({ dirs: [] });
  const s = scaffold_rule(root, 'no-this-keyword');

  assert.equal(s.mode, 'scaffolded');
  assert.deepEqual(s.created_dirs, ['rules', 'tests']);
  assert.ok(existsSync(join(root, s.rule_path)));
  assert.ok(existsSync(join(root, s.test_path)));
});

// ---------------------------------------------------------------- D22, the done-when

test('the emitted note documents the trailing suppression form, not the broken one', () => {
  const rule = render_rule('no-default-export');

  // foundry's bf33067 corrected this; the other three repos still document a form that
  // does not work. Scaffolding the broken one into every new rule would propagate the
  // bug by hand, so the working form is asserted here rather than left to review.
  assert.ok(
    rule.includes('// ast-grep-ignore: no-default-export'),
    'the note carries the trailing `// ast-grep-ignore: <id>` form, with the real id',
  );
  assert.ok(
    !rule.includes('ast-grep-ignore-next-line'),
    'the note never documents `ast-grep-ignore-next-line`, which does not work',
  );
});

test('the scaffolded pair is born red — the placeholder pattern matches no sample', () => {
  const rule = render_rule('no-class-declaration');
  const fixture_yaml = render_fixture('no-class-declaration');

  // `ast-grep test` going green on an unfilled scaffold would make D3 a line of prose
  // instead of a gate. The rule's pattern is an identifier the fixture's `invalid:`
  // sample deliberately does not contain, so the pair fails until a human fills it in.
  // (That the run is *actually* red is proven by the live fire, which has an ast-grep.)
  assert.match(rule, /^ {2}pattern: TODO_REPLACE_ME$/m);
  assert.ok(fixture_yaml.includes('TODO_REPLACE_ME_INVALID'));
  assert.ok(!/["']TODO_REPLACE_ME["']/.test(fixture_yaml), 'no sample is the bare placeholder pattern');
});

test('files: ships commented out — there is no portable source glob to guess', () => {
  const rule = render_rule('no-console-in-packages');

  assert.match(rule, /^# files:$/m);
  assert.ok(!/^files:$/m.test(rule), 'no active `files:` key, which would silently govern nothing');
  // The three ignores that *are* universal do ship.
  for (const glob of ['**/*.d.ts', '**/dist/**', '**/node_modules/**']) {
    assert.ok(rule.includes(glob), `ships the universal ignore ${glob}`);
  }
  assert.match(rule, /^language: TypeScript$/m); // D10
});

// ---------------------------------------------------------------- D4, the capability flag

test('--fixture-only writes just the fixture, for a repo whose own scaffolder wrote the rule', () => {
  // gantry's `pnpm scaffold:ast-grep-rule` writes one file and no fixture, so the id is
  // already in the inventory by the time this runs — which must not read as a collision.
  const root = make_repo({
    config: '{"scaffold_command": "pnpm scaffold:ast-grep-rule"}',
    files: { 'rules/no-simple-git.yml': 'id: no-simple-git\nlanguage: TypeScript\nrule:\n  pattern: x\n' },
  });
  const s = scaffold_rule(root, 'no-simple-git', 'fixture');

  assert.equal(s.mode, 'scaffolded');
  assert.deepEqual(s.written, ['tests/no-simple-git-test.yml']);
  assert.deepEqual(s.skipped, ['rules/no-simple-git.yml']);
  assert.equal(s.scaffold_command, 'pnpm scaffold:ast-grep-rule');
  // The repo's own rule file is left exactly as its scaffolder wrote it.
  assert.equal(read(root, 'rules/no-simple-git.yml'), 'id: no-simple-git\nlanguage: TypeScript\nrule:\n  pattern: x\n');
});

test('--rule-only writes just the rule, for a fixture that already exists', () => {
  const root = make_repo({ files: { 'tests/no-throw-in-step-test.yml': 'id: no-throw-in-step\nvalid: []\n' } });
  const s = scaffold_rule(root, 'no-throw-in-step', 'rule');

  assert.deepEqual(s.written, ['rules/no-throw-in-step.yml']);
  assert.deepEqual(s.skipped, ['tests/no-throw-in-step-test.yml']);
  assert.equal(read(root, 'tests/no-throw-in-step-test.yml'), 'id: no-throw-in-step\nvalid: []\n');
});

// ---------------------------------------------------------------- refusals

test('refuses an id that is already enforced, naming the file that holds it', () => {
  // Read-only: the refusal lands before any write, so this runs against the committed
  // corpus — whose match sits in a nested subdir, proving the inventory recursed.
  const s = scaffold_rule(fixture('scan-corpus'), 'no-default-export');

  assert.equal(s.mode, 'error');
  assert.equal(s.error_type, 'exists');
  assert.match(s.message, /rules\/style\/no-default-export\.yml/);
  assert.match(s.message, /stacking a second one/);
});

test('refuses to overwrite a rule file already on disk', () => {
  const root = make_repo({ files: { 'rules/no-require.yml': '# hand-written\n' } });
  const s = scaffold_rule(root, 'no-require');

  assert.equal(s.error_type, 'exists');
  assert.match(s.message, /rules\/no-require\.yml already exists/);
  assert.equal(read(root, 'rules/no-require.yml'), '# hand-written\n');
});

test('refuses to overwrite an existing fixture, and writes no rule alongside it', () => {
  const root = make_repo({ files: { 'tests/no-require-test.yml': '# hand-written\n' } });
  const s = scaffold_rule(root, 'no-require');

  assert.equal(s.error_type, 'exists');
  assert.match(s.message, /tests\/no-require-test\.yml already exists/);
  assert.ok(!existsSync(join(root, 'rules/no-require.yml')), 'the refusal is atomic — no half-written pair');
});

test('refuses an sgconfig with no testConfigs — a rule with nowhere to test is not done', () => {
  const s = scaffold_rule(fixture('bare-layout'), 'no-untyped-json-parse');

  assert.equal(s.mode, 'error');
  assert.equal(s.error_type, 'no-tests-dir');
  assert.match(s.message, /testConfigs/);
  assert.match(s.message, /ast-grep-rules:init/);
});

test('--rule-only still works in a repo with no tests dir', () => {
  // The refusal is about the fixture, so a run that is not writing one is unaffected.
  const root = make_repo({ sgconfig: 'ruleDirs: [rules]\n' });
  const s = scaffold_rule(root, 'no-extends-inheritance', 'rule');

  assert.equal(s.mode, 'scaffolded');
  assert.equal(s.test_path, null);
  assert.deepEqual(s.written, ['rules/no-extends-inheritance.yml']);
  assert.deepEqual(s.skipped, []);
  assert.match(s.warnings.join('\n'), /declares no `testConfigs`/);
});

for (const [id, why] of [
  ['NoDefaultExport', 'PascalCase'],
  ['no_default_export', 'snake_case'],
  ['no--default', 'a doubled hyphen'],
  ['-no-default', 'a leading hyphen'],
  ['no-default-', 'a trailing hyphen'],
]) {
  test(`refuses \`${id}\` — ${why} is not a kebab-case rule id`, () => {
    const s = scaffold_rule(make_repo(), id);

    assert.equal(s.error_type, 'usage');
    assert.match(s.message, /kebab-case/);
  });
}

test('refuses a missing id before it looks at the repo at all', () => {
  const s = scaffold_rule(fixture('no-config'), null);

  assert.equal(s.error_type, 'usage');
  assert.match(s.message, /a rule id is required/);
});

// ---------------------------------------------------------------- resolver passthrough

test('an unconfigured repo returns the resolver error unchanged', () => {
  const s = scaffold_rule(fixture('no-config'), 'no-console-in-packages');

  assert.equal(s.mode, 'error');
  assert.equal(s.error_type, 'config');
  assert.match(s.message, /ast-grep-rules:init/);
});

test('a missing sgconfig returns the resolver error unchanged', () => {
  const s = scaffold_rule(fixture('no-sgconfig'), 'no-console-in-packages');

  assert.equal(s.mode, 'error');
  assert.equal(s.error_type, 'sgconfig');
});

// ---------------------------------------------------------------- cli

const run = (args) => JSON.parse(execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8' }));

test('cli: scaffolds and prints one JSON object', () => {
  const root = make_repo();
  const s = run(['no-class-declaration', '--root', root]);

  assert.equal(s.mode, 'scaffolded');
  assert.deepEqual(s.written, ['rules/no-class-declaration.yml', 'tests/no-class-declaration-test.yml']);
  assert.equal(s.next.length, 5);
  assert.match(s.next.join('\n'), /pnpm exec ast-grep test/);
  // A fixture with `invalid:` cases fails until its snapshot exists, so the -U pass is
  // part of finishing the rule rather than an optional extra.
  assert.match(s.next.join('\n'), /pnpm exec ast-grep test -U/);
});

test('cli: rejects an unknown flag and the two mutually exclusive ones', () => {
  const root = make_repo();

  assert.equal(run(['no-x', '--root', root, '--both']).error_type, 'usage');
  const both = run(['no-x', '--root', root, '--fixture-only', '--rule-only']);
  assert.equal(both.error_type, 'usage');
  assert.match(both.message, /mutually exclusive/);
});

test('cli: takes one rule id at a time', () => {
  const s = run(['no-x', 'no-y', '--root', make_repo()]);

  assert.equal(s.error_type, 'usage');
  assert.match(s.message, /one rule id at a time/);
});
