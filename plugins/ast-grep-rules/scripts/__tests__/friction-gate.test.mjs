// Tests for the friction gate — `scripts/friction-gate.mjs`.
//
// The gate this replaced could not be tested at all: it was an LLM judging a diff, so the
// only way to know what it did was to run a real session and read the debug log. That is
// why its two failure directions went unnoticed until a step-16 live fire — and why the
// headline test here is a **replay of that exact session**, the one the old gate got wrong
// in both directions at once.
//
// Everything below builds synthetic transcripts in the real JSONL shape rather than
// mocking the reader, because the shape *is* the contract: tool results and human messages
// are both `type: "user"`, separated only by `toolUseResult`. Get that wrong and the
// user-correction signature fires on every edit in the session.

import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  build_timeline,
  classify_edit,
  reclaimed_lines,
  read_transcript,
  render_offer,
  significant_lines,
} from '../friction-gate.mjs';

const T0 = Date.parse('2026-08-01T10:00:00.000Z');
const at = (minutes) => T0 + minutes * 60_000;
const iso = (minutes) => new Date(at(minutes)).toISOString();

const assistant_edit = (minutes, file_path, introduced, id = `tu_${minutes}`, removed = '') => ({
  type: 'assistant',
  timestamp: iso(minutes),
  message: {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id,
        name: 'Edit',
        input: { file_path, new_string: introduced, old_string: removed },
      },
    ],
  },
});

const human_turn = (minutes, text = 'no, that is wrong') => ({
  type: 'user',
  timestamp: iso(minutes),
  message: { role: 'user', content: text },
});

// The trap: a tool result is also `type: "user"`.
const tool_result = (minutes) => ({
  type: 'user',
  timestamp: iso(minutes),
  toolUseResult: { stdout: 'ok' },
  message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] },
});

const timeline_of = (records) => build_timeline(records, null);

const CAST = 'return this.config as any satisfies AppConfig;';
const TYPED = 'return structuredClone(this.config) satisfies AppConfig;';

// ------------------------------------------------------------------ the step-16 replay

test('replays the live-fire session the prompt hook got wrong in both directions', () => {
  const file = '/repo/src/app-config.ts';

  // Turn 1 — the assistant writes a method containing an `as any` cast.
  const records = [assistant_edit(0, file, `  toJSON(): AppConfig {\n    ${CAST}\n  }`)];

  // Turn 2 — the user objects, and the assistant rewrites its own recent output.
  // The old gate called this "ordinary edit" and stayed silent. It was THE moment.
  records.push(human_turn(2, 'that cast is one I keep having to back out of this codebase'));
  const correction = classify_edit({
    file_path: file,
    old_string: CAST,
    new_string: TYPED,
    at: at(3),
    timeline: timeline_of(records),
  });

  assert.equal(correction?.signature, 'user-correction', 'the corrected turn must fire');

  // Turn 3 — the assistant removes the method outright. The old gate fired *here*, on a
  // turn the model itself judged unworthy. The offer was already made at turn 2, so this
  // one is suppressed: one offer per episode. (Turn 2's edit is recorded with the
  // `old_string` it really carried — that is what marks it as the episode's take-back.)
  records.push(assistant_edit(3, file, TYPED, 'tu_correction', CAST));
  const followup = classify_edit({
    file_path: file,
    old_string: `  toJSON(): AppConfig {\n    ${TYPED}\n  }`,
    new_string: '',
    at: at(4),
    timeline: timeline_of(records),
  });

  assert.equal(followup, null, 'the second edit of one episode must not offer again');
});

// ------------------------------------------------------------------ the two signatures

test('a human turn between the assistant\'s own edits is what makes it a correction', () => {
  const file = '/repo/src/parse.ts';
  const records = [assistant_edit(0, file, `const parsed = ${CAST}`)];

  const without_human = classify_edit({
    file_path: file,
    old_string: `const parsed = ${CAST}`,
    new_string: 'const parsed = decode(raw);',
    at: at(1),
    timeline: timeline_of(records),
  });
  assert.equal(without_human?.signature, 'self-revert', 'no human turn — the weaker signature');

  records.push(human_turn(1));
  const with_human = classify_edit({
    file_path: file,
    old_string: `const parsed = ${CAST}`,
    new_string: 'const parsed = decode(raw);',
    at: at(2),
    timeline: timeline_of(records),
  });
  assert.equal(with_human?.signature, 'user-correction', 'a human spoke in between');
});

test('a tool result is not a human turn — the trap that would fire on every edit', () => {
  const file = '/repo/src/parse.ts';
  const records = [
    assistant_edit(0, file, `const parsed = ${CAST}`),
    tool_result(1),
    tool_result(2),
  ];

  const verdict = classify_edit({
    file_path: file,
    old_string: `const parsed = ${CAST}`,
    new_string: 'const parsed = decode(raw);',
    at: at(3),
    timeline: timeline_of(records),
  });

  assert.equal(verdict?.signature, 'self-revert', 'tool results must not read as the user speaking');
});

