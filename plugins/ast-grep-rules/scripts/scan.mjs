#!/usr/bin/env node
/**
 * Scan core — one deterministic engine serving both of the plugin's mechanisms (D21).
 *
 * Both mechanisms need the same first answer — "what is already enforced?" — so the
 * rules-dir inventory lives here once, and two modes read it:
 *
 *   --conventions  stated conventions ✕ rule ids present   → what `/audit` reads
 *   --lessons      friction-log checkbox classification    → what `/mine` reads
 *
 * The classifier is deliberately not a similarity clusterer (D6). The lessons template
 * ends every entry with a `- [ ] rule:` checkbox where the author already wrote down
 * their own expressibility judgment — "none, this was a process error", "needs type
 * info", "belongs in the check script". This script *reads* that judgment and sorts
 * every checkbox into D18's five buckets:
 *
 *   already-consumed   the box is `[x]` — the rule was already promoted
 *   needs-type-info    the author concluded ast-grep's type-blindness is the blocker;
 *                      routed toward oxlint type-aware, never dropped
 *   wrong-mechanism    a real gate, but not an AST shape (check script, shell, CI)
 *   declined-none      "none", or proposed-then-talked-out-of-it
 *   promotable         none of the above — a live candidate for `/rule`
 *
 * The cue lists are short and documented below on purpose. Every item is emitted with
 * its quoted text, source line and the cue that matched, so `/mine` — the model — can
 * re-judge any call it disagrees with. The script's job is a complete, deterministic
 * first pass over the whole corpus, not the final word.
 *
 * Conventions mode is the same bargain: it extracts *candidate* convention statements
 * (normative bullet lines in the configured docs) and cross-references each against
 * the rule inventory — matched by a verbatim rule id in the text, or by every
 * meaningful token of an id appearing in the statement. What survives as `unenforced`
 * is `/audit`'s work list; judging whether a flagged line is genuinely a structurally
 * enforceable convention stays with the model. Matching requires *every* token so a
 * partial overlap can't silently hide a gap — the failure mode this prefers is a
 * spurious flag, which `/audit` can dismiss, over a spurious match, which nobody sees.
 *
 * Fenced code blocks are skipped everywhere: every real lessons file carries the entry
 * template inside a fence, checkbox line included, and counting it would invent a
 * twelfth candidate out of documentation.
 *
 * A configured convention doc that does not exist is skipped, and skipping it is
 * *reported* — by name — whenever any other doc did exist. The silent version of that
 * is the worst failure this script has: an audit that read one of two configured docs
 * and found no gaps is indistinguishable from a clean bill of health, and four separate
 * live runs flagged it independently. `candidates` is the same bargain in lessons mode:
 * the item total is stated outright rather than left to be re-derived by summing
 * `buckets`, because a hand-count is a place to be wrong about a number the script
 * already knows.
 *
 * Always emits exactly one JSON object on stdout:
 *
 *   { mode: 'lessons',     root, lessons_path, rules, entries, candidates, items,
 *     buckets, warnings }
 *   { mode: 'conventions', root, docs, docs_skipped, rules, enforced, unenforced,
 *     warnings }
 *   { mode: 'error',       error_type, message }
 *
 * Usage:
 *   node scan.mjs --lessons                    # classify the friction log
 *   node scan.mjs --conventions                # conventions ✕ enforced rule ids
 *   node scan.mjs --lessons --root <dir>       # explicit repo root
 *
 * Exit codes match config.mjs: 0 for any completed run including `mode: 'error'`
 * (a non-zero exit would make a skill's preflight swallow the message), 2 for an
 * unexpected crash.
 *
 * Zero runtime dependencies (C1); config resolution is delegated to config.mjs.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolve_config } from './config.mjs';

export const BUCKETS = [
  'promotable', 'declined-none', 'needs-type-info', 'wrong-mechanism', 'already-consumed',
];

// ---------------------------------------------------------------- rules inventory

// The shared core both modes read (D21). Walks every configured rule dir the way
// ast-grep does — recursively, every `.yml`/`.yaml`, `---`-separated multi-rule files
// included — and extracts each rule's `id:` plus its `message:` as evidence.

const RULE_FILE_RE = /\.ya?ml$/;
const DOC_SPLIT_RE = /^---\s*$/m;

function unquote(value) {
  const q = value[0];
  if ((q === '"' || q === "'") && value.length > 1 && value.endsWith(q)) {
    return value.slice(1, -1);
  }
  return value;
}

function walk_rule_files(abs_dir, out) {
  for (const entry of readdirSync(abs_dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const abs = join(abs_dir, entry.name);
    if (entry.isDirectory()) walk_rule_files(abs, out);
    else if (RULE_FILE_RE.test(entry.name)) out.push(abs);
  }
  return out;
}

/**
 * Inventory every rule under the resolved `rule_dirs`. Returns
 * `{ rules: [{id, file, message}], warnings }` with files reported repo-relative.
 */
