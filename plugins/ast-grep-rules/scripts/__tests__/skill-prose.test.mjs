// Tests for the two prose contracts the live fires cost something to learn.
//
// Both are claims about SKILL text rather than about code, which is exactly the kind of
// claim that rots quietly: nothing fails when a sentence stops being true. The pattern
// is the one `install-starter.test.mjs` already uses on the bundled notes — assert the
// prose, because prose is what these two mechanisms are made of.
//
//   1. `/rule` and `/audit` cite the cookbook at the `path` the catalogue hands them.
//      Before, each SKILL spelled the bundled layout out itself — six hard-coded
//      `examples/…` paths across the two files, every one of them a copy that goes stale
//      the first time the directory moves. `install-starter.mjs --list` is the single
//      source, so the assertion is that no literal path survives beside it.
//
//   2. `/lesson` and the friction hook both say that `lessons_path` is the only store
//      that counts. A step-16 sub-agent blocked from writing the log put its lesson in
//      its own memory store and reported it as recorded — a failure that reads as
//      success, and one `/ast-grep-rules:mine` can never see, because it reads that one
//      file and nothing else.
//
// Reading only; nothing here writes.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Relative to the plugin root. A file that moved out from under these reads throws
// ENOENT rather than passing vacuously, which is the behaviour we want from a suite
// whose every assertion is "this text says X".
const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

// The two that cite the cookbook. `/init` owns the installer and legitimately names the
// directory it installs from; these two only ever read.
const CITING_SKILLS = ['skills/rule/SKILL.md', 'skills/audit/SKILL.md'];

test('neither citing skill hard-codes a path into the cookbook', () => {
  // Was six literals across the two files. The catalogue is the source now, so any
  // reappearance is a second copy of the layout waiting to disagree with the first.
  for (const rel of CITING_SKILLS) {
    const offenders = read(rel)
      .split('\n')
      .map((line, i) => [i + 1, line])
      .filter(([, line]) => /examples\//.test(line));

    assert.deepEqual(offenders, [], `${rel} still spells out the cookbook layout: ${JSON.stringify(offenders)}`);
  }
});

test('both citing skills take the example paths from the catalogue instead', () => {
  // Removing the literals only helps if something replaced them: each SKILL has to run
  // `--list` in its preflight and name the two keys it reads back.
  for (const rel of CITING_SKILLS) {
    const text = read(rel);
    assert.match(text, /install-starter\.mjs --list/, `${rel} does not run the catalogue`);
    for (const key of ['path.rule', 'path.test']) {
      assert.ok(text.includes(`\`${key}\``), `${rel} never names \`${key}\``);
    }
  }
});

// That the catalogue actually *emits* `path.rule` and `path.test` is the other half of
// this contract, and it is asserted where the catalogue lives —
// `install-starter.test.mjs`, "the catalogue carries a readable path to each example
// rule and fixture". The two halves fail with different messages on purpose: prose
// naming a key that does not exist, versus a key quietly dropped from the listing.

test('lesson and the hook both name the friction log as the only store', () => {
  const lesson = read('skills/lesson/SKILL.md');

  // The claim, and the specific wrong turn it exists to head off.
  assert.match(lesson, /only store that counts/);
  assert.match(lesson, /memory store/);
  // And that a blocked write is *reported*, not rerouted — the failure mode was an
  // agent that treated "somewhere else" as a fallback.
  assert.match(lesson, /blocked/);
  assert.match(lesson, /do not reroute/i);

  const hooks = JSON.parse(read('hooks/hooks.json'));
  const prompts = hooks.hooks.PostToolUse.flatMap((m) => m.hooks).map((h) => h.prompt);

  // Every copy, not just the first: the manifest carries one per matcher, and a claim
  // that holds in three of four is a claim that fails on a `.tsx` write.
  assert.equal(prompts.length, 4);
  for (const prompt of prompts) {
    assert.match(prompt, /friction log/);
    assert.match(prompt, /memory store/);
    assert.match(prompt, /is not recorded/);
  }
});
