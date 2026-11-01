// Tests for the engine's `changelog` report on a bump, and the matching fields in `init`.
//
// A repo that writes its changelog entries as it goes keeps them under an Unreleased
// section, and its release promotes that section rather than drafting a new one from commit
// subjects. The skill can only tell which case it's in from what the engine reports, so the
// report is the contract under test: whether the file exists, whether its first `##` entry
// is an Unreleased section, and whether that section holds anything yet.
//
// Each test builds a throwaway git repo with one commit, runs the real engine against it,
// and reads the single JSON object it prints.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const engine = fileURLToPath(new URL('../bump.mjs', import.meta.url));

function scratch_repo(changelog) {
  const root = mkdtempSync(join(tmpdir(), 'bump-changelog-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  writeFileSync(join(root, 'package.json'), '{\n  "name": "x",\n  "version": "1.2.3"\n}\n');
  mkdirSync(join(root, '.claude'));
  writeFileSync(
    join(root, '.claude/version.json'),
    JSON.stringify({ targets: [{ type: 'json', path: 'package.json', key: 'version' }] }),
  );
  if (changelog !== undefined) writeFileSync(join(root, 'CHANGELOG.md'), changelog);
  git('add', '-A');
  git('commit', '-q', '-m', 'initial');
  return root;
}

function run(root, arg) {
  return JSON.parse(execFileSync('node', [engine, arg], { cwd: root, encoding: 'utf8' }));
}

function with_repo(changelog, fn) {
  const root = scratch_repo(changelog);
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- bump

test('an Unreleased section with entries is reported with its line and heading', () => {
  with_repo('# Changelog\n\n## Unreleased\n\n### Fixed\n\n- **A fix.** It works now.\n\n## v1.2.3 — 2026-01-01\n\n- old\n', (root) => {
    const out = run(root, 'patch');
    assert.equal(out.mode, 'bump');
    assert.deepEqual(out.changelog, {
      path: 'CHANGELOG.md',
      exists: true,
      unreleased: { line: 3, heading: '## Unreleased', has_entries: true },
    });
  });
});

test("keep-a-changelog's bracketed heading counts, in any case", () => {
  with_repo('# Changelog\n\n## [unreleased]\n\n- Added a thing\n', (root) => {
    assert.equal(run(root, 'patch').changelog.unreleased.heading, '## [unreleased]');
  });
});

test('an Unreleased section with only subheadings has no entries', () => {
  with_repo('# Changelog\n\n## [Unreleased]\n\n### Added\n\n### Fixed\n\n## [1.2.3] - 2026-01-01\n\n- old\n', (root) => {
    assert.equal(run(root, 'patch').changelog.unreleased.has_entries, false);
  });
});

test('an Unreleased heading below the first release heading is not promoted', () => {
  with_repo('# Changelog\n\n## v1.2.3 — 2026-01-01\n\n- old\n\n## Unreleased\n\n- stray\n', (root) => {
    assert.equal(run(root, 'patch').changelog.unreleased, null);
  });
});

test('a changelog whose first entry is a release reports no Unreleased section', () => {
  with_repo('# Changelog\n\n## v1.2.3 — 2026-01-01\n\n- old\n', (root) => {
    assert.deepEqual(run(root, 'patch').changelog, { path: 'CHANGELOG.md', exists: true, unreleased: null });
  });
});

test('a missing changelog is reported as missing', () => {
  with_repo(undefined, (root) => {
    assert.deepEqual(run(root, 'patch').changelog, { path: 'CHANGELOG.md', exists: false, unreleased: null });
  });
});

// ---------------------------------------------------------------- init

test('init reads the release heading style past an Unreleased section', () => {
  with_repo('# Changelog\n\n## Unreleased\n\n- next\n\n## v1.2.3 — 2026-01-01\n\n- old\n', (root) => {
    const { existing } = run(root, 'init');
    assert.deepEqual(existing.changelog, {
      path: 'CHANGELOG.md',
      first_heading: '## Unreleased',
      first_release_heading: '## v1.2.3 — 2026-01-01',
      unreleased: true,
    });
  });
});
