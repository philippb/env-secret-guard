import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import { SecretScannerConfig } from './config';

export interface EnvValue {
  file: string;
  key: string;
  value: string;
}

export function parseEnvFile(filePath: string): EnvValue[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const envValues: EnvValue[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      envValues.push({
        file: path.basename(filePath),
        key,
        value,
      });
    }
  }

  return envValues;
}

export function filterSecrets(envValues: EnvValue[], config: Required<SecretScannerConfig>): EnvValue[] {
  const common = new Set(config.commonValues.map(value => value.toLowerCase()));
  return envValues.filter(({ value }) => {
    if (!value || value.length < config.minSecretLength) return false;
    if (common.has(value.toLowerCase())) return false;
    if (/^\d+$/.test(value)) return false;
    if (value.startsWith('http://localhost') || value.startsWith('https://localhost')) return false;
    return true;
  });
}

export function findEnvFiles(cwd: string, config: Required<SecretScannerConfig>): string[] {
  if (config.envFiles.length > 0) {
    return config.envFiles.map(envFile => path.resolve(cwd, envFile));
  }

  const matches = fg.sync(config.envFileGlobs, {
    cwd,
    onlyFiles: true,
    dot: true,
    unique: true,
    ignore: config.envFileExcludes,
  });

  return matches.map(match => path.resolve(cwd, match));
}

export function loadEnvSecrets(cwd: string, config: Required<SecretScannerConfig>): EnvValue[] {
  const envFiles = findEnvFiles(cwd, config);
  const values: EnvValue[] = [];

  for (const envFile of envFiles) {
    if (!fs.existsSync(envFile)) {
      throw new Error(`Env file not found: ${envFile}`);
    }
    values.push(...parseEnvFile(envFile));
  }

  return filterSecrets(values, config);
}