export function inventory_rules(root, rule_dirs) {
  const rules = [];
  const warnings = [];

  for (const dir of rule_dirs) {
    const abs_dir = resolve(root, dir);
    if (!existsSync(abs_dir)) {
      warnings.push(`rules dir \`${dir}\` does not exist yet — inventory is empty for it.`);
      continue;
    }
    for (const abs of walk_rule_files(abs_dir, []).sort()) {
      const file = abs.slice(resolve(root).length + 1).split(/[\\/]/).join('/');
      for (const doc of readFileSync(abs, 'utf8').split(DOC_SPLIT_RE)) {
        const id = /^id:\s*(.+?)\s*$/m.exec(doc);
        if (!id) {
          if (doc.trim() !== '') warnings.push(`${file}: a rule document with no \`id:\` — skipped.`);
          continue;
        }
        const message = /^message:\s*(.+?)\s*$/m.exec(doc);
        rules.push({
          id: unquote(id[1]),
          file,
          message: message ? unquote(message[1]) : null,
        });
      }
    }
  }
  return { rules, warnings };
}

// ---------------------------------------------------------------- markdown scanning

// Both prose stores are markdown with fenced template/example blocks. The fence
// tracker is a simple toggle on ``` / ~~~ openers — good for every real corpus file,
// and documented as not handling nested fences, which none of them use.

