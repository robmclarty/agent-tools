// Tests for the cookbook installer — the opt-in worked examples (D5, D14, D23).
//
// Two things are under test here and they fail in different places. The *installer* is
// ordinary code: given a repo, does it land the right files at the sgconfig-resolved
// paths, and does it refuse cleanly when it should.
//
// The *examples themselves* are data this repo ships, and D23 governs them: bundled
// content may teach form and must never ship policy the adopter is expected to accept.
// That is a claim about prose, which is exactly the kind of claim that rots quietly, so
// it is asserted here rather than trusted:
//
//   * every example names the technique it teaches (`demonstrates:`) *and* the policy it
//     would impose (`encodes:`), so no rule can arrive looking policy-free;
//   * the technique each one claims is checked against the rule body, not against the
//     prose — a `demonstrates:` line saying `inside:` fails unless the rule uses it;
//   * the six required techniques are covered by six distinct examples, so the set stays
//     a cookbook rather than becoming a ruleset with six entries;
//   * the bundled prose carries no recommendation vocabulary, and nothing ships at
//     `severity: error` — an example has not earned the right to fail anyone's build;
//   * there is no flag that installs more than the user named.
//
// Together those are the mechanical half of "a reader who rejects every policy in the
// set can still learn each technique from it."
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
import { dirname, isAbsolute, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { example_ids, glob_prefix, install_examples, list_examples, read_labelled, read_rule_meta } from '../install-starter.mjs';

const cli = fileURLToPath(new URL('../install-starter.mjs', import.meta.url));
const examples_dir = fileURLToPath(new URL('../../examples/', import.meta.url));
const plugin_dir = fileURLToPath(new URL('../../', import.meta.url));

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

const rule_text = (id) => readFileSync(join(examples_dir, 'rules', `${id}.yml`), 'utf8');

after(() => {
  for (const root of temps) rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- the cookbook as data

test('ships exactly the six worked examples D14 fixed, and no tier directories', () => {
  assert.deepEqual(example_ids(), [
    'no-async-array-callback',
    'no-console-in-packages',
    'no-enum-declaration',
    'no-focused-or-skipped-test',
    'no-promise-then',
    'no-unlinked-todo',
  ]);
  // D14 was revised twice; the two superseded tier designs must not survive as files
  // that `--list` no longer mentions but an adopter could still find and copy.
  assert.ok(!existsSync(join(plugin_dir, 'starter-rules')), 'the starter-rules tiers are still on disk');
});

test('every example ships a fixture and a recorded snapshot', () => {
  // `ast-grep test` is red with `No <id> baseline found` for any fixture that has
  // `invalid:` cases and no snapshot, so an example missing one installs a red repo.
  for (const id of example_ids()) {
    for (const rel of [`rules/${id}.yml`, `tests/${id}-test.yml`, `tests/__snapshots__/${id}-snapshot.yml`]) {
      assert.ok(existsSync(join(examples_dir, rel)), `missing ${rel}`);
    }
  }
});

test('every example names both the technique it teaches and the policy it would impose', () => {
  // The D23 line, at its narrowest: a bundled rule that arrived without an `encodes:`
  // line would be policy presented as technique.
  for (const example of list_examples()) {
    for (const label of ['demonstrates', 'encodes']) {
      assert.equal(typeof example[label], 'string', `${example.id}.${label}`);
      assert.ok(example[label].length > 40, `${example.id}.${label} is too short to say anything: ${example[label]}`);
    }
  }
});

test('each required technique is claimed by one example and actually used by its rule', () => {
  // The coverage check, asserted against the rule *body* rather than the prose — a
  // `demonstrates:` line is a claim, and this is what makes it a checked one. The keys
  // come from `read_rule_meta().uses`, which reads from `rule:` down and never over
  // the note, so an example cannot pass by explaining a construct it does not use.
  const REQUIRED = [
    ['no-enum-declaration', '`kind:`', ['kind:']],
    ['no-promise-then', '`pattern:` with metavariables', ['pattern:']],
    ['no-focused-or-skipped-test', '`constraints:`', ['constraints:', 'regex:']],
    ['no-unlinked-todo', 'a composite rule', ['all:', 'regex:', 'not:']],
    ['no-async-array-callback', 'relational rules', ['inside:', 'has:', 'stopBy: end']],
    ['no-console-in-packages', '`files:`', ['files:']],
  ];

  const by_id = Object.fromEntries(list_examples().map((e) => [e.id, e]));
  assert.deepEqual(REQUIRED.map(([id]) => id).sort(), example_ids(), 'the required techniques and the shipped examples have drifted apart');

  for (const [id, claim, constructs] of REQUIRED) {
    const example = by_id[id];
    assert.ok(
      example.demonstrates.startsWith(claim),
      `${id} claims to demonstrate something else: ${example.demonstrates.slice(0, 60)}`,
    );
    for (const construct of constructs) {
      assert.ok(example.uses.includes(construct), `${id} claims ${claim} but its rule body never uses ${construct} (uses: ${example.uses.join(', ')})`);
    }
  }
});

test('the metavariable and composite examples stay minimal enough to read', () => {
  // Every rule body uses *some* technique, so an example only teaches the one it
  // claims if it does not quietly drag three others along. The two that exist to
  // isolate a single construct are pinned to it.
  const by_id = Object.fromEntries(list_examples().map((e) => [e.id, e]));
  assert.deepEqual(by_id['no-enum-declaration'].uses, ['kind:']);
  assert.deepEqual(by_id['no-promise-then'].uses, ['pattern:']);
});

test('no bundled prose recommends itself, and nothing ships at error severity', () => {
  // D23's other half. "Adapt, don't adopt" survives only while the text stays
  // descriptive: the moment a note says `recommended`, the example is a default with
  // extra steps. `severity: warning` is the same claim in the one field an adopter's
  // CI actually reads.
  const BANNED = [
    /\brecommended\b/i,
    /\bwe recommend\b/i,
    /\bbest practice/i,
    /\bsensible default/i,
    /\bsane default/i,
    /\bstarter (pack|tier|ruleset)/i,
    /\bout of the box\b/i,
  ];

  for (const id of example_ids()) {
    const text = rule_text(id);
    for (const banned of BANNED) {
      assert.ok(!banned.test(text), `${id} recommends itself: ${banned}`);
    }
    assert.equal(read_rule_meta(text).severity, 'warning', `${id} ships at a severity that fails a build`);
  }
});

test('every bundled fixture pins both halves and matches its rule id', () => {
  for (const id of example_ids()) {
    const text = readFileSync(join(examples_dir, 'tests', `${id}-test.yml`), 'utf8');
    assert.match(text, new RegExp(`^id: ${id}$`, 'm'), `${id} fixture id`);
    // `valid:` is the half that catches an over-broad rule and the half everyone
    // under-writes, so a bundled fixture without one is not a fixture.
    assert.match(text, /^valid:$/m, `${id} has no valid: cases`);
    assert.match(text, /^invalid:$/m, `${id} has no invalid: cases`);
  }
});

test('every bundled note shows its own suppression form', () => {
  // The suppression syntax is knowledge the portfolio keeps losing — 130 rules across
  // 20 repos and not one of the live ones mentions it (D22). An example that teaches a
  // technique and leaves the reader unable to grant an exception has taught half.
  for (const id of example_ids()) {
    assert.ok(
      rule_text(id).includes(`// ast-grep-ignore: ${id}`),
      `${id} does not show its own trailing-comment suppression form`,
    );
  }
});

test('only the example whose subject is scoping carries files:', () => {
  // A `files:` glob is the quietest way a rule ends up governing nothing, so an
  // example ships one only when the glob is the thing being taught.
  const scoped = list_examples().filter((e) => e.path_scoped).map((e) => e.id);
  assert.deepEqual(scoped, ['no-console-in-packages']);
});

// ---------------------------------------------------------------- installing

test('installs one named example at the sgconfig-resolved paths, three files', () => {
  const root = make_repo();
  const r = install_examples(root, ['no-enum-declaration']);

  assert.equal(r.mode, 'installed');
  assert.deepEqual(r.examples.map((x) => x.id), ['no-enum-declaration']);
  assert.deepEqual(r.written.sort(), [
    'rules/no-enum-declaration.yml',
    'tests/__snapshots__/no-enum-declaration-snapshot.yml',
    'tests/no-enum-declaration-test.yml',
  ]);
  assert.deepEqual(r.skipped, []);
  for (const rel of r.written) assert.ok(existsSync(join(root, rel)), `not on disk: ${rel}`);
});

test('installing one example leaves the other five entirely unwritten', () => {
  // "Installs only an example the user names" — the whole difference between a
  // cookbook and a tier is that nothing rides along.
  const root = make_repo();
  install_examples(root, ['no-enum-declaration']);

  for (const id of example_ids().filter((x) => x !== 'no-enum-declaration')) {
    assert.ok(!existsSync(join(root, `rules/${id}.yml`)), `${id} rode along uninvited`);
  }
  assert.deepEqual(readdirSync(join(root, 'rules')), ['no-enum-declaration.yml']);
});

test('installs two named examples in one run without duplicating either', () => {
  const root = make_repo();
  const r = install_examples(root, ['no-promise-then', 'no-unlinked-todo', 'no-promise-then']);

  assert.equal(r.mode, 'installed');
  assert.deepEqual(r.examples.map((x) => x.id), ['no-promise-then', 'no-unlinked-todo']);
  assert.equal(r.written.length, 6);
  assert.equal(new Set(r.written).size, 6);
});

test('the installed bytes are the bundled bytes, labels and all', () => {
  // The `encodes:` line has to survive the copy: a rule that arrives in the adopter's
  // repo stripped of the line naming its policy is the payload D23 refuses.
  const root = make_repo();
  install_examples(root, ['no-async-array-callback']);

  const installed = readFileSync(join(root, 'rules/no-async-array-callback.yml'), 'utf8');
  assert.equal(installed, rule_text('no-async-array-callback'));
  assert.ok(installed.includes('**encodes:**'));
  assert.equal(
    readFileSync(join(root, 'tests/__snapshots__/no-async-array-callback-snapshot.yml'), 'utf8'),
    readFileSync(join(examples_dir, 'tests', '__snapshots__', 'no-async-array-callback-snapshot.yml'), 'utf8'),
  );
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
  const r = install_examples(root, ['no-promise-then']);

  assert.equal(r.mode, 'installed');
  assert.deepEqual(r.written.sort(), [
    'tools/ast-grep/rules/no-promise-then.yml',
    'tools/ast-grep/tests/no-promise-then-test.yml',
    'tools/ast-grep/tests/snaps/no-promise-then-snapshot.yml',
  ]);
  assert.ok(r.created_dirs.includes('tools/ast-grep/tests/snaps'));
});

// ---------------------------------------------------------------- reporting

test('the report leads with adapting the policy, not with running the rule', () => {
  // *Adapt, don't adopt.* An install that opened with "run scan" would be handing over
  // a rule to enforce; the first thing it hands over is the decision.
  const root = make_repo();
  const r = install_examples(root, ['no-promise-then']);

  assert.match(r.next[0], /\*\*encodes:\*\*/);
  assert.match(r.next[0], /decide whether you agree/);
  assert.equal(r.examples[0].encodes, list_examples().find((e) => e.id === 'no-promise-then').encodes);
});

test('reports a path-scoped example whose directory this repo does not have', () => {
  const root = make_repo();
  const r = install_examples(root, ['no-console-in-packages']);

  const scoped = r.path_scoped.find((s) => s.id === 'no-console-in-packages');
  assert.deepEqual(scoped.files, ['packages/**/*.ts']);
  assert.deepEqual(scoped.missing_prefixes, ['packages']);
  assert.ok(
    r.next.some((n) => n.includes('governs nothing')),
    'the report does not tell the adopter the rule currently governs nothing',
  );
});

test('stays quiet about a path-scoped example whose directory exists', () => {
  const root = make_repo({ dirs: ['rules', 'tests', 'packages'] });
  const r = install_examples(root, ['no-console-in-packages']);

  assert.deepEqual(r.path_scoped[0].missing_prefixes, []);
  assert.ok(!r.next.some((n) => n.includes('governs nothing')));
});

test('points the next steps at the repo\'s own ast-grep command, never a bare binary', () => {
  const root = make_repo({ config: '{"ast_grep_command": "npx --no-install ast-grep"}' });
  const r = install_examples(root, ['no-enum-declaration']);

  assert.equal(r.ast_grep_command, 'npx --no-install ast-grep');
  assert.ok(r.next.some((n) => n.includes('npx --no-install ast-grep test')));
  assert.ok(!r.next.some((n) => /(?<!exec |install )\bast-grep test\b/.test(n)));
});

// ---------------------------------------------------------------- refusals

test('declining writes nothing: no example named is a listing, not an install', () => {
  const root = make_repo();
  const before = listing(root);

  const out = JSON.parse(execFileSync('node', [cli, '--root', root], { encoding: 'utf8' }));
  assert.equal(out.mode, 'examples');
  assert.equal(out.examples.length, 6);
  assert.deepEqual(listing(root), before);
});

test('the catalogue is fully legible without installing anything', () => {
  // D23 in the shape a reader meets it: both labels and the construct list come back
  // from the no-write path, so learning the six techniques never costs a rule file.
  const root = make_repo();
  const before = listing(root);

  const out = JSON.parse(execFileSync('node', [cli, '--list', '--root', root], { encoding: 'utf8' }));
  for (const example of out.examples) {
    assert.ok(example.demonstrates && example.encodes && example.uses.length > 0, example.id);
  }
  assert.deepEqual(listing(root), before);
  assert.deepEqual(readdirSync(join(root, 'rules')), []);
  assert.deepEqual(readdirSync(join(root, 'tests')), []);
});

test('the catalogue carries a readable path to each example rule and fixture', () => {
  // `/rule` and `/audit` cite the cookbook by opening these two files. Handing them the
  // paths is what lets both SKILLs stop spelling out the bundled layout in prose, where
  // six copies of it drift the first time a directory moves.
  const out = JSON.parse(execFileSync('node', [cli, '--list'], { encoding: 'utf8' }));

  for (const example of out.examples) {
    assert.equal(example.path.rule, join(examples_dir, 'rules', `${example.id}.yml`));
    assert.equal(example.path.test, join(examples_dir, 'tests', `${example.id}-test.yml`));
    // Absolute, because the citation is a Read from a session whose cwd is the
    // adopter's repo, not this plugin.
    for (const path of Object.values(example.path)) {
      assert.ok(isAbsolute(path), `${example.id}: ${path}`);
      assert.ok(existsSync(path), `${example.id}: ${path}`);
    }
  }
});

test('there is no flag that installs more than the user named', () => {
  // The cookbook has no `--all` on purpose, and "no default" is only true while that
  // stays true. Anything that looks like a bulk install is a usage error, not a
  // convenience.
  const root = make_repo();
  for (const args of [['--all'], ['--tier', 'hygiene'], ['--example', 'all']]) {
    const out = JSON.parse(execFileSync('node', [cli, ...args, '--root', root], { encoding: 'utf8' }));
    assert.equal(out.mode, 'error', args.join(' '));
    assert.equal(out.error_type, 'usage', args.join(' '));
  }
  assert.deepEqual(readdirSync(join(root, 'rules')), []);
});

test('refuses the whole set when one named example is already enforced', () => {
  const root = make_repo({
    files: { 'rules/house/no-promise-then.yml': 'id: no-promise-then\nlanguage: TypeScript\nrule:\n  pattern: $P.then($$$H)\n' },
  });
  const r = install_examples(root, ['no-promise-then', 'no-enum-declaration']);

  assert.equal(r.mode, 'error');
  assert.equal(r.error_type, 'exists');
  assert.match(r.message, /no-promise-then — already at rules\/house\/no-promise-then\.yml/);
  assert.match(r.message, /--skip-existing/);
  // Atomic: the example that *could* have landed did not.
  assert.ok(!existsSync(join(root, 'rules/no-enum-declaration.yml')));
});

test('--skip-existing installs the rest around the local rule', () => {
  const root = make_repo({
    files: { 'rules/no-promise-then.yml': 'id: no-promise-then\nlanguage: TypeScript\nrule:\n  pattern: $P.then($$$H)\n' },
  });
  const local = readFileSync(join(root, 'rules/no-promise-then.yml'), 'utf8');
  const r = install_examples(root, ['no-promise-then', 'no-enum-declaration'], { skip_existing: true });

  assert.equal(r.mode, 'installed');
  assert.deepEqual(r.examples.map((x) => x.id), ['no-enum-declaration']);
  assert.deepEqual(r.skipped, [{ id: 'no-promise-then', reason: 'already present', at: 'rules/no-promise-then.yml' }]);
  // The local rule is the tuned one — it survives untouched.
  assert.equal(readFileSync(join(root, 'rules/no-promise-then.yml'), 'utf8'), local);
  assert.ok(r.next.some((n) => n.includes('no-promise-then')));
});

test('refuses a re-install rather than overwriting what it wrote last time', () => {
  const root = make_repo();
  assert.equal(install_examples(root, ['no-unlinked-todo']).mode, 'installed');

  const again = install_examples(root, ['no-unlinked-todo']);
  assert.equal(again.mode, 'error');
  assert.equal(again.error_type, 'exists');

  const skipped = install_examples(root, ['no-unlinked-todo'], { skip_existing: true });
  assert.equal(skipped.mode, 'error');
  assert.equal(skipped.error_type, 'exists');
  assert.match(skipped.message, /nothing left to install/);
});

test('refuses when sgconfig declares no testConfigs, before writing any rule', () => {
  // D3 has nowhere to land, and an example that dropped its fixture on the way in
  // would install a rule that can never be verified.
  const root = make_repo({ sgconfig: 'ruleDirs:\n  - rules\n', dirs: ['rules'] });
  const r = install_examples(root, ['no-enum-declaration']);

  assert.equal(r.mode, 'error');
  assert.equal(r.error_type, 'no-tests-dir');
  assert.match(r.message, /testConfigs/);
  assert.deepEqual(readdirSync(join(root, 'rules')), []);
});

test('refuses an unknown example by name, listing the ones that exist', () => {
  const root = make_repo();
  const r = install_examples(root, ['no-class-declaration']);

  assert.equal(r.mode, 'error');
  assert.equal(r.error_type, 'usage');
  assert.match(r.message, /unknown example: no-class-declaration/);
  assert.match(r.message, /no-enum-declaration/);
  assert.deepEqual(readdirSync(join(root, 'rules')), []);
});

test('passes a resolver error straight through', () => {
  const root = mkdtempSync(join(tmpdir(), 'ast-grep-rules-'));
  temps.push(root);
  const r = install_examples(root, ['no-enum-declaration']);

  assert.equal(r.mode, 'error');
  assert.equal(r.error_type, 'config');
});

// ---------------------------------------------------------------- cli surface

test('the CLI emits one JSON object and exits 0, including on a refusal', () => {
  const root = make_repo();
  const out = JSON.parse(execFileSync('node', [cli, '--example', 'no-promise-then', '--root', root], { encoding: 'utf8' }));
  assert.equal(out.mode, 'installed');

  const again = JSON.parse(execFileSync('node', [cli, '--example', 'no-promise-then', '--root', root], { encoding: 'utf8' }));
  assert.equal(again.mode, 'error');
  assert.equal(again.error_type, 'exists');
});

test('the CLI rejects a malformed invocation instead of guessing', () => {
  for (const args of [['--example'], ['--example', 'no-promise-then', '--list'], ['--root'], ['--wat']]) {
    const out = JSON.parse(execFileSync('node', [cli, ...args], { encoding: 'utf8' }));
    assert.equal(out.mode, 'error', args.join(' '));
    assert.equal(out.error_type, 'usage', args.join(' '));
  }
});

// ---------------------------------------------------------------- helpers

test('read_labelled unwraps a whole paragraph, not just its first line', () => {
  // The bug this pins: with the `m` flag, `$` matches every line end, and each label
  // came back clipped to its first wrapped line.
  const note = `note: |
  **demonstrates:** \`kind:\` — matching a node by its
  tree-sitter type name, with no pattern at all.

  **encodes:** a preference, stated once.

  Body prose that belongs to neither.
`;

  assert.equal(
    read_labelled(note, 'demonstrates'),
    '`kind:` — matching a node by its tree-sitter type name, with no pattern at all.',
  );
  assert.equal(read_labelled(note, 'encodes'), 'a preference, stated once.');
  assert.equal(read_labelled(note, 'nonesuch'), null);
});

test('read_rule_meta reads the keys, the labels, and the constructs below rule:', () => {
  const meta = read_rule_meta(`id: no-console-in-packages
language: TypeScript
severity: warning
message: "Libraries must not log: use a logger."
note: |
  **demonstrates:** \`files:\` — scoping a rule.

  **encodes:** a preference about libraries.

  A note that mentions \`inside:\` and \`stopBy: end\` in prose, plus:
    any:
      - this line is prose, not a key

rule:
  all:
    - pattern: console.log($$$A)
    - not:
        regex: 'allowed'

files:
  - "packages/**/*.ts"
  - 'apps/**/*.ts'

ignores:
  - "**/dist/**"
`);

  assert.equal(meta.id, 'no-console-in-packages');
  assert.equal(meta.severity, 'warning');
  assert.deepEqual(meta.files, ['packages/**/*.ts', 'apps/**/*.ts']);
  assert.equal(meta.demonstrates, '`files:` — scoping a rule.');
  assert.equal(meta.encodes, 'a preference about libraries.');
  // The note talks about `inside:`, `stopBy: end` and `any:`; the rule uses none of
  // them, and the construct list is read from `rule:` down for exactly that reason.
  assert.deepEqual(meta.uses, ['pattern:', 'all:', 'not:', 'regex:', 'files:']);
});

test('read_rule_meta returns no files for a rule that declares none', () => {
  const meta = read_rule_meta('id: no-enum-declaration\nseverity: warning\nrule:\n  kind: enum_declaration\n\nignores:\n  - "**/dist/**"\n');
  assert.deepEqual(meta.files, []);
  assert.equal(meta.severity, 'warning');
  assert.deepEqual(meta.uses, ['kind:']);
  assert.equal(meta.demonstrates, null);
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
