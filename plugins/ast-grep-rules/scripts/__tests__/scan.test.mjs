// Tests for the scan core — the one engine both `/audit` and `/mine` read (D21).
//
// The corpus under `fixtures/scan-corpus/` is hand-authored to reproduce the *shape*
// of the real four-repo mix (C8), not its content: 11 `rule:` checkboxes that must
// sort into D18's buckets as exactly 1 promotable, 2 needs-type-info, 1
// wrong-mechanism, 1 already-consumed and 6 declined-none — plus the fenced template
// line every real lessons file carries, and one entry with no checkbox at all.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  classify_checkbox, extract_conventions, match_rule, parse_lessons,
  scan_conventions, scan_lessons,
} from '../scan.mjs';

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const corpus = fixture('scan-corpus');
const scan_cli = fileURLToPath(new URL('../scan.mjs', import.meta.url));

// ---------------------------------------------------------------- lessons mode

test('lessons: the 11-checkbox corpus sorts into the D18 mix', () => {
  const s = scan_lessons(corpus);

  assert.equal(s.mode, 'lessons');
  assert.equal(s.lessons_path, 'docs/lessons.md');
  assert.deepEqual(s.buckets, {
    'promotable': 1,
    'declined-none': 6,
    'needs-type-info': 2,
    'wrong-mechanism': 1,
    'already-consumed': 1,
  });
  assert.equal(s.items.length, 11);
  // 12 entries, 11 checkboxes: an entry with no checkbox is counted, not crashed on.
  assert.equal(s.entries, 12);
  assert.deepEqual(s.warnings, []);
});

test('lessons: the one promotable is the anchored-fence candidate', () => {
  const s = scan_lessons(corpus);
  const promotable = s.items.filter((i) => i.bucket === 'promotable');

  assert.equal(promotable.length, 1);
  assert.equal(promotable[0].title, 'Fence-matching regexes drifted unanchored');
  assert.equal(promotable[0].date, '2026-04-18');
});

test('lessons: both type-blindness entries route to needs-type-info, not declined', () => {
  const s = scan_lessons(corpus);
  const typed = s.items.filter((i) => i.bucket === 'needs-type-info');

  assert.deepEqual(typed.map((i) => i.title).sort(), [
    'Awaited a callback that returns void',
    'String/Buffer confusion in the encoder',
  ]);
  // The first one *opens* with "none" — the type cue must outrank the none prefix,
  // or a routing judgment silently degrades into a decline (D18).
  const awaited = typed.find((i) => i.title.startsWith('Awaited'));
  assert.match(awaited.text, /^none — deciding/);
});

test('lessons: the fenced template line is never counted', () => {
  const s = scan_lessons(corpus);

  // The template checkbox inside the fence would classify as a 12th item — and as a
  // second promotable — if fences were not skipped.
  assert.equal(s.items.some((i) => i.text.includes('pattern sketch')), false);
});

test('lessons: a wrapped checkbox is classified on its joined text', () => {
  const s = scan_lessons(corpus);
  const item = s.items.find((i) => i.title === 'An empty catch swallowed a real error');

  // The decline cue sits on the continuation line; without joining, this entry
  // would misread as promotable.
  assert.match(item.text, /not worth a rule\.$/);
  assert.equal(item.bucket, 'declined-none');
});

test('lessons: the rules inventory rides along, recursed and multi-doc', () => {
  const s = scan_lessons(corpus);

  // no-default-export lives in a subdirectory; no-console-log and no-todo-comment
  // share one `---`-separated file.
  assert.deepEqual(s.rules, {
    count: 4,
    ids: ['no-class-declaration', 'no-console-log', 'no-default-export', 'no-todo-comment'],
  });
});

test('lessons: a repo with no lessons file yet is empty, not an error', () => {
  const s = scan_lessons(fixture('bare-layout'));

  assert.equal(s.mode, 'lessons');
  assert.deepEqual(s.items, []);
  assert.equal(s.entries, 0);
  assert.equal(s.rules.count, 0);
  assert.equal(s.warnings.filter((w) => w.includes('no lessons file at `notes/friction.md`')).length, 1);
});

// ---------------------------------------------------------------- classifier

test('classify_checkbox: one call per bucket, priorities as documented', () => {
  const bucket = (checked, text) => classify_checkbox({ checked, text }).bucket;

  // A checked box wins over everything — the rule already landed.
  assert.equal(bucket(true, 'none'), 'already-consumed');
  // The type cue outranks the none prefix: "none — needs type info" is a routing.
  assert.equal(bucket(false, 'none — needs type info ast-grep lacks'), 'needs-type-info');
  assert.equal(bucket(false, 'belongs in the check script, not a rule'), 'wrong-mechanism');
  assert.equal(bucket(false, 'none'), 'declined-none');
  assert.equal(bucket(false, 'n/a — nothing structural here'), 'declined-none');
  assert.equal(bucket(false, 'could ban it, but declined: too many legit uses'), 'declined-none');
  assert.equal(bucket(false, 'ban `require()` calls at module top level'), 'promotable');
});