const FENCE_RE = /^\s*(```|~~~)/;

function markdown_lines(text) {
  const lines = [];
  let fenced = false;
  text.split(/\r?\n/).forEach((raw, i) => {
    if (FENCE_RE.test(raw)) {
      fenced = !fenced;
      return;
    }
    if (!fenced) lines.push({ n: i + 1, text: raw });
  });
  return lines;
}

// ---------------------------------------------------------------- lessons mode

// The template every corpus entry conforms to:
//
//   ## YYYY-MM-DD
//   ### Lesson: <title>
//   **What happened:** … / **What fixed it:** … / **Potential next step:**
//   - [ ] rule: <the author's own judgment>
//   **Related:** …

const DATE_HEADING_RE = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
const LESSON_HEADING_RE = /^###\s+Lesson:\s*(.+?)\s*$/;
const CHECKBOX_RE = /^\s{0,3}[-*]\s+\[([ xX])\]\s*rule:\s*(.*)$/;
// A wrapped checkbox continues on indented lines until a blank line, a new list item,
// or the template's next `**…:**` field.
const CONTINUATION_RE = /^\s{2,}(?!\*\*)(?![-*]\s)(\S.*?)\s*$/;

/**
 * Parse a lessons document into its entries and `rule:` checkboxes. Fenced blocks —
 * including the template line every real file carries — are never counted.
 */
export function parse_lessons(text) {
  const entries = [];
  const checkboxes = [];
  let date = null;
  let title = null;
  let open = null; // the checkbox still accepting continuation lines

  for (const line of markdown_lines(text)) {
    if (open) {
      const cont = CONTINUATION_RE.exec(line.text);
      if (cont) {
        open.text = `${open.text} ${cont[1]}`;
        continue;
      }
      open = null;
    }

    const date_m = DATE_HEADING_RE.exec(line.text);
    const lesson_m = LESSON_HEADING_RE.exec(line.text);
    const box_m = CHECKBOX_RE.exec(line.text);

    if (date_m) {
      date = date_m[1];
    } else if (lesson_m) {
      title = lesson_m[1];
      entries.push({ date, title, line: line.n });
    } else if (box_m) {
      open = { date, title, line: line.n, checked: box_m[1] !== ' ', text: box_m[2].trim() };
      checkboxes.push(open);
    }
  }
  return { entries, checkboxes };
}

// D18's cue lists. Order is the contract: an author who wrote "none — needs type
// info" made a routing judgment, not a decline, so the type cue outranks the `none`
// prefix. Each list is short on purpose — the emitted `signal` quotes what matched,
// and `/mine` re-judges anything the cues got wrong.
const TYPE_INFO_RE = /\btype[\s-]?(?:info(?:rmation)?|aware(?:ness)?|system)\b|\breturn type\b|\bneeds? types?\b/i;
const WRONG_MECHANISM_RE = /\bcheck[\s-]?script\b|\bcheck\.sh\b|\bnot an ast\b|\bno ast\b|\bshell script\b/i;
const NONE_RE = /^(?:none\b|n\/a\b)/i;
const DECLINE_RE = /\bnot worth\b|\bno rule\b|\bdeclin\w*|\btalked \w+ out\b|\bskip(?:ping)? (?:it|this)\b/i;

/** Sort one checkbox into its D18 bucket. Returns `{ bucket, signal }`. */
export function classify_checkbox({ checked, text }) {
  if (checked) return { bucket: 'already-consumed', signal: 'checkbox is [x]' };

  for (const [bucket, re] of [
    ['needs-type-info', TYPE_INFO_RE],
    ['wrong-mechanism', WRONG_MECHANISM_RE],
  ]) {
    const m = re.exec(text);
    if (m) return { bucket, signal: `matched "${m[0]}"` };
  }

  if (NONE_RE.test(text)) return { bucket: 'declined-none', signal: 'opens with "none"' };
  const declined = DECLINE_RE.exec(text);
  if (declined) return { bucket: 'declined-none', signal: `matched "${declined[0]}"` };

  return { bucket: 'promotable', signal: 'no decline, type-info or mechanism cue — candidate for /rule' };
}

/** Run lessons mode against a repo root. Returns the object the CLI prints. */
export function scan_lessons(root) {
  const config = resolve_config(root);
  if (config.mode === 'error') return config;

  const warnings = [...config.warnings];
  const { rules, warnings: rule_warnings } = inventory_rules(config.root, config.paths.rule_dirs);
  warnings.push(...rule_warnings);

  let parsed = { entries: [], checkboxes: [] };
  const abs = resolve(config.root, config.lessons_path);
  if (existsSync(abs)) {
    parsed = parse_lessons(readFileSync(abs, 'utf8'));
  } else {
    warnings.push(`no lessons file at \`${config.lessons_path}\` yet — nothing to classify. \`/ast-grep-rules:lesson\` creates it.`);
  }

  const items = parsed.checkboxes.map((box) => ({ ...box, ...classify_checkbox(box) }));
  const buckets = Object.fromEntries(BUCKETS.map((b) => [b, 0]));
  for (const item of items) buckets[item.bucket] += 1;

  return {
    mode: 'lessons',
    root: config.root,
    lessons_path: config.lessons_path,
    rules: { count: rules.length, ids: rules.map((r) => r.id).sort() },
    entries: parsed.entries.length,
    // Stated, not implied. `buckets` is tallied from `items` in the same pass, so this
    // is always their sum — and `entries - candidates` is the exact count of entries
    // carrying no `- [ ] rule:` line, which is the one number `/mine` acts on.
    candidates: items.length,
    items,
    buckets,
    warnings,
  };
}

// ---------------------------------------------------------------- conventions mode

