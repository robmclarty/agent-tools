// Tests for commit.sh's staging step against .gitignore.
//
// git ignores only what it doesn't track, so a tracked file under an ignored
// directory is a legitimate commit target. But `git add -- <that file>` exits 1
// on the ignored pathspec even as it stages the file (git 2.50), and the script's
// `set -e` used to abort there, after staging and before committing. The fix
// stages tracked survivors with `-f` and reports untracked ignored paths as one
// more never-stage reason; these tests pin both halves, plus the baseline filter.
//
// Each test builds a throwaway git repo whose `research/` directory was tracked
// before it was ignored, runs the real script against it, and reads git back.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../commit.sh', import.meta.url));

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// A repo with research/a.md tracked, then research/ gitignored: the shape of a
// research directory that was committed before the ignore rule arrived.
function scratch_repo() {
  const root = mkdtempSync(join(tmpdir(), 'commit-sh-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'test');
  mkdirSync(join(root, 'research'));
  writeFileSync(join(root, 'research/a.md'), 'a\n');
  writeFileSync(join(root, 'src.txt'), 'src\n');
  mkdirSync(join(root, 'lib'));
  writeFileSync(join(root, 'lib/one.txt'), 'one\n');
  writeFileSync(join(root, 'lib/two.txt'), 'two\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'initial');
  writeFileSync(join(root, '.gitignore'), 'research/\n');
  git(root, 'add', '.gitignore');
  git(root, 'commit', '-q', '-m', 'ignore research');
  return root;
}

function run(root, paths, message = 'test: commit\n') {
  const r = spawnSync('bash', [script, ...paths], { cwd: root, input: message, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function with_repo(fn) {
  const root = scratch_repo();
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function commit_count(root) {
  return Number(git(root, 'rev-list', '--count', 'HEAD'));
}

test('a tracked file under a gitignored directory commits', () => {
  with_repo((root) => {
    writeFileSync(join(root, 'research/a.md'), 'a2\n');
    const r = run(root, ['research/a.md']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(commit_count(root), 3);
    assert.equal(git(root, 'show', 'HEAD:research/a.md'), 'a2');
    assert.equal(git(root, 'status', '--porcelain'), '');
  });
});

test('an untracked path under a gitignored directory is skipped with a reason, and the rest commits', () => {
  with_repo((root) => {
    writeFileSync(join(root, 'research/a.md'), 'a2\n');
    writeFileSync(join(root, 'research/new.md'), 'new\n');
    const r = run(root, ['research/a.md', 'research/new.md']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /research\/new\.md \(gitignored\)/);
    assert.equal(commit_count(root), 3);
    assert.equal(git(root, 'show', 'HEAD:research/a.md'), 'a2');
    assert.equal(git(root, 'ls-files', 'research/new.md'), '');
  });
});

test('a tracked file deleted from disk under a gitignored directory stages its removal', () => {
  with_repo((root) => {
    unlinkSync(join(root, 'research/a.md'));
    const r = run(root, ['research/a.md']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(commit_count(root), 3);
    assert.equal(git(root, 'ls-files', 'research/a.md'), '');
  });
});

test('the never-stage filter still skips a secret and commits the rest', () => {
  with_repo((root) => {
    writeFileSync(join(root, '.env'), 'KEY=1\n');
    writeFileSync(join(root, 'src.txt'), 'src2\n');
    const r = run(root, ['.env', 'src.txt']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /\.env \(secret\)/);
    assert.equal(commit_count(root), 3);
    assert.equal(git(root, 'show', 'HEAD:src.txt'), 'src2');
    assert.equal(git(root, 'ls-files', '.env'), '');
  });
});

// Paths are literal pathspecs. A glob or `:/` prefix that reaches the script
// unexpanded must name a nonexistent file, not a set the per-file filter never
// saw and that `git add -f` would then force past .gitignore.

test('a directory argument still expands to its files and commits them', () => {
  with_repo((root) => {
    writeFileSync(join(root, 'lib/one.txt'), 'one2\n');
    writeFileSync(join(root, 'lib/two.txt'), 'two2\n');
    const r = run(root, ['lib']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(commit_count(root), 3);
    assert.equal(git(root, 'show', 'HEAD:lib/one.txt'), 'one2');
    assert.equal(git(root, 'show', 'HEAD:lib/two.txt'), 'two2');
  });
});

test('a glob argument is a literal path, so it stages nothing it matches', () => {
  with_repo((root) => {
    writeFileSync(join(root, 'research/a.md'), 'a2\n');
    writeFileSync(join(root, 'research/new.md'), 'new\n');
    // spawnSync runs no shell, so the asterisk arrives unexpanded, as a quoted
    // argument would.
    const r = run(root, ['research/*']);
    assert.notEqual(r.status, 0);
    assert.equal(commit_count(root), 2);
    assert.equal(git(root, 'diff', '--cached', '--name-only'), '');
    assert.equal(git(root, 'ls-files', 'research/new.md'), '');
  });
});

test('pathspec magic is a literal path too', () => {
  with_repo((root) => {
    writeFileSync(join(root, 'src.txt'), 'src2\n');
    const r = run(root, [':/src.txt']);
    assert.notEqual(r.status, 0);
    assert.equal(commit_count(root), 2);
    assert.equal(git(root, 'diff', '--cached', '--name-only'), '');
  });
});

test('a ./-prefixed tracked file under a gitignored directory still commits', () => {
  with_repo((root) => {
    writeFileSync(join(root, 'research/a.md'), 'a2\n');
    const r = run(root, ['./research/a.md']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(commit_count(root), 3);
    assert.equal(git(root, 'show', 'HEAD:research/a.md'), 'a2');
  });
});

test('only gitignored paths leaves nothing to commit and exits non-zero', () => {
  with_repo((root) => {
    writeFileSync(join(root, 'research/new.md'), 'new\n');
    const r = run(root, ['research/new.md']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /research\/new\.md \(gitignored\)/);
    assert.match(r.stderr, /no paths survived/);
    assert.equal(commit_count(root), 2);
  });
});
