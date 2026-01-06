import { execFileSync } from 'child_process';
import path from 'path';

function runGit(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' });
}

function splitNullSeparated(input: string): string[] {
  return input
    .split('\u0000')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getRepoRoot(cwd: string): string | null {
  try {
    const output = runGit(['rev-parse', '--show-toplevel'], cwd);
    return output.trim();
  } catch {
    return null;
  }
}

export function getStagedFiles(cwd: string): string[] {
  const repoRoot = getRepoRoot(cwd);
  if (!repoRoot) {
    throw new Error('Not inside a git repository.');
  }
  const output = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'], repoRoot);
  return splitNullSeparated(output).map((file) => path.resolve(repoRoot, file));
}

export function getTrackedFiles(cwd: string, includeUntracked: boolean): string[] {
  const repoRoot = getRepoRoot(cwd);
  if (!repoRoot) {
    throw new Error('Not inside a git repository.');
  }

  const tracked = splitNullSeparated(runGit(['ls-files', '-z'], repoRoot)).map((file) =>
    path.resolve(repoRoot, file),
  );

  if (!includeUntracked) {
    return tracked;
  }

  const untracked = splitNullSeparated(
    runGit(['ls-files', '-z', '--others', '--exclude-standard'], repoRoot),
  ).map((file) => path.resolve(repoRoot, file));

  return tracked.concat(untracked);
}
