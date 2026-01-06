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

export function getCommitShas(cwd: string, since?: string): string[] {
  const repoRoot = getRepoRoot(cwd);
  if (!repoRoot) {
    throw new Error('Not inside a git repository.');
  }

  const args = ['rev-list', '--reverse'];
  if (since) {
    args.push('--since', since);
  }
  args.push('HEAD');

  const output = runGit(args, repoRoot).trim();
  if (!output) {
    return [];
  }
  return output.split('\n').map((entry) => entry.trim()).filter(Boolean);
}

export function getCommitFiles(repoRoot: string, commit: string): string[] {
  const output = runGit(
    ['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', '-z', commit],
    repoRoot,
  );
  return splitNullSeparated(output).map((file) => path.resolve(repoRoot, file));
}

export function readStagedFile(repoRoot: string, filePath: string): string | null {
  try {
    const relativePath = path.isAbsolute(filePath)
      ? path.relative(repoRoot, filePath)
      : filePath;
    const output = execFileSync('git', ['show', `:${relativePath}`], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    if (output.includes('\u0000')) {
      return null;
    }
    return output;
  } catch {
    return null;
  }
}

export function readCommitFile(
  repoRoot: string,
  commit: string,
  filePath: string,
): string | null {
  try {
    const relativePath = path.isAbsolute(filePath)
      ? path.relative(repoRoot, filePath)
      : filePath;
    const output = execFileSync('git', ['show', `${commit}:${relativePath}`], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    if (output.includes('\u0000')) {
      return null;
    }
    return output;
  } catch {
    return null;
  }
}
