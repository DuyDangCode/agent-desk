import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getVisibleUnstagedFiles,
  getVisibleStagedFiles,
  resolveNextFileSelection,
} from '../src/lib/utils/fileSelection.ts';
import type { FileDiff } from '../src/lib/types/index.ts';

function makeFileDiff(path: string, is_staged: boolean, status: string = 'modified'): FileDiff {
  return {
    path,
    is_staged,
    status,
    additions: 1,
    deletions: 1,
    hunks: [],
  };
}

test('Boundary Tests: Lower Bound - Staging the first file in unstaged list', () => {
  const previousFiles = [
    makeFileDiff('src/first.ts', false),
    makeFileDiff('src/second.ts', false),
    makeFileDiff('src/third.ts', false),
  ];
  // After staging first.ts:
  const nextFiles = [
    makeFileDiff('src/first.ts', true),
    makeFileDiff('src/second.ts', false),
    makeFileDiff('src/third.ts', false),
  ];

  const result = resolveNextFileSelection({
    oldSelectedPath: 'src/first.ts',
    oldSelectedIsStaged: false,
    previousFiles,
    nextFiles,
  });

  assert.strictEqual(result.selectedFilePath, 'src/second.ts');
  assert.strictEqual(result.selectedIsStaged, false);
});

test('Boundary Tests: In-Bound - Staging a middle file in unstaged list', () => {
  const previousFiles = [
    makeFileDiff('src/first.ts', false),
    makeFileDiff('src/second.ts', false),
    makeFileDiff('src/third.ts', false),
  ];
  // After staging second.ts:
  const nextFiles = [
    makeFileDiff('src/second.ts', true),
    makeFileDiff('src/first.ts', false),
    makeFileDiff('src/third.ts', false),
  ];

  const result = resolveNextFileSelection({
    oldSelectedPath: 'src/second.ts',
    oldSelectedIsStaged: false,
    previousFiles,
    nextFiles,
  });

  assert.strictEqual(result.selectedFilePath, 'src/third.ts');
  assert.strictEqual(result.selectedIsStaged, false);
});

test('Boundary Tests: Upper Bound - Staging the last file in unstaged list', () => {
  const previousFiles = [
    makeFileDiff('src/first.ts', false),
    makeFileDiff('src/second.ts', false),
    makeFileDiff('src/third.ts', false),
  ];
  // After staging third.ts (last file):
  const nextFiles = [
    makeFileDiff('src/third.ts', true),
    makeFileDiff('src/first.ts', false),
    makeFileDiff('src/second.ts', false),
  ];

  const result = resolveNextFileSelection({
    oldSelectedPath: 'src/third.ts',
    oldSelectedIsStaged: false,
    previousFiles,
    nextFiles,
  });

  // Since third.ts was last (index 2), clamped index is 1 -> second.ts
  assert.strictEqual(result.selectedFilePath, 'src/second.ts');
  assert.strictEqual(result.selectedIsStaged, false);
});

test('Single file bound: If nothing left in unstaged, keep focus on the staged file', () => {
  const previousFiles = [
    makeFileDiff('src/only.ts', false),
  ];
  // After staging only.ts:
  const nextFiles = [
    makeFileDiff('src/only.ts', true),
  ];

  const result = resolveNextFileSelection({
    oldSelectedPath: 'src/only.ts',
    oldSelectedIsStaged: false,
    previousFiles,
    nextFiles,
  });

  assert.strictEqual(result.selectedFilePath, 'src/only.ts');
  assert.strictEqual(result.selectedIsStaged, true);
});

test('Zero file bound: Empty workspace', () => {
  const result = resolveNextFileSelection({
    oldSelectedPath: 'src/deleted.ts',
    oldSelectedIsStaged: false,
    previousFiles: [makeFileDiff('src/deleted.ts', false)],
    nextFiles: [],
  });

  assert.strictEqual(result.selectedFilePath, null);
  assert.strictEqual(result.selectedIsStaged, false);
});

