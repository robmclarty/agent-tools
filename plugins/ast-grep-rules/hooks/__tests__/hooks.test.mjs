// Tests for the friction trigger — `hooks/hooks.json`.
//
// `hooks.json` is JSON, so it carries no comments, and it is the one file in this
// plugin whose behaviour cannot be exercised offline: the only way to know the gate
// fires is to run a real session (the build log records those live fires). What is
// checkable here is the shape — and the shape is where this file will rot, because
// **the same prompt is repeated four times**.
//
// Why four. The gate is a `type: "prompt"` hook, which spends an LLM call every time
// it runs, and D15 is explicit that an eager trigger is worse than silence because it
// also costs tokens. `if:` takes permission-rule syntax and is evaluated *before* the
// model is spawned, so it is a free pre-filter — but it names exactly one tool and one
// glob, and (verified by live fire against Claude Code 2.1.220) brace alternation is
// not expanded: `Edit(**/*.{ts,tsx})` silently matches nothing. Two tools × two
// TypeScript extensions is therefore four entries, and the primitive gives no way to
// share one prompt string between them.
//
// The one constraint to know before rewriting the prompt: **on PostToolUse the gate is
// blind to the conversation.** Only `Stop`/`SubagentStop` prepend the transcript to a
// prompt hook; here the evaluator is handed exactly one message — the prompt, with the
// hook-input JSON substituted for `$ARGUMENTS` — and no tools, so `transcript_path` in
// that payload is a string it cannot open. Asked directly whether it could see the
// conversation, the evaluator said yes; the debug log said `Querying model with 1
// messages`. It confabulates about its own context, so the gate is written to judge the
// diff and nothing else, and the prompt says so in as many words.
//
// So the drift guard is the point of this file: four copies that must stay byte-
// identical, plus the handful of fields the trigger's behaviour actually rests on.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const hooks_path = fileURLToPath(new URL('../hooks.json', import.meta.url));
const hooks = JSON.parse(readFileSync(hooks_path, 'utf8'));

const entries = hooks.hooks.PostToolUse.flatMap((m) => m.hooks);

// ---------------------------------------------------------------- wiring

test('the plugin registers exactly one PostToolUse matcher, over Edit and Write', () => {
  assert.deepEqual(Object.keys(hooks.hooks), ['PostToolUse']);
  assert.equal(hooks.hooks.PostToolUse.length, 1);
  assert.equal(hooks.hooks.PostToolUse[0].matcher, 'Edit|Write');
});

test('every entry is a prompt hook — D19\'s command fallback is discharged, not built', () => {
  assert.equal(entries.length, 4);
  for (const e of entries) assert.equal(e.type, 'prompt');
});

test('the path gate covers both tools and both TypeScript extensions, one each', () => {
  // Sorted, so a duplicate `if` (four entries, three distinct globs) fails here rather
  // than quietly halving the coverage.
  assert.deepEqual(
    entries.map((e) => e.if).sort(),
    ['Edit(**/*.ts)', 'Edit(**/*.tsx)', 'Write(**/*.ts)', 'Write(**/*.tsx)'],
  );
});

test('no `if` uses brace alternation, which this primitive does not expand', () => {
  // `Edit(**/*.{ts,tsx})` parses, loads, and then matches nothing at all — the failure
  // is silent, and the symptom is a trigger that simply never fires.
  for (const e of entries) assert.ok(!e.if.includes('{'), `brace alternation in ${e.if}`);
});

// ---------------------------------------------------------------- the offer

test('every entry sets continueOnBlock, so a fired gate offers instead of ending the turn', () => {
  // Without it, `ok:false` stops the turn and the reason lands in the transcript where
  // the model never sees it — an interruption rather than an offer, which C3 forbids.
  for (const e of entries) assert.equal(e.continueOnBlock, true);
});

test('every entry bounds its own latency and names its spinner', () => {
  // This runs after *every* TypeScript edit, so an unbounded gate stalls ordinary work.
  for (const e of entries) {
    assert.equal(e.timeout, 15);
    assert.equal(typeof e.statusMessage, 'string');
    assert.ok(e.statusMessage.length > 0);
  }
});

// ---------------------------------------------------------------- the prompt

test('all four prompts are byte-identical', () => {
  const [first, ...rest] = entries.map((e) => e.prompt);
  for (const p of rest) assert.equal(p, first);
});

test('the prompt ends with $ARGUMENTS, so the echoed copy stays readable', () => {
  // On a fired gate the model is handed `[<this prompt, verbatim>]: <reason>` — the
  // template, placeholder unsubstituted. Trailing it keeps that echo prose-shaped.
  const [prompt] = entries.map((e) => e.prompt);
  assert.ok(prompt.trimEnd().endsWith('$ARGUMENTS'));
  assert.equal(prompt.match(/\$ARGUMENTS/g).length, 1);
});

test('the prompt names the skill it is offering, and biases to silence', () => {
  const [prompt] = entries.map((e) => e.prompt);
  assert.ok(prompt.includes('/ast-grep-rules:lesson'));
  // The gate sees one diff and no conversation, so the default answer has to be the
  // silent one, said in as many words.
  assert.ok(prompt.includes('When in doubt, answer ok=true'));
  assert.ok(prompt.includes('you cannot see the conversation'));
});

test('the prompt reads as prose, not as an instruction aimed at the reading model', () => {
  // It is quoted back into the conversation verbatim when the gate fires, so anything
  // written as a command to "you" surfaces mid-session as an injected-looking order.
  const [prompt] = entries.map((e) => e.prompt);
  assert.ok(!/^\s*(You are|Your task|IMPORTANT|SYSTEM)/m.test(prompt));
});