test('parse_lessons: fences and continuations, in isolation', () => {
  const { entries, checkboxes } = parse_lessons([
    '```markdown',
    '- [ ] rule: <template line, never counted>',
    '```',
    '## 2026-01-01',
    '### Lesson: wrapped entry',
    '- [ ] rule: first line of the judgment',
    '  second line, joined with a space',
    '',
    '**Related:** nothing',
  ].join('\n'));

  assert.equal(entries.length, 1);
  assert.equal(checkboxes.length, 1);
  assert.deepEqual(checkboxes[0], {
    date: '2026-01-01',
    title: 'wrapped entry',
    line: 6,
    checked: false,
    text: 'first line of the judgment second line, joined with a space',
  });
});

// ---------------------------------------------------------------- conventions mode

test('conventions: flags the stated-but-unenforced, stays silent on the enforced', () => {
  const s = scan_conventions(corpus);

  assert.equal(s.mode, 'conventions');
  assert.deepEqual(s.docs, ['docs/conventions.md', 'CLAUDE.md']);

  // The two gaps — one per doc — each cite where the convention is stated.
  assert.deepEqual(s.unenforced.map(({ path, text }) => ({ path, text })), [
    { path: 'docs/conventions.md', text: 'Never throw inside a step function; return a Result value.' },
    { path: 'CLAUDE.md', text: 'Always route JSON parsing through the typed helper in `src/json.ts`.' },
  ]);

  // The enforced ones are reported as evidence, never flagged.
  assert.deepEqual(s.enforced.map(({ text, rule_id, via }) => ({ text, rule_id, via })), [
    { text: 'Never declare classes — export factory functions instead.', rule_id: 'no-class-declaration', via: 'tokens' },
    { text: "Don't leave `console.log` calls in package source.", rule_id: 'no-console-log', via: 'tokens' },
  ]);
});

test('conventions: a non-normative bullet is not a convention', () => {
  const s = scan_conventions(corpus);
  const everything = [...s.enforced, ...s.unenforced];

  assert.equal(everything.length, 4);
  assert.equal(everything.some((c) => c.text.includes('CHANGELOG')), false);
});

test('conventions: a repo with no convention docs warns instead of failing', () => {
  const s = scan_conventions(fixture('bare-layout'));

  assert.equal(s.mode, 'conventions');
  assert.deepEqual(s.docs, []);
  assert.deepEqual(s.enforced, []);
  assert.deepEqual(s.unenforced, []);
  assert.equal(s.warnings.filter((w) => w.includes('none of the configured convention docs exist')).length, 1);
});

test('extract_conventions skips fenced blocks', () => {
  const found = extract_conventions([
    '- Never edit generated files by hand.',
    '```js',
    "- Don't count this: it is a code sample.",
    '```',
  ].join('\n'), 'docs/x.md');

  assert.deepEqual(found, [{ path: 'docs/x.md', line: 1, text: 'Never edit generated files by hand.' }]);
});

test('match_rule: verbatim id, token stems, and the all-tokens guard', () => {
  const rule = { id: 'no-class-declaration' };

  // Verbatim rule id in the statement beats token matching.
  assert.deepEqual(match_rule('exceptions are listed under `no-class-declaration`', rule), { matched: true, via: 'id' });
  // "classes"/"class" and "declare"/"declaration" match by shared 5+ character stem.
  assert.deepEqual(match_rule('Never declare classes anywhere', rule), { matched: true, via: 'tokens' });
  // One token alone is not a match — a partial overlap must not hide a gap.
  assert.equal(match_rule('keep class names short', rule).matched, false);
  // Short tokens match exactly, not by stem: "log" must not ride on "login".
  assert.equal(match_rule('never console login pages', { id: 'no-console-log' }).matched, false);
});

// ---------------------------------------------------------------- error + cli

test('an unconfigured repo passes the resolver error through untouched', () => {
  const s = scan_lessons(fixture('no-config'));

  assert.equal(s.mode, 'error');
  assert.equal(s.error_type, 'config');
  assert.match(s.message, /no \.claude\/ast-grep\.json found/);
});

test('cli: both modes run end to end and print the same objects', () => {
  const run = (...args) => JSON.parse(execFileSync(process.execPath, [scan_cli, ...args], { encoding: 'utf8' }));

  const lessons = run('--lessons', '--root', corpus);
  assert.equal(lessons.mode, 'lessons');
  assert.equal(lessons.buckets.promotable, 1);

  const conventions = run('--conventions', '--root', corpus);
  assert.equal(conventions.mode, 'conventions');
  assert.equal(conventions.unenforced.length, 2);

  // Zero or two modes is a usage error — still exit 0, still JSON on stdout.
  assert.equal(run('--root', corpus).error_type, 'usage');
  assert.equal(run('--lessons', '--conventions').error_type, 'usage');
});
