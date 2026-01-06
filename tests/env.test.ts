import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config';
import { filterSecrets, parseEnvFile } from '../src/env';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'secret-scanner-'));
}

describe('env parsing', () => {
  it('parses and filters secrets from env files', () => {
    const dir = makeTempDir();
    const envPath = path.join(dir, '.env');
    fs.writeFileSync(
      envPath,
      ['FOO=bar', 'SECRET_KEY="supersecretvalue"', 'PORT=3000'].join('\n'),
      'utf-8'
    );

    const values = parseEnvFile(envPath);
    expect(values).toHaveLength(3);

    const secrets = filterSecrets(values, DEFAULT_CONFIG);
    expect(secrets).toHaveLength(1);
    expect(secrets[0].key).toBe('SECRET_KEY');
  });
});