// ------------------------------------------------------------------ silence, the common path

test('ordinary forward progress is silent — nothing was taken back', () => {
  const file = '/repo/src/app.ts';
  const records = [assistant_edit(0, file, 'export const start = () => listen(PORT);')];

  const verdict = classify_edit({
    file_path: file,
    old_string: '',
    new_string: 'export const stop = () => close();',
    at: at(1),
    timeline: timeline_of(records),
  });

  assert.equal(verdict, null);
});

test('editing a file this session never wrote is silent, however destructive', () => {
  const records = [assistant_edit(0, '/repo/src/other.ts', 'export const other = 1;')];

  const verdict = classify_edit({
    file_path: '/repo/src/legacy.ts',
    old_string: 'export function veryOldHelper(input) {\n  return legacyTransform(input);\n}',
    new_string: '',
    at: at(1),
    timeline: timeline_of(records),
  });

  assert.equal(verdict, null, 'a year-old line and a ten-minute-old line differ only here');
});

test('rewriting own output beyond the lookback window is maintenance, not friction', () => {
  const file = '/repo/src/app.ts';
  const records = [assistant_edit(-120, file, `const parsed = ${CAST}`), human_turn(-119)];

  const verdict = classify_edit({
    file_path: file,
    old_string: `const parsed = ${CAST}`,
    new_string: 'const parsed = decode(raw);',
    at: at(0),
    timeline: timeline_of(records),
  });

  assert.equal(verdict, null);
});

test('a new human turn opens a new episode after an offer was already made', () => {
  const file = '/repo/src/app.ts';
  const records = [
    assistant_edit(0, file, `const a = ${CAST}`),
    human_turn(1),
    assistant_edit(2, file, 'const a = decode(raw);', 'tu_first_fix'),
    human_turn(3, 'no, decode is wrong too'),
  ];

  const verdict = classify_edit({
    file_path: file,
    old_string: 'const a = decode(raw);',
    new_string: 'const a = parseConfig(raw);',
    at: at(4),
    timeline: timeline_of(records),
  });

  assert.equal(verdict?.signature, 'user-correction', 'the user spoke again — new episode');
});

// ------------------------------------------------------------------ primitives

test('significant_lines ignores punctuation and short fragments', () => {
  const lines = significant_lines('}\n);\n  const meaningfulValue = compute(input);\n\nx\n');
  assert.deepEqual(lines, ['const meaningfulValue = compute(input);']);
});

test('reclaimed_lines finds only what the earlier edit actually introduced', () => {
  const introduced = 'const parsed = JSON.parse(rawConfigPayload);\nreturn parsed;';
  assert.deepEqual(reclaimed_lines(introduced, 'const parsed = JSON.parse(rawConfigPayload);'), [
    'const parsed = JSON.parse(rawConfigPayload);',
  ]);
  assert.deepEqual(reclaimed_lines(introduced, 'const unrelated = somethingElse(value);'), []);
});

test('build_timeline drops sidechain records and the triggering edit itself', () => {
  const file = '/repo/src/app.ts';
  const sidechain = { ...assistant_edit(0, file, 'const fromSubagent = 1;'), isSidechain: true };
  const records = [sidechain, assistant_edit(1, file, 'const fromMain = compute(value);', 'tu_now')];

  const timeline = build_timeline(records, 'tu_now');
  assert.equal(timeline.edits.length, 0, 'a subagent edit and the current edit are both excluded');
});

test('Write is treated as introducing its whole content', () => {
  const file = '/repo/src/app.ts';
  const records = [
    {
      type: 'assistant',
      timestamp: iso(0),
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tu_write',
            name: 'Write',
            input: { file_path: file, content: 'export const handler = createHandler(deps);' },
          },
        ],
      },
    },
    human_turn(1),
  ];

  const verdict = classify_edit({
    file_path: file,
    old_string: 'export const handler = createHandler(deps);',
    new_string: 'export const handler = buildHandler(deps);',
    at: at(2),
    timeline: timeline_of(records),
  });

  assert.equal(verdict?.signature, 'user-correction');
});

// ------------------------------------------------------------------ robustness + output

test('a truncated final line does not fail the gate', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agr-gate-'));
  const path = join(dir, 'transcript.jsonl');
  writeFileSync(path, `${JSON.stringify(human_turn(0))}\n{"type":"assist`);

  const records = read_transcript(path);
  assert.equal(records.length, 1, 'the whole lines survive, the partial one is skipped');
});

test('the offer names the skill, the log, and leaves the decision with the user', () => {
  const offer = render_offer('user-correction', '/repo/src/app.ts');
  assert.match(offer, /\/ast-grep-rules:lesson/);
  assert.match(offer, /the user decides/);
  assert.match(offer, /memory store/, 'the diverted-lesson finding must stay in the prose');
  assert.doesNotMatch(offer, /\bok\b/, 'no leftover verdict protocol from the prompt-hook era');
});