// A candidate convention is a normative bullet line in one of the configured docs —
// the statements shaped like "Never X" / "Always Y" / "Don't Z" that the corpus shows
// convention docs are made of. Prose paragraphs are left to `/audit`'s own reading.
const BULLET_RE = /^\s{0,3}[-*]\s+(?!\[)(\S.*?)\s*$/;
const NORMATIVE_RE = /\b(never|always|must(?: not)?|do not|don'?t|only|require[sd]?|forbid(?:den)?|ban(?:ned)?)\b/i;

/** Extract candidate convention statements from one markdown document. */
export function extract_conventions(text, path) {
  const conventions = [];
  for (const line of markdown_lines(text)) {
    const bullet = BULLET_RE.exec(line.text);
    if (bullet && NORMATIVE_RE.test(bullet[1])) {
      conventions.push({ path, line: line.n, text: bullet[1] });
    }
  }
  return conventions;
}

// Token matching: `no-class-declaration` matches a statement containing "classes" and
// "declare" — every meaningful id token must appear, exactly for short tokens, by a
// shared 5+ character stem for longer ones ("declaration" / "declare").
const ID_STOPWORDS = new Set(['no', 'not', 'dont', 'never', 'always', 'use', 'the', 'and', 'for', 'with', 'in', 'of']);

function id_tokens(id) {
  return id.toLowerCase().split('-').filter((t) => t.length >= 3 && !ID_STOPWORDS.has(t));
}

function stems_match(word, token) {
  if (word === token) return true;
  if (word.length < 5 || token.length < 5) return false;
  let n = 0;
  while (n < word.length && n < token.length && word[n] === token[n]) n += 1;
  return n >= 5;
}

/**
 * Does this rule enforce this statement? Verbatim id beats everything; otherwise
 * every token of the id must find a word in the statement.
 */
export function match_rule(convention_text, rule) {
  if (convention_text.toLowerCase().includes(rule.id.toLowerCase())) {
    return { matched: true, via: 'id' };
  }
  const tokens = id_tokens(rule.id);
  if (tokens.length === 0) return { matched: false };
  const text_words = convention_text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const all = tokens.every((token) => text_words.some((word) => stems_match(word, token)));
  return all ? { matched: true, via: 'tokens' } : { matched: false };
}

/** Run conventions mode against a repo root. Returns the object the CLI prints. */
export function scan_conventions(root) {
  const config = resolve_config(root);
  if (config.mode === 'error') return config;

  const warnings = [...config.warnings];
  const { rules, warnings: rule_warnings } = inventory_rules(config.root, config.paths.rule_dirs);
  warnings.push(...rule_warnings);

  // A configured doc that isn't there is skipped either way; what changes is whether
  // anyone is told. Naming the skipped ones is the whole fix — the resolver already
  // carries `exists`, and the partial case is the dangerous one, because an audit over
  // half the configured set still reports "no gaps found".
  const quote = (paths) => paths.map((path) => `\`${path}\``).join(', ');
  const docs = config.convention_docs.filter((d) => d.exists).map((d) => d.path);
  const skipped = config.convention_docs.filter((d) => !d.exists).map((d) => d.path);

  if (docs.length === 0) {
    warnings.push(`none of the configured convention docs exist (${quote(config.convention_docs.map((d) => d.path))}) — nothing to audit.`);
  } else if (skipped.length > 0) {
    const many = skipped.length > 1;
    warnings.push(`${skipped.length} of ${config.convention_docs.length} configured convention docs ${many ? 'do' : 'does'} not exist and ${many ? 'were' : 'was'} skipped (${quote(skipped)}) — this audit covers ${quote(docs)} only, so a convention stated in a missing doc reads here as absent rather than as unenforced.`);
  }

  const enforced = [];
  const unenforced = [];
  for (const path of docs) {
    for (const convention of extract_conventions(readFileSync(resolve(config.root, path), 'utf8'), path)) {
      let match = null;
      for (const rule of rules) {
        const m = match_rule(convention.text, rule);
        if (m.matched) {
          match = { ...convention, rule_id: rule.id, rule_file: rule.file, via: m.via };
          break;
        }
      }
      if (match) enforced.push(match);
      else unenforced.push(convention);
    }
  }

  return {
    mode: 'conventions',
    root: config.root,
    docs,
    docs_skipped: skipped,
    rules: { count: rules.length, ids: rules.map((r) => r.id).sort() },
    enforced,
    unenforced,
    warnings,
  };
}

// ---------------------------------------------------------------- cli

function emit(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function find_repo_root() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function main(argv) {
  const args = argv.slice(2);
  let root = null;
  const modes = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--lessons' || args[i] === '--conventions') {
      modes.push(args[i].slice(2));
    } else if (args[i] === '--root') {
      root = args[i + 1];
      i += 1;
      if (!root) return emit({ mode: 'error', error_type: 'usage', message: '`--root` needs a directory.' });
    } else {
      return emit({ mode: 'error', error_type: 'usage', message: `unknown argument: ${args[i]} (expected --lessons or --conventions, plus optional --root <dir>)` });
    }
  }
  if (modes.length !== 1) {
    return emit({ mode: 'error', error_type: 'usage', message: 'pick exactly one mode: --lessons or --conventions.' });
  }

  const target = root ?? find_repo_root() ?? process.cwd();
  emit(modes[0] === 'lessons' ? scan_lessons(target) : scan_conventions(target));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv);
  } catch (err) {
    emit({ mode: 'error', error_type: 'runtime', message: err.stack ?? err.message });
    process.exit(2);
  }
}
