// Tests for the starter-tier installer — the opt-in bundled rules (D5, D14, D22).
//
// Two things are under test here and they fail in different places. The *installer* is
// ordinary code: given a repo, does it land the right files at the sgconfig-resolved
// paths, and does it refuse cleanly when it should. The *tiers themselves* are data
// this repo ships, so their invariants — every rule has a fixture and a snapshot, every
// id matches its filename, every note documents the suppression form that actually
// works — are asserted here too. A packaging mistake should fail `scripts/check.sh`,
// not somebody's install.
//
// What this suite deliberately does not do is run `ast-grep test`. The binary is a
// per-repo devDependency and is never on PATH (C4), so asserting green fixtures here
// would make the suite pass on this machine and nowhere else. That check belongs to
// `scripts/scratch-repo.sh`, which installs the CLI itself (C7).
//
// Writes go to throwaway repos under the OS temp dir, removed when the suite ends.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { glob_prefix, install_tiers, list_tiers, read_rule_meta } from '../install-starter.mjs';

const cli = fileURLToPath(new URL('../install-starter.mjs', import.meta.url));
const tiers_dir = fileURLToPath(new URL('../../starter-rules/', import.meta.url));

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

const listing = (root) => {
  const found = [];
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(join(dir, entry.name), rel);
      else found.push(rel);
    }
  };
  walk('.', '');
  return found.sort();
};

