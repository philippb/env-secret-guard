import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import picomatch from 'picomatch';
import { SecretScannerConfig } from './config';
import { EnvValue, loadEnvSecrets } from './env';
import { getTrackedFiles } from './git';

export interface RedactionResult {
  filePath: string;
  keys: string[];
}

export interface RedactionSummary {
  mode: 'all' | 'paths';
  rootDir: string;
  filesScanned: number;
  filesChanged: number;
  secretCount: number;
  results: RedactionResult[];
}

export interface RedactOptions {
  cwd: string;
  config: Required<SecretScannerConfig>;
  apply: boolean;
  includeUntracked?: boolean;
  paths?: string[];
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

  return files.filter(filePath => {
    if (isAllowed(filePath)) {
      return false;
    }
    if (isIgnored(filePath)) {
      return false;
    }
    return true;
  });
}

function replaceAllLiteral(content: string, target: string, replacement: string): string {
  if (target.length === 0) return content;
  return content.split(target).join(replacement);
}

function createRedactedValue(secret: EnvValue): string {
  const prefix = secret.value.substring(0, Math.min(4, secret.value.length));
  return `${prefix}********** (env var: ${secret.key})`;
}

function redactInFiles(
  files: string[],
  secrets: EnvValue[],
  options: { config: Required<SecretScannerConfig>; apply: boolean }
): { filesScanned: number; results: RedactionResult[] } {
  let filesScanned = 0;
  const results: RedactionResult[] = [];

  for (const filePath of files) {
    if (isBinaryFile(filePath, options.config.binaryExtensions)) {
      continue;
    }

    const content = readTextFile(filePath);
    if (!content) {
      continue;
    }

    filesScanned += 1;

    let newContent = content;
    const keys = new Set<string>();

    for (const secret of secrets) {
      if (!newContent.includes(secret.value)) {
        continue;
      }
      const redactedValue = createRedactedValue(secret);
      newContent = replaceAllLiteral(newContent, secret.value, redactedValue);
      keys.add(secret.key);
    }

    if (keys.size > 0) {
      results.push({ filePath, keys: Array.from(keys) });
      if (options.apply) {
        fs.writeFileSync(filePath, newContent, 'utf-8');
      }
    }
  }

  return { filesScanned, results };
}

function stripEnvFiles(files: string[]): string[] {
  return files.filter(file => !file.includes('.env'));
}

export function redactAllFiles(options: RedactOptions): RedactionSummary {
  const secrets = loadEnvSecrets(options.cwd, options.config);
  const files = getTrackedFiles(options.cwd, Boolean(options.includeUntracked));
  const filtered = filterFileList(stripEnvFiles(files), options.config);
  const result = redactInFiles(filtered, secrets, { config: options.config, apply: options.apply });

  return {
    mode: 'all',
    rootDir: options.cwd,
    filesScanned: result.filesScanned,
    filesChanged: result.results.length,
    secretCount: secrets.length,
    results: result.results,
  };
}

export function redactPaths(options: RedactOptions): RedactionSummary {
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
  const absolute = expanded.map(match => path.resolve(options.cwd, match));
  const filtered = filterFileList(stripEnvFiles(absolute), options.config);
  const result = redactInFiles(filtered, secrets, { config: options.config, apply: options.apply });

  return {
    mode: 'paths',
    rootDir: options.cwd,
    filesScanned: result.filesScanned,
    filesChanged: result.results.length,
    secretCount: secrets.length,
    results: result.results,
  };
}
