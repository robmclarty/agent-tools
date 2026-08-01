#!/usr/bin/env node
/**
 * Friction gate — the deterministic trigger behind `/ast-grep-rules:lesson`.
 *
 * This replaces a `type: "prompt"` hook that spent an LLM call on every TypeScript edit
 * to answer a question it structurally could not answer. The reasoning is worth keeping,
 * because the failure was not a wording problem:
 *
 * D15 asked the gate for two signatures — *did the user just correct the assistant*, and
 * *did the assistant just undo its own recent change*. A `PostToolUse` prompt hook is
 * handed exactly one message: the prompt, with the hook-input JSON substituted in, and no
 * tools. It cannot see the conversation. So the first signature was unreachable, and the
 * second was judged from a single diff with no way to know whether the removed lines were
 * ones the assistant itself had just written. A live fire caught both failure directions
 * in one session: silence on the turn that carried the friction (a user complaining about
 * an `as any` cast, then the assistant fixing it), and a fire on a later turn the model
 * itself judged unworthy.
 *
 * The payload carries `transcript_path`. A prompt hook gets that path and no way to open
 * it; a script does. Reading it turns both signatures into ordering questions:
 *
 *   Is this edit rewriting text the assistant itself recently wrote?
 *     ...and did a human turn land in between?   → user-correction   (the strong one)
 *     ...with no human turn?                     → self-revert       (the weak one)
 *
 * That single primitive — *rewriting one's own recent output* — is what the conversation-
 * blind version was missing. An edit that removes code the assistant wrote ten minutes ago
 * looks identical, in isolation, to an edit that removes code that has been there for a
 * year. Only the transcript separates them.
 *
 * Three properties this shape buys that the prompt hook could not:
 *
 *   - **Free.** No model call, ever. The old gate fired on every `.ts`/`.tsx` edit, which
 *     is the highest-frequency call the plugin made, to return "ordinary edit" almost
 *     every time.
 *   - **Consistent.** The same transcript and the same diff produce the same verdict.
 *   - **Quiet.** One offer per episode. The old gate had no memory, so a friction episode
 *     spanning three edits could produce three offers; here a fire is suppressed when an
 *     earlier edit to the same file already qualified and no human has spoken since.
 *
 * Deliberately *not* here: any judgment about whether the friction is worth recording.
 * That is the human's call, and the offer is how it gets asked. The gate decides only
 * whether the structural shape of a correction is present.
 *
 * **This script fails open, always.** A malformed transcript, an unreadable path, an
 * unparseable payload — every one exits 0 with no output. A gate that breaks a session is
 * strictly worse than no gate, and this runs on every edit.
 *
 * Emits nothing at all when silent. When it fires, exactly one JSON object on stdout:
 *
 *   { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: '<offer>' } }
 *
 * `additionalContext` injects text into the model's context without blocking the turn —
 * so the offer arrives as something the model can relay, and the user can ignore.
 *
 * Usage: reads hook-input JSON on stdin. Wired from `hooks/hooks.json`.
 *   node friction-gate.mjs < hook-input.json
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// How far back an edit counts as "recent". Past this, a rewrite is maintenance rather
// than a take-back — nobody is still holding the context that made it friction.
const LOOKBACK_MS = 45 * 60 * 1000;

// Cap the scan regardless of time. Long sessions produce large transcripts and this runs
// on a hot path; the most recent edits are the only ones that can match anyway.
const LOOKBACK_EDITS = 60;

// A line has to carry real content before its reappearance means anything. A bare `}` or
// `);` matches everywhere and would make every refactor look like a revert.
const MIN_LINE_CHARS = 12;

// The gate's scope. Kept as a literal list rather than read from the repo's config on
// purpose: this runs on every edit, and a config read is a file stat plus a parse plus a
// new failure mode on the hot path, to answer a question that does not vary per repo.
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts'];

/** Parse a JSONL transcript, skipping any line that does not parse. */
export const read_transcript = (path) => {
  const records = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      // A partially-flushed final line is normal; skip it rather than fail the gate.
    }
  }
  return records;
};

/**
 * Split a transcript into the two things the signatures need.
 *
 * The discrimination that makes this possible: tool results and real human messages are
 * *both* `type: "user"`. What separates them is `toolUseResult`, which only the former
 * carries. Without that, every tool result would read as the user speaking, and the
 * user-correction signature would fire on literally every edit.
 *
 * Sidechain records are a subagent's conversation, not this one's, and are dropped.
 */
export const build_timeline = (records, current_tool_use_id) => {
  const edits = [];
  const human_turns = [];

  for (const record of records) {
    if (record.isSidechain === true) continue;
    const at = Date.parse(record.timestamp ?? '');
    if (Number.isNaN(at)) continue;

    if (record.type === 'user' && !record.toolUseResult) {
      human_turns.push({ at });
      continue;
    }

    if (record.type !== 'assistant') continue;
    const content = record.message?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block?.type !== 'tool_use') continue;
      if (block.name !== 'Edit' && block.name !== 'Write') continue;
      // The edit that triggered this hook may already be in the transcript; it cannot be
      // its own precedent.
      if (current_tool_use_id && block.id === current_tool_use_id) continue;
      const file_path = block.input?.file_path;
      if (typeof file_path !== 'string') continue;
      edits.push({
        at,
        file_path,
        // Write has no old_string; its whole content is what it introduced, and it
        // removed nothing this session can see.
        introduced: block.input?.new_string ?? block.input?.content ?? '',
        removed: block.input?.old_string ?? '',
      });
    }
  }

  return { edits, human_turns };
};