after(() => {
  for (const root of temps) rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- the tiers as data

test('ships exactly the two tiers D14 fixed, with the rules D14 assigned to each', () => {
  const tiers = list_tiers();
  assert.deepEqual(tiers.map((t) => t.name), ['functional-style', 'hygiene']);

  const by_name = Object.fromEntries(tiers.map((t) => [t.name, t.rules.map((r) => r.id).sort()]));
  assert.deepEqual(by_name.hygiene, [
    'no-console-in-packages',
    'no-cross-package-relative-import',
    'no-untyped-json-parse',
  ]);
  assert.deepEqual(by_name['functional-style'], [
    'no-class-declaration',
    'no-default-export',
    'no-extends-inheritance',
    'no-this-keyword',
  ]);
});

test('every tier carries the prose the offer is made from', () => {
  for (const tier of list_tiers()) {
    for (const key of ['title', 'summary', 'description', 'adopt_when', 'decline_when']) {
      assert.equal(typeof tier[key], 'string', `${tier.name}.${key}`);
      assert.ok(tier[key].length > 0, `${tier.name}.${key} is empty`);
    }
  }
});

test('every bundled rule ships a fixture and a recorded snapshot', () => {
  // The done-when's first clause, asserted against the files rather than the report:
  // `ast-grep test` is red with `No <id> baseline found` for any fixture that has
  // `invalid:` cases and no snapshot, so a tier missing one installs a red repo.
  for (const tier of list_tiers()) {
    for (const rule of tier.rules) {
      for (const rel of [
        `${tier.name}/rules/${rule.id}.yml`,
        `${tier.name}/tests/${rule.id}-test.yml`,
        `${tier.name}/tests/__snapshots__/${rule.id}-snapshot.yml`,
      ]) {
        assert.ok(existsSync(join(tiers_dir, rel)), `missing ${rel}`);
      }
    }
  }
});

test('every bundled fixture pins both halves and matches its rule id', () => {
  for (const tier of list_tiers()) {
    for (const rule of tier.rules) {
      const text = readFileSync(join(tiers_dir, tier.name, 'tests', `${rule.id}-test.yml`), 'utf8');
      assert.match(text, new RegExp(`^id: ${rule.id}$`, 'm'), `${rule.id} fixture id`);
      // `valid:` is the half that catches an over-broad rule and the half everyone
      // under-writes, so a bundled fixture without one is not a fixture.
      assert.match(text, /^valid:$/m, `${rule.id} has no valid: cases`);
      assert.match(text, /^invalid:$/m, `${rule.id} has no invalid: cases`);
    }
  }
});

test('every bundled note documents the suppression form that works, and none the broken one', () => {
  // D22: foundry's bf33067 corrected the suppression syntax to a trailing
  // `// ast-grep-ignore: <id>`. Three of the four source repos still document
  // `ast-grep-ignore-next-line`, which does not work — shipping that text in a starter
  // tier would propagate the bug by hand into every repo that adopts one.
  for (const tier of list_tiers()) {
    for (const rule of tier.rules) {
      const text = readFileSync(join(tiers_dir, tier.name, 'rules', `${rule.id}.yml`), 'utf8');
      assert.ok(
        text.includes(`// ast-grep-ignore: ${rule.id}`),
        `${rule.id} does not show its own trailing-comment suppression form`,
      );
      assert.ok(
        !/^\s*(?:\/\/\s*)?ast-grep-ignore-next-line\b/m.test(text.replace(/`ast-grep-ignore-next-line`/g, '')),
        `${rule.id} documents the ast-grep-ignore-next-line form, which does not work`,
      );
    }
  }
});

test('only the rule whose claim is inherently path-scoped carries files:', () => {
  // A `files:` glob is the quietest way a rule ends up governing nothing, so the tiers
  // ship without one wherever the claim is repo-wide. `no-console-in-packages` is the
  // exception on purpose: "libraries must not log" is a statement about a directory.
  const scoped = list_tiers()
    .flatMap((t) => t.rules)
    .filter((r) => r.path_scoped)
    .map((r) => r.id);
  assert.deepEqual(scoped, ['no-console-in-packages']);
});

// ---------------------------------------------------------------- installing

test('installs one tier at the sgconfig-resolved paths, three files per rule', () => {
  const root = make_repo();
  const r = install_tiers(root, ['hygiene']);

  assert.equal(r.mode, 'installed');
  assert.deepEqual(r.tiers, ['hygiene']);
  assert.deepEqual(r.rules.map((x) => x.id).sort(), [
    'no-console-in-packages',
    'no-cross-package-relative-import',
    'no-untyped-json-parse',
  ]);
  assert.deepEqual(r.written.sort(), [
    'rules/no-console-in-packages.yml',
    'rules/no-cross-package-relative-import.yml',
    'rules/no-untyped-json-parse.yml',
    'tests/__snapshots__/no-console-in-packages-snapshot.yml',
    'tests/__snapshots__/no-cross-package-relative-import-snapshot.yml',
    'tests/__snapshots__/no-untyped-json-parse-snapshot.yml',
    'tests/no-console-in-packages-test.yml',
    'tests/no-cross-package-relative-import-test.yml',
    'tests/no-untyped-json-parse-test.yml',
  ]);
  assert.deepEqual(r.skipped, []);
  for (const rel of r.written) assert.ok(existsSync(join(root, rel)), `not on disk: ${rel}`);
});

test('installing one tier leaves the other tier entirely unwritten', () => {
  // "Each tier installs independently" — the point of two tiers is that adopting the
  // defensible one does not drag a house style in with it.
  const root = make_repo();
  install_tiers(root, ['hygiene']);

  for (const id of ['no-class-declaration', 'no-this-keyword', 'no-extends-inheritance', 'no-default-export']) {
    assert.ok(!existsSync(join(root, `rules/${id}.yml`)), `functional-style leaked: ${id}`);
  }
});

test('installs both tiers in one run without duplicating a rule', () => {
  const root = make_repo();
  const r = install_tiers(root, ['hygiene', 'functional-style', 'hygiene']);

  assert.equal(r.mode, 'installed');
  assert.deepEqual(r.tiers, ['hygiene', 'functional-style']);
  assert.equal(r.rules.length, 7);
  assert.equal(r.written.length, 21);
  assert.equal(new Set(r.written).size, 21);
});

test('the installed bytes are the bundled bytes', () => {
  const root = make_repo();
  install_tiers(root, ['functional-style']);

  for (const id of ['no-class-declaration', 'no-this-keyword', 'no-extends-inheritance', 'no-default-export']) {
    assert.equal(
      readFileSync(join(root, `rules/${id}.yml`), 'utf8'),
      readFileSync(join(tiers_dir, 'functional-style', 'rules', `${id}.yml`), 'utf8'),
      `${id} rule differs from the bundled copy`,
    );
    assert.equal(
      readFileSync(join(root, `tests/__snapshots__/${id}-snapshot.yml`), 'utf8'),
      readFileSync(join(tiers_dir, 'functional-style', 'tests', '__snapshots__', `${id}-snapshot.yml`), 'utf8'),
      `${id} snapshot differs from the bundled copy`,
    );
  }
});

test('honors a repo whose sgconfig puts rules and tests somewhere else', () => {
  const root = make_repo({
    sgconfig: `ruleDirs:
  - tools/ast-grep/rules

testConfigs:
  - testDir: tools/ast-grep/tests
    snapshotDir: snaps
`,
    dirs: ['tools/ast-grep/rules', 'tools/ast-grep/tests'],
  });
  const r = install_tiers(root, ['hygiene']);

  assert.equal(r.mode, 'installed');
  assert.ok(r.written.includes('tools/ast-grep/rules/no-untyped-json-parse.yml'));
  assert.ok(r.written.includes('tools/ast-grep/tests/no-untyped-json-parse-test.yml'));
  assert.ok(r.written.includes('tools/ast-grep/tests/snaps/no-untyped-json-parse-snapshot.yml'));
  assert.ok(r.created_dirs.includes('tools/ast-grep/tests/snaps'));
});

// ---------------------------------------------------------------- reporting

test('reports a path-scoped rule whose directory this repo does not have', () => {
  const root = make_repo();
  const r = install_tiers(root, ['hygiene']);

  const scoped = r.path_scoped.find((s) => s.id === 'no-console-in-packages');
  assert.deepEqual(scoped.files, ['packages/**/*.ts']);
  assert.deepEqual(scoped.missing_prefixes, ['packages']);
  assert.ok(
    r.next.some((n) => n.includes('governs nothing')),
    'the report does not tell the adopter the rule currently governs nothing',
  );
});

test('stays quiet about a path-scoped rule whose directory exists', () => {
  const root = make_repo({ dirs: ['rules', 'tests', 'packages'] });
  const r = install_tiers(root, ['hygiene']);

  const scoped = r.path_scoped.find((s) => s.id === 'no-console-in-packages');
  assert.deepEqual(scoped.missing_prefixes, []);
  assert.ok(!r.next.some((n) => n.includes('governs nothing')));
});

test('points the next steps at the repo\'s own ast-grep command, never a bare binary', () => {
  const root = make_repo({ config: '{"ast_grep_command": "npx --no-install ast-grep"}' });
  const r = install_tiers(root, ['functional-style']);

  assert.equal(r.ast_grep_command, 'npx --no-install ast-grep');
  assert.ok(r.next.some((n) => n.includes('npx --no-install ast-grep test')));
  assert.ok(!r.next.some((n) => /(?<!exec |install )\bast-grep test\b/.test(n)));
});

// ---------------------------------------------------------------- refusals

test('declining writes nothing: no tier named is a listing, not an install', () => {
  const root = make_repo();
  const before = listing(root);

  const out = JSON.parse(execFileSync('node', [cli, '--root', root], { encoding: 'utf8' }));
  assert.equal(out.mode, 'tiers');
  assert.equal(out.tiers.length, 2);
  assert.deepEqual(listing(root), before);
});

test('declining both tiers leaves zero rule files written', () => {
  // The done-when's last clause, from the outside: the CLI with no `--tier`, and the
  // CLI with `--list`, both leave the repo byte-identical.
  const root = make_repo();
  const before = listing(root);

  execFileSync('node', [cli, '--list', '--root', root], { encoding: 'utf8' });
  assert.deepEqual(listing(root), before);
  assert.deepEqual(readdirSync(join(root, 'rules')), []);
  assert.deepEqual(readdirSync(join(root, 'tests')), []);
});

test('refuses the whole tier when one of its rules is already enforced', () => {
  const root = make_repo({
    files: { 'rules/house/no-untyped-json-parse.yml': 'id: no-untyped-json-parse\nlanguage: TypeScript\nrule:\n  pattern: JSON.parse($A)\n' },
  });
  const r = install_tiers(root, ['hygiene']);

  assert.equal(r.mode, 'error');
  assert.equal(r.error_type, 'exists');
  assert.match(r.message, /no-untyped-json-parse — already at rules\/house\/no-untyped-json-parse\.yml/);
  assert.match(r.message, /--skip-existing/);
  // Atomic: the two rules that *could* have landed did not.
  assert.ok(!existsSync(join(root, 'rules/no-console-in-packages.yml')));
  assert.ok(!existsSync(join(root, 'rules/no-cross-package-relative-import.yml')));
});

test('--skip-existing installs the rest of the tier around the local rule', () => {
  const root = make_repo({
    files: { 'rules/no-untyped-json-parse.yml': 'id: no-untyped-json-parse\nlanguage: TypeScript\nrule:\n  pattern: JSON.parse($A)\n' },
  });
  const local = readFileSync(join(root, 'rules/no-untyped-json-parse.yml'), 'utf8');
  const r = install_tiers(root, ['hygiene'], { skip_existing: true });

  assert.equal(r.mode, 'installed');
  assert.deepEqual(r.rules.map((x) => x.id).sort(), ['no-console-in-packages', 'no-cross-package-relative-import']);
  assert.deepEqual(r.skipped, [{ id: 'no-untyped-json-parse', tier: 'hygiene', reason: 'already present', at: 'rules/no-untyped-json-parse.yml' }]);
  // The local rule is the tuned one — it survives untouched.
  assert.equal(readFileSync(join(root, 'rules/no-untyped-json-parse.yml'), 'utf8'), local);
  assert.ok(r.next.some((n) => n.includes('no-untyped-json-parse')));
});

test('refuses a re-install rather than overwriting what it wrote last time', () => {
  const root = make_repo();
  assert.equal(install_tiers(root, ['hygiene']).mode, 'installed');

  const again = install_tiers(root, ['hygiene']);
  assert.equal(again.mode, 'error');
  assert.equal(again.error_type, 'exists');

  const skipped = install_tiers(root, ['hygiene'], { skip_existing: true });
  assert.equal(skipped.mode, 'error');
  assert.equal(skipped.error_type, 'exists');
  assert.match(skipped.message, /nothing left to install/);
});

test('refuses when sgconfig declares no testConfigs, before writing any rule', () => {
  // D3 has nowhere to land, and a tier that dropped its fixtures on the way in would
  // install rules that can never be verified.
  const root = make_repo({ sgconfig: 'ruleDirs:\n  - rules\n', dirs: ['rules'] });
  const r = install_tiers(root, ['functional-style']);

  assert.equal(r.mode, 'error');
  assert.equal(r.error_type, 'no-tests-dir');
  assert.match(r.message, /testConfigs/);
  assert.deepEqual(readdirSync(join(root, 'rules')), []);
});

test('refuses an unknown tier by name, listing the ones that exist', () => {
  const root = make_repo();
  const r = install_tiers(root, ['security']);

  assert.equal(r.mode, 'error');
  assert.equal(r.error_type, 'usage');
  assert.match(r.message, /unknown tier: security/);
  assert.match(r.message, /functional-style and hygiene/);
  assert.deepEqual(readdirSync(join(root, 'rules')), []);
});

test('passes a resolver error straight through', () => {
  const root = mkdtempSync(join(tmpdir(), 'ast-grep-rules-'));
  temps.push(root);
  const r = install_tiers(root, ['hygiene']);

  assert.equal(r.mode, 'error');
  assert.equal(r.error_type, 'config');
});

// ---------------------------------------------------------------- cli surface

test('the CLI emits one JSON object and exits 0, including on a refusal', () => {
  const root = make_repo();
  const out = JSON.parse(execFileSync('node', [cli, '--tier', 'hygiene', '--root', root], { encoding: 'utf8' }));
  assert.equal(out.mode, 'installed');

  const again = JSON.parse(execFileSync('node', [cli, '--tier', 'hygiene', '--root', root], { encoding: 'utf8' }));
  assert.equal(again.mode, 'error');
  assert.equal(again.error_type, 'exists');
});

test('the CLI rejects a malformed invocation instead of guessing', () => {
  for (const args of [['--tier'], ['--tier', 'hygiene', '--list'], ['--root'], ['--wat']]) {
    const out = JSON.parse(execFileSync('node', [cli, ...args], { encoding: 'utf8' }));
    assert.equal(out.mode, 'error', args.join(' '));
    assert.equal(out.error_type, 'usage', args.join(' '));
  }
});

// ---------------------------------------------------------------- helpers

test('read_rule_meta reads id, severity and files, and stops at the next key', () => {
  const meta = read_rule_meta(`id: no-console-in-packages
language: TypeScript
severity: error
message: "Libraries must not log: use a logger."
note: |
  A block scalar whose body is indented.
  files:
    - "this line is prose, not a key"

rule:
  any:
    - pattern: console.log($$$A)

files:
  - "packages/**/*.ts"
  - 'apps/**/*.ts'

ignores:
  - "**/dist/**"
`);

  assert.equal(meta.id, 'no-console-in-packages');
  assert.equal(meta.severity, 'error');
  assert.deepEqual(meta.files, ['packages/**/*.ts', 'apps/**/*.ts']);
});

test('read_rule_meta returns no files for a rule that declares none', () => {
  const meta = read_rule_meta('id: no-class-declaration\nseverity: error\nrule:\n  kind: class_declaration\n\nignores:\n  - "**/dist/**"\n');
  assert.deepEqual(meta.files, []);
  assert.equal(meta.severity, 'error');
});

test('glob_prefix finds the directory a glob is anchored to, or nothing', () => {
  assert.equal(glob_prefix('packages/**/*.ts'), 'packages');
  assert.equal(glob_prefix('apps/web/src/**/*.ts'), 'apps/web/src');
  assert.equal(glob_prefix('**/*.config.ts'), null);
  assert.equal(glob_prefix('*.ts'), null);
  // No metacharacter at all: the last segment is a filename, not a directory.
  assert.equal(glob_prefix('src/lib/index.ts'), 'src/lib');
  assert.equal(glob_prefix('index.ts'), null);
});
