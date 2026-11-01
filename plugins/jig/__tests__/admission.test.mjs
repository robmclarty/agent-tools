// Tests for jig's admission rule, the two clauses a file shape can check.
//
// jig admits a skill that is user-invoked only, per-repo, script-backed, and
// ambient-free (the README opens with the rule). Per-repo and script-backed are
// judgments about a skill's design and stay prose; the other two are shapes on
// disk, so this file enforces them:
//
//   user-invoked only : every skills/*/SKILL.md sets `disable-model-invocation: true`
//                       in its leading frontmatter block. The key counts there and
//                       nowhere else, so a body that merely mentions it does not pass.
//   ambient-free      : nothing Claude Code would load outside the user's turn is
//                       present: no hooks/, agents/, bin/, monitors/, .mcp.json, or
//                       .lsp.json under the plugin root, and no hooks, mcpServers,
//                       or lspServers key in plugin.json.
//
// Each check is a free function over a plugin root, so the same function that
// passes the live tree is the one proved against a scratch copy of the plugin
// under os.tmpdir() with exactly one violation injected, removed afterward. A
// "fails when" asserted only in a comment could pass vacuously; these cannot.

import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin_root = fileURLToPath(new URL('..', import.meta.url));

// The ambient set: each is a component Claude Code loads whether or not the user
// asked for it this session. Agent descriptions ride every session's Agent tool
// listing, and an LSP server is a background process like an MCP server.
export const AMBIENT_PATHS = ['hooks', 'agents', 'bin', 'monitors', '.mcp.json', '.lsp.json'];
export const AMBIENT_KEYS = ['hooks', 'mcpServers', 'lspServers'];

// The lines of a SKILL.md's leading frontmatter block: between a `---` on the
// first line and the next `---`. Null when the file opens with anything else.
export function frontmatter(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  return end === -1 ? null : lines.slice(1, end);
}

// Whether the frontmatter, and only the frontmatter, sets the key to true.
export function is_user_invoked_only(skill_text) {
  const block = frontmatter(skill_text);
  return block !== null && block.some((line) => /^disable-model-invocation:\s*true\s*$/.test(line));
}

// Every skills/*/SKILL.md under the root that the model could invoke on its own,
// as root-relative paths. Empty is the passing result.
export function model_invocable_skills(root) {
  const skills_dir = join(root, 'skills');
  if (!existsSync(skills_dir)) return [];
  return readdirSync(skills_dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join('skills', entry.name, 'SKILL.md'))
    .filter((rel) => existsSync(join(root, rel)))
    .filter((rel) => !is_user_invoked_only(readFileSync(join(root, rel), 'utf8')));
}

// Every ambient component present under the root: a path from AMBIENT_PATHS, or
// a key from AMBIENT_KEYS declared in plugin.json. Empty is the passing result.
export function ambient_components(root) {
  const present_paths = AMBIENT_PATHS.filter((rel) => existsSync(join(root, rel)));
  const manifest = JSON.parse(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8'));
  const declared_keys = AMBIENT_KEYS.filter((key) => Object.hasOwn(manifest, key)).map((key) => `plugin.json: ${key}`);
  return [...present_paths, ...declared_keys];
}

// A scratch copy of the plugin under os.tmpdir(), handed to fn and removed after,
// whatever fn does. Every injected violation lives in a copy, never in the tree.
function with_scratch_plugin(fn) {
  const root = mkdtempSync(join(tmpdir(), 'jig-admission-'));
  try {
    cpSync(plugin_root, root, { recursive: true });
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// Rewrite a SKILL.md without its disable-model-invocation line, keeping the rest
// of the frontmatter and the whole body.
function drop_user_invoked_key(root, rel) {
  const path = join(root, rel);
  const lines = readFileSync(path, 'utf8').split('\n');
  const end = lines.indexOf('---', 1);
  const kept = lines.filter((line, i) => !(i > 0 && i < end && line.startsWith('disable-model-invocation:')));
  writeFileSync(path, kept.join('\n'));
}

const live_skills = readdirSync(join(plugin_root, 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join('skills', entry.name, 'SKILL.md'));

test('jig ships skills, and every one is user-invoked only', () => {
  assert.ok(live_skills.length > 0, 'no skills/*/SKILL.md found under the plugin root');
  assert.deepEqual(model_invocable_skills(plugin_root), []);
});

test('jig carries no ambient component, on disk or in plugin.json', () => {
  assert.deepEqual(ambient_components(plugin_root), []);
});

test('a skill whose frontmatter drops disable-model-invocation is refused, and named', () => {
  with_scratch_plugin((root) => {
    drop_user_invoked_key(root, 'skills/version/SKILL.md');
    assert.deepEqual(model_invocable_skills(root), ['skills/version/SKILL.md']);
  });
});

test('a skill that sets the key to anything but true is refused', () => {
  with_scratch_plugin((root) => {
    const path = join(root, 'skills/commit/SKILL.md');
    writeFileSync(path, readFileSync(path, 'utf8').replace('disable-model-invocation: true', 'disable-model-invocation: false'));
    assert.deepEqual(model_invocable_skills(root), ['skills/commit/SKILL.md']);
  });
});

test('the key counts only inside the leading frontmatter block, never in the body', () => {
  with_scratch_plugin((root) => {
    const rel = 'skills/version/SKILL.md';
    drop_user_invoked_key(root, rel);
    const path = join(root, rel);
    writeFileSync(path, `${readFileSync(path, 'utf8')}\n\nNote: this skill sets disable-model-invocation: true elsewhere.\n`);
    assert.deepEqual(model_invocable_skills(root), [rel]);
  });
});

test('a SKILL.md with no frontmatter at all is refused', () => {
  with_scratch_plugin((root) => {
    const path = join(root, 'skills/version/SKILL.md');
    const body = readFileSync(path, 'utf8').split('\n').slice(frontmatter(readFileSync(path, 'utf8')).length + 2).join('\n');
    writeFileSync(path, body);
    assert.deepEqual(model_invocable_skills(root), ['skills/version/SKILL.md']);
  });
});

for (const rel of AMBIENT_PATHS) {
  test(`an ambient ${rel} under the plugin root is refused`, () => {
    with_scratch_plugin((root) => {
      if (rel.endsWith('.json')) writeFileSync(join(root, rel), '{}\n');
      else mkdirSync(join(root, rel));
      assert.deepEqual(ambient_components(root), [rel]);
    });
  });
}

for (const key of AMBIENT_KEYS) {
  test(`a ${key} key in plugin.json is refused`, () => {
    with_scratch_plugin((root) => {
      const path = join(root, '.claude-plugin/plugin.json');
      const manifest = JSON.parse(readFileSync(path, 'utf8'));
      manifest[key] = key === 'hooks' ? './hooks/hooks.json' : {};
      writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
      assert.deepEqual(ambient_components(root), [`plugin.json: ${key}`]);
    });
  });
}
