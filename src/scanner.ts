import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import picomatch from 'picomatch';
import { EnvValue, loadEnvSecrets } from './env';
import { SecretScannerConfig } from './config';
import {
  getCommitFiles,
  getCommitShas,
  getRepoRoot,
  getStagedFiles,
  getTrackedFiles,
  readCommitFile,
  readStagedFile,
} from './git';

export interface SecretMatch {
  key: string;
  envFile: string;
}

export interface Finding {
  filePath: string;
  matches: SecretMatch[];
  source?: 'staged' | 'working-tree' | 'history';
  commit?: string;
}

export interface ScanSummary {
  mode: 'staged' | 'working-tree' | 'history' | 'all' | 'paths';
  rootDir: string;
  filesScanned: number;
  findings: Finding[];
  envFileCount: number;
  secretCount: number;
}

export interface ScanOptions {
  cwd: string;
  config: Required<SecretScannerConfig>;
  includeUntracked?: boolean;
  paths?: string[];
  since?: string;
}

function isBinaryFile(filePath: string, binaryExtensions: string[]): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return binaryExtensions.includes(ext);
}

function readTextFile(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('\u0000')) {
      return null;
    }
    return content;
  } catch {
    return null;
  }
}

function createMatcher(patterns: string[]) {
  if (!patterns.length) {
    return () => false;
  }
  const matcher = picomatch(patterns, { dot: true });
  return (filePath: string) => matcher(filePath);
}

function filterFileList(files: string[], config: Required<SecretScannerConfig>): string[] {
  const isIgnored = createMatcher(config.ignoreFileGlobs);
  const isAllowed = createMatcher(config.allowFileGlobs);

  return files.filter((filePath) => {
    if (isAllowed(filePath)) {
      return false;
    }
    if (isIgnored(filePath)) {
      return false;
    }
    return true;
  });
}

export function scanFiles(
  files: string[],
  secrets: EnvValue[],
  options: { config: Required<SecretScannerConfig>; readFile?: (filePath: string) => string | null },
): { filesScanned: number; findings: Finding[] } {
  const findings: Finding[] = [];
  let filesScanned = 0;

  for (const filePath of files) {
    if (isBinaryFile(filePath, options.config.binaryExtensions)) {
      continue;
    }

    const content = options.readFile ? options.readFile(filePath) : readTextFile(filePath);
    if (!content) {
      continue;
    }

    filesScanned += 1;

    const matches: SecretMatch[] = [];

    for (const secret of secrets) {
      if (content.includes(secret.value)) {
        matches.push({ key: secret.key, envFile: secret.file });
      }
    }

    if (matches.length > 0) {
      findings.push({
        filePath,
        matches,
      });
    }
  }

  return { filesScanned, findings };
}

export function scanStagedFiles(options: ScanOptions): ScanSummary {
  const secrets = loadEnvSecrets(options.cwd, options.config);
  const files = getStagedFiles(options.cwd);
  const filtered = filterFileList(files, options.config).filter((file) => !file.includes('.env'));
  const repoRoot = getRepoRoot(options.cwd);
  if (!repoRoot) {
    throw new Error('Not inside a git repository.');
  }
  const readFile = (filePath: string) => readStagedFile(repoRoot, filePath);
  const result = scanFiles(filtered, secrets, { config: options.config, readFile });
  const findings: Finding[] = result.findings.map((finding) => ({
    ...finding,
    source: 'staged' as const,
  }));

  return {
    mode: 'staged',
    rootDir: options.cwd,
    filesScanned: result.filesScanned,
    findings,
    envFileCount: secrets.length === 0 ? 0 : new Set(secrets.map((secret) => secret.file)).size,
    secretCount: secrets.length,
  };
}

export function scanAllFiles(options: ScanOptions): ScanSummary {
  const secrets = loadEnvSecrets(options.cwd, options.config);
  const files = getTrackedFiles(options.cwd, Boolean(options.includeUntracked));
  const filtered = filterFileList(files, options.config).filter((file) => !file.includes('.env'));
  const result = scanFiles(filtered, secrets, { config: options.config });
  const findings: Finding[] = result.findings.map((finding) => ({
    ...finding,
    source: 'working-tree' as const,
  }));

  return {
    mode: 'working-tree',
    rootDir: options.cwd,
    filesScanned: result.filesScanned,
    findings,
    envFileCount: secrets.length === 0 ? 0 : new Set(secrets.map((secret) => secret.file)).size,
    secretCount: secrets.length,
  };
}

export function scanHistoryFiles(options: ScanOptions): ScanSummary {
  const secrets = loadEnvSecrets(options.cwd, options.config);
  const repoRoot = getRepoRoot(options.cwd);
  if (!repoRoot) {
    throw new Error('Not inside a git repository.');
  }

  const commits = getCommitShas(options.cwd, options.since);
  let filesScanned = 0;
  const findings: Finding[] = [];

  for (const commit of commits) {
    const files = getCommitFiles(repoRoot, commit);
    const filtered = filterFileList(files, options.config).filter((file) => !file.includes('.env'));
    const result = scanFiles(filtered, secrets, {
      config: options.config,
      readFile: (filePath: string) => readCommitFile(repoRoot, commit, filePath),
    });

    filesScanned += result.filesScanned;
    for (const finding of result.findings) {
      findings.push({ ...finding, source: 'history' as const, commit });
    }
  }

  return {
    mode: 'history',
    rootDir: options.cwd,
    filesScanned,
    findings,
    envFileCount: secrets.length === 0 ? 0 : new Set(secrets.map((secret) => secret.file)).size,
    secretCount: secrets.length,
  };
}

export function scanAllTargets(options: ScanOptions): ScanSummary {
  const staged = scanStagedFiles(options);
  const worktree = scanAllFiles(options);
  const history = scanHistoryFiles(options);

  return {
    mode: 'all',
    rootDir: options.cwd,
    filesScanned: staged.filesScanned + worktree.filesScanned + history.filesScanned,
    findings: [...staged.findings, ...worktree.findings, ...history.findings],
    envFileCount: staged.envFileCount,
    secretCount: staged.secretCount,
  };
}

export function scanPaths(options: ScanOptions): ScanSummary {
  const secrets = loadEnvSecrets(options.cwd, options.config);
  const inputPaths = options.paths ?? [];
  const expanded = fg.sync(inputPaths, {
    cwd: options.cwd,
    dot: true,
    onlyFiles: true,
    unique: true,
    ignore: options.config.ignoreFileGlobs,
    followSymbolicLinks: false,
  });
  const absolute = expanded.map((match) => path.resolve(options.cwd, match));
  const filtered = filterFileList(absolute, options.config).filter(
    (file) => !file.includes('.env'),
  );
  const result = scanFiles(filtered, secrets, { config: options.config });

  return {
    mode: 'paths',
    rootDir: options.cwd,
    filesScanned: result.filesScanned,
    findings: result.findings,
    envFileCount: secrets.length === 0 ? 0 : new Set(secrets.map((secret) => secret.file)).size,
    secretCount: secrets.length,
  };
}