/** Lines substantial enough that seeing one again is evidence rather than coincidence. */
export const significant_lines = (text) =>
  String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= MIN_LINE_CHARS && /[A-Za-z0-9]/.test(line));

/**
 * The core primitive: which substantial lines of `removed` did `introduced` contain?
 *
 * This is what tells "removing code the assistant wrote minutes ago" apart from "removing
 * code that has been there for a year" — the two are identical in the diff alone, which is
 * exactly what the conversation-blind gate had to work from.
 */
export const reclaimed_lines = (introduced, removed) => {
  const introduced_text = String(introduced ?? '');
  return significant_lines(removed).filter((line) => introduced_text.includes(line));
};

/**
 * Classify one edit against the transcript that preceded it.
 *
 * Returns `{ signature, evidence }`, or `null` for silence — which is the overwhelmingly
 * common answer and the one the whole design optimizes for.
 */
export const classify_edit = ({ file_path, old_string, new_string, at, timeline }) => {
  const window_start = at - LOOKBACK_MS;
  const prior = timeline.edits
    .filter((edit) => edit.file_path === file_path && edit.at < at && edit.at >= window_start)
    .slice(-LOOKBACK_EDITS);

  if (prior.length === 0) return null;

  // Did this edit take back substantial lines that an earlier edit in this session
  // introduced, without putting them back?
  const kept = String(new_string ?? '');
  let taken_back = [];
  let source_edit = null;

  for (const edit of prior) {
    const reclaimed = reclaimed_lines(edit.introduced, old_string).filter(
      (line) => !kept.includes(line),
    );
    if (reclaimed.length > taken_back.length) {
      taken_back = reclaimed;
      source_edit = edit;
    }
  }

  if (taken_back.length === 0 || !source_edit) return null;

  const spoke_between = (from, to) =>
    timeline.human_turns.some((turn) => turn.at > from && turn.at < to);

  // An *episode* is the run of edits since the user last spoke. Anything they said starts
  // a new one — which is why a second complaint about the same file offers again.
  const episode_start = timeline.human_turns
    .filter((turn) => turn.at < at)
    .reduce((latest, turn) => Math.max(latest, turn.at), 0);

  // One offer per episode. If an earlier edit in this same run already took work back, the
  // offer was already made; repeating it per-edit is exactly how a gate trains you to
  // dismiss it. A step-16 live fire produced three qualifying edits in one three-turn
  // correction — the first is the one worth interrupting for.
  const took_back = (edit) =>
    prior.some(
      (earlier) =>
        earlier.at < edit.at && reclaimed_lines(earlier.introduced, edit.removed).length > 0,
    );
  if (prior.some((edit) => edit.at > episode_start && took_back(edit))) return null;

  const signature = spoke_between(source_edit.at, at) ? 'user-correction' : 'self-revert';
  return { signature, evidence: { lines: taken_back.length, since: source_edit.at } };
};

/**
 * The text injected into the model's context.
 *
 * Written as prose the model can relay, because that is what happens to it. It offers and
 * never writes (C3), and it names the friction log as the only store that counts — a live
 * fire caught a sub-agent, blocked from the log, recording its lesson into its own memory
 * store instead and reporting that as done. Friction written somewhere `/mine` cannot read
 * is friction lost, and it looks like success in the transcript.
 */
export const render_offer = (signature, file_path) => {
  const observed =
    signature === 'user-correction'
      ? `The user said something, and this edit then rewrote code from earlier in this session in ${file_path}.`
      : `This edit took back code written earlier in this session in ${file_path}, without replacing it.`;

  return [
    observed,
    '',
    'That is the shape of friction worth recording — the kind that becomes an enforced',
    'ast-grep rule so it cannot recur. If it was a real correction, offer',
    '/ast-grep-rules:lesson before moving on, so the cause is captured while it is fresh.',
    'One entry, and the user decides — if this was ordinary iteration, say nothing.',
    '',
    "The entry belongs in this repo's friction log and nowhere else; a lesson written to a",
    'memory store or a scratch note is not recorded, because /ast-grep-rules:mine never',
    'reads those. If that file cannot be written, say so rather than putting the entry',
    'somewhere it will not be found.',
  ].join('\n');
};

const read_stdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

const main = async () => {
  const payload = JSON.parse(await read_stdin());
  const file_path = payload.tool_input?.file_path;
  if (typeof file_path !== 'string') return;
  if (!SOURCE_EXTENSIONS.some((ext) => file_path.endsWith(ext))) return;
  if (typeof payload.transcript_path !== 'string') return;

  const timeline = build_timeline(read_transcript(payload.transcript_path), payload.tool_use_id);

  const verdict = classify_edit({
    file_path,
    old_string: payload.tool_input.old_string ?? '',
    new_string: payload.tool_input.new_string ?? payload.tool_input.content ?? '',
    at: Date.now(),
    timeline,
  });

  if (!verdict) return;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: render_offer(verdict.signature, file_path),
      },
    }),
  );
};

// Fail open. Every error path is silence, never a broken turn.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {});
}
