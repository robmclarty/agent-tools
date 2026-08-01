// Tests for the friction trigger's wiring — `hooks/hooks.json`.
//
// This file used to guard four byte-identical copies of a long prompt. That was the whole
// reason it existed: the gate was a `type: "prompt"` hook, `if:` names exactly one tool and
// one glob, brace alternation is silently inert, and the primitive offered no way to share
// a prompt string — so two tools × two TypeScript extensions meant four copies that would
// rot apart.
//
// The gate is now a `type: "command"` hook over a deterministic script, and every one of
// those problems dissolved rather than being solved:
//
//   - **One entry, not four.** Path scoping moved into the script, where it is an `endsWith`
//     over a list instead of four hook entries that each match one glob. The brace-alternation
//     trap is unreachable because there is no `if:` at all.
//   - **No prompt to keep identical**, and none echoed back into the conversation — so the
//     "author it as user-legible prose" constraint applies to the script's output rather
//     than to a config blob.
//   - **No `continueOnBlock`.** `hookSpecificOutput.additionalContext` injects the offer
//     into model context without a `decision: block`, so the turn was never at risk of
//     ending. That flag existed only to undo a stop the prompt hook could not avoid.
//
// What is left to guard is small and structural: that the hook points at a script that
// exists, bounds its latency, and carries no fossils from the prompt-hook era. The gate's
// *behaviour* is tested where it now lives — `scripts/__tests__/friction-gate.test.mjs` —
// which is the real win here, because behaviour is finally testable offline at all.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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

test('the gate is a single command hook — the deterministic replacement for the prompt gate', () => {
  assert.equal(entries.length, 1, 'one entry: path scoping lives in the script now');
  assert.equal(entries[0].type, 'command');
});

test('the command runs the friction gate from the plugin root, and that script exists', () => {
  const { command } = entries[0];
  // `${CLAUDE_PLUGIN_ROOT}` is what makes this work from a cached plugin install rather
  // than only from a checkout — a hard-coded relative path silently never fires.
  assert.match(command, /\$\{CLAUDE_PLUGIN_ROOT\}/);
  assert.match(command, /scripts\/friction-gate\.mjs/);
  assert.ok(command.startsWith('node '), 'the plugin already requires node for its scripts');

  const script = fileURLToPath(new URL('../../scripts/friction-gate.mjs', import.meta.url));
  assert.ok(existsSync(script), 'the hook points at a script that is actually shipped');
});

test('the gate bounds its own latency', () => {
  // This runs after *every* Edit and Write. The script does no model call and no network,
  // so the budget is small on purpose — a slow gate on a hot path is felt on every edit.
  assert.equal(entries[0].timeout, 5);
});

// ---------------------------------------------------------------- no fossils

test('no prompt-hook fields survive the swap', () => {
  // Each of these was load-bearing for the old shape and is meaningless now. Leaving one
  // behind would read as intent to a future editor and imply the gate still judges prose.
  for (const dead of ['prompt', 'if', 'continueOnBlock', 'statusMessage', 'model', 'once']) {
    assert.ok(!(dead in entries[0]), `stale prompt-hook field: ${dead}`);
  }
});

test('the offer prose lives in the script, not in this config', () => {
  // The prompt hook carried its whole user-facing text inside JSON, which is why the file
  // needed a test to explain itself: JSON takes no comments. The wiring is now small
  // enough to read, and the prose it triggers is versioned beside the logic that emits it.
  const raw = readFileSync(hooks_path, 'utf8');
  assert.ok(!raw.includes('/ast-grep-rules:lesson'), 'the offer text belongs in the script');
  assert.ok(raw.length < 400, 'wiring only — if this grows, something moved to the wrong layer');
});