test('Filter support: Search query filter active', () => {
  const previousFiles = [
    makeFileDiff('src/auth/login.ts', false),
    makeFileDiff('src/common/util.ts', false),
    makeFileDiff('src/auth/logout.ts', false),
    makeFileDiff('src/auth/session.ts', false),
  ];
  // After staging login.ts:
  const nextFiles = [
    makeFileDiff('src/auth/login.ts', true),
    makeFileDiff('src/common/util.ts', false),
    makeFileDiff('src/auth/logout.ts', false),
    makeFileDiff('src/auth/session.ts', false),
  ];

  const result = resolveNextFileSelection({
    oldSelectedPath: 'src/auth/login.ts',
    oldSelectedIsStaged: false,
    previousFiles,
    nextFiles,
    searchQuery: 'auth',
  });

  // Should skip common/util.ts because it is filtered out by 'auth'
  assert.strictEqual(result.selectedFilePath, 'src/auth/logout.ts');
  assert.strictEqual(result.selectedIsStaged, false);
});

test('Filter support: Search query filter where staged file was the last matching unstaged file', () => {
  const previousFiles = [
    makeFileDiff('src/auth/login.ts', false),
    makeFileDiff('src/common/util.ts', false),
  ];
  // After staging login.ts:
  const nextFiles = [
    makeFileDiff('src/auth/login.ts', true),
    makeFileDiff('src/common/util.ts', false),
  ];

  const result = resolveNextFileSelection({
    oldSelectedPath: 'src/auth/login.ts',
    oldSelectedIsStaged: false,
    previousFiles,
    nextFiles,
    searchQuery: 'login',
  });

  // Under filter 'login', no more unstaged files exist -> keep focus on login.ts (staged)
  assert.strictEqual(result.selectedFilePath, 'src/auth/login.ts');
  assert.strictEqual(result.selectedIsStaged, true);
});

test('Filter support: File extension filter active (*.svelte)', () => {
  const previousFiles = [
    makeFileDiff('src/App.svelte', false),
    makeFileDiff('src/main.ts', false),
    makeFileDiff('src/Header.svelte', false),
  ];
  // After staging App.svelte:
  const nextFiles = [
    makeFileDiff('src/App.svelte', true),
    makeFileDiff('src/main.ts', false),
    makeFileDiff('src/Header.svelte', false),
  ];

  const result = resolveNextFileSelection({
    oldSelectedPath: 'src/App.svelte',
    oldSelectedIsStaged: false,
    previousFiles,
    nextFiles,
    fileExtensionFilter: '.svelte',
  });

  // Next .svelte file is Header.svelte
  assert.strictEqual(result.selectedFilePath, 'src/Header.svelte');
  assert.strictEqual(result.selectedIsStaged, false);
});

test('Filter support: fileFilter = "unstaged" mode', () => {
  const previousFiles = [
    makeFileDiff('src/a.ts', false),
    makeFileDiff('src/b.ts', false),
  ];
  const nextFiles = [
    makeFileDiff('src/a.ts', true),
    makeFileDiff('src/b.ts', false),
  ];

  const result = resolveNextFileSelection({
    oldSelectedPath: 'src/a.ts',
    oldSelectedIsStaged: false,
    previousFiles,
    nextFiles,
    fileFilter: 'unstaged',
  });

  assert.strictEqual(result.selectedFilePath, 'src/b.ts');
  assert.strictEqual(result.selectedIsStaged, false);
});

test('Unstaging support: When a staged file is unstaged, focus next staged file or unstaged version', () => {
  const previousFiles = [
    makeFileDiff('src/staged1.ts', true),
    makeFileDiff('src/staged2.ts', true),
  ];
  // After unstaging staged1.ts:
  const nextFiles = [
    makeFileDiff('src/staged2.ts', true),
    makeFileDiff('src/staged1.ts', false),
  ];

  const result = resolveNextFileSelection({
    oldSelectedPath: 'src/staged1.ts',
    oldSelectedIsStaged: true,
    previousFiles,
    nextFiles,
  });

  assert.strictEqual(result.selectedFilePath, 'src/staged2.ts');
  assert.strictEqual(result.selectedIsStaged, true);
});

test('Non-selected file staged: Selected file remains focused if it still exists', () => {
  const previousFiles = [
    makeFileDiff('src/active.ts', false),
    makeFileDiff('src/other.ts', false),
  ];
  // User clicked stage on other.ts while viewing active.ts:
  const nextFiles = [
    makeFileDiff('src/other.ts', true),
    makeFileDiff('src/active.ts', false),
  ];

  const result = resolveNextFileSelection({
    oldSelectedPath: 'src/active.ts',
    oldSelectedIsStaged: false,
    previousFiles,
    nextFiles,
  });

  assert.strictEqual(result.selectedFilePath, 'src/active.ts');
  assert.strictEqual(result.selectedIsStaged, false);
});
